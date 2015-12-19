'use strict';

const path = require('path'),
    crypto = require('crypto'),
    co = require('co'),
    ospath = require('ospath'),
    Git = require('./git');

let n = 0;

function Recoverer(cfg) {
    this.cfg = Object.assign({
        target: process.cwd(),
        gitdir: path.join(ospath.data(), `recover/${get_folder_name(cfg.target || process.cwd())}/.git`)
    }, cfg);

    // TODO: Error if no target (test!)

    // TODO: [sync] git init if target not git dir


    // Hold any 'undone' labels here when back-tracking (until changes pushed)
    this.future = [];

    this.git = new Git({
        cwd: this.cfg.target,
        gitdir: this.cfg.gitdir
    });

    // TODO: Loading tags breaks everything - why?
    // Read all existing tags in to get list of labels
    this.labels = [];
    this.get_tags = this.git.exec('tag').then(tags => {
        this.labels = tags.split('\n');
        console.log(this.labels.pop());
    },
    // Make sure we default to empty array if git tag fails
    _ => Promise.resolve([]));
}

function get_folder_name(folder) {
    // Get abs path of 'folder'
    let p = path.resolve(folder);

    // Hash it
    let shasum = crypto.createHash('sha1');
    shasum.update(p);
    return shasum.digest('hex');
}

Recoverer.prototype.push = co.wrap(function*(label) {
    if(label && (typeof label !== 'string')) {
        throw 'Label must be a string';
    }

    if(label && (this.labels.indexOf(label) >= 0)) {
        throw 'Label already in use';
    }

    let status;
    try {
        yield this.get_tags;
        // Stage all changes (additions, deletions, and updates)
        yield this.git.exec('add -A');
        status = yield this.git.exec('status --porcelain');
    } catch(ex) {
        // Not a git repo, so exec git init (setting work-tree as cwd)
        yield this.git.exec(`--work-tree="." init`);
        // Add all existing files in the directory
        yield this.git.exec('add -A');
        // Get the status after the add operation
        status = yield this.git.exec('status --porcelain');
    }

    // Check if there were any results form status
    if(!status.trim()) {
        // No text in status => no changes to commit
        return null;
    }


    // Use a counter to generate a unique commit label
    while(!label || (this.labels.indexOf(label) >= 0)) {
        label = '' + n++;
    }

    // Commit and tag with the label, so we can easily come back to it later
    yield this.git.exec('commit -m "recover"');
    yield this.git.exec(`tag "${label}"`);

    // We need to determine if we're not at the 'head' of our own history
    // We make a temp branch when we back track, so check for that
    if(!(yield* this._on_master())) {
        // We're off master, which means we were back-tracking
        // We want to get this commit back onto master, first we need
        // to dump all commits after our current HEAD from master though

        try {
            // Go back onto master, then reset it to current tag
            yield this.git.exec(`checkout master`);
        } catch(ex) {
            // TODO: Why does this return non-zero when it suceeds...
        }

        // The current tag/label is always the last item in 'this.labels'
        yield this.git.exec(`reset --hard "tags/${this.labels[this.labels.length-1]}"`);
        yield this.reset();

        // Merge temp back in and delete it
        yield this.git.exec('merge temp');
        yield this.git.exec('branch -D temp');

        // We can no longer go back to the future... =(
        this.future = [];
    }

    this.labels.push(label);

    return label;
});

Recoverer.prototype.pop = co.wrap(function*(label) {
    // TODO: Test this is ok when labels.length === 0
    if(this.labels.length) {
        if(!(yield* this._on_master())) {
            // If we're off master we have to checkout master at the
            // current label, delete temp, and THEN reset master
            yield this.git.exec('checkout master');

            // The current tag/label is always the last item in 'this.labels'
            yield this.git.exec(`checkout "tags/${this.labels[this.labels.length-1]}"`);

            // Delete temp
            yield this.git.exec('branch -D temp');

            // No going back now
            this.future = [];
        }

        yield this.git.exec('reset --hard HEAD~1');
        yield this.reset();
        this.labels.pop();
    }
});

Recoverer.prototype.reset = co.wrap(function*() {
    try {
        yield this.get_tags;
        // Clean working copy of ALL modifications
        yield this.git.exec('reset --hard');
        yield this.git.exec('clean -d -x -f');
    } catch(ex) {
        // TODO: Real error handling...
    }
});

Recoverer.prototype.to = co.wrap(function*(label) {
    if(!label || (typeof label !== 'string')) {
        throw 'Label is required and must be a string';
    }

    yield this.get_tags;

    let past_index = this.labels.indexOf(label),
        future_index =  this.future.indexOf(label);

    if((past_index >= 0) || (future_index >= 0)) {
        // Clean our working copy
        yield this.reset();

        // Checkout the tag we're moving to
        try {
            yield this.git.exec(`checkout "tags/${label}" -b temp`);
        } catch(ex) {
            // TODO: Why does this have a non-zero exit code when it suceeds?
        }
    }

    if(past_index >= 0) {
        // Make sure we move all commits we're bypassing onto 'future'
        this.future = this.labels.splice(past_index + 1).concat(this.future);
    } else if (future_index >= 0) {
        // Move any items now in the past out of 'this.future', back into labels
        this.labels = this.labels.concat(this.future.splice(future_index - 1, future_index));
    } else {
        throw 'Unrecognised label';
    }
});

Recoverer.prototype._on_master = function*() {
    let branch = yield this.git.exec('rev-parse --abbrev-ref HEAD');
    return /^master/.test(branch);
};

module.exports = exports = function(cfg) {
    return new Recoverer(cfg);
};

exports.Recoverer = Recoverer;
