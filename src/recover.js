'use strict';

const path = require('path'),
    crypto = require('crypto'),
    fsx = require('fs-extra'),
    co = require('co'),
    ospath = require('ospath'),
    tryto = require('try-to'),
    del = require('del'),
    debug = require('debug')('recover'),
    Git = require('./git');

let n = 0;

function Recoverer(cfg) {
    this.cfg = Object.assign({
        target: process.cwd(),
        gitdir: path.join(ospath.data(), `recover/${get_folder_name(cfg.target || process.cwd())}/.git`)
    }, cfg);

    // Error if target dir doesn't exist
    try {
        fsx.lstatSync(this.cfg.target);
    } catch(ex) {
        throw new Error('Gitdir specified already exists.');
    }

    // Make sure the gitdir does exist
    fsx.ensureDirSync(this.cfg.gitdir);

    // Hold any 'undone' labels here when back-tracking (until changes pushed)
    this.future = [];

    this.git = new Git({
        cwd: this.cfg.target,
        gitdir: this.cfg.gitdir
    });

    // Read all existing tags in to get list of labels
    this.labels = [];
    this.get_tags = this.git.exec('tag').then(tags => {
        this.labels = tags.split('\n');
        // Remove the empty line
        this.labels.pop();
    },
    // Make sure we default to empty array if 'git tag' fails
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

    yield this.get_tags;

    if(label && (this.labels.indexOf(label) >= 0)) {
        throw 'Label already in use';
    }

    let status;
    try {
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
            //debug('push:checkout master failed', ex);
        }

        // The current tag/label is always the last item in 'this.labels'
        yield this.git.exec(`reset --hard "tags/${this.labels[this.labels.length-1]}"`);
        yield this.reset(true);

        // TODO: CLI might be showing a bug here, crashed after pushing a version with the same name just popped, after doing some to's
        // a (push) -> b (push) -> c (push) -> a (to) -> c (to) -> b (pop) -> c (push) [crash]
        // Merge temp back in and delete it
        yield this.git.exec('merge temp');
        yield this.git.exec('branch -D temp');

        // We can no longer go back to the future... =(
        debug('pushflush', this.future);
        yield* this._flush_tags(this.future);
        this.future = [];
    }

    this.labels.push(label);

    return label;
});

Recoverer.prototype.pop = co.wrap(function*(label) {
    yield this.get_tags;

    if(this.labels.length) {
        if(!(yield* this._on_master())) {
            try {
                // If we're off master we have to checkout master at the
                // current label, delete temp, and THEN reset master
                yield this.git.exec('checkout master');
            } catch(ex) {
                // TODO: Why does this return non-zero when it suceeds...
                //debug('pop:checkout master failed', ex);
            }

            // The current tag/label is always the last item in 'this.labels'
            try {
                yield this.git.exec(`checkout "tags/${this.labels[this.labels.length-1]}"`);
            } catch(ex) {
                // TODO: Why does this return non-zero when it suceeds...
                //debug('pop:checkout latest tag failed', ex);
            }

            // Delete temp
            yield this.git.exec('branch -D temp');

            // No going back now, dump all future tags
            debug('popflush', this.future);
            yield* this._flush_tags(this.future);
            this.future = [];
        }

        // Check if we're popping the first commit
        let log_result = yield this.git.exec('log -n 2 --oneline --format="%H"');
        if(log_result.split(/\s/).length === 2) {
            // We can't remove the init commit, so instead we delete the gitdir
            yield del(this.cfg.gitdir, { force: true });
            return this.labels.pop();
        }

        yield this.git.exec('reset --hard HEAD~1');
        // Make sure we also clean any untracked files (wrt the target version)
        yield this.reset(true);

        debug(this.labels);
        let popped = this.labels.pop();
        debug('flushpop', popped);
        yield* this._flush_tags([popped]);

        return popped;
    }
});

Recoverer.prototype.reset = co.wrap(function*(_force) {
    yield this.get_tags;

    try {
        // Only do a reset if we're not 'off-master', (e.g. in a 'to')
        if(_force || (yield* this._on_master())) {
            yield this.git.exec('reset --hard');
        }

        // Clean working copy of ALL modifications
        yield this.git.exec('clean -d -x -f');
        yield this.git.exec('checkout .');
    } catch(ex) {
        // TODO: Real error handling...
        //debug('reset:failed', ex);
    }
});

Recoverer.prototype.to = co.wrap(function*(label) {
    if(!label || (typeof label !== 'string')) {
        throw 'Label is required and must be a string';
    }

    yield this.get_tags;

    debug('to', label, this.labels, this.future);

    let past_index = this.labels.indexOf(label),
        future_index =  this.future.indexOf(label);

    if((past_index < 0) && (future_index < 0)) {
        throw 'Unrecognised label: ' + label;
    }

    // Clean our working copy
    yield this.reset();

    // Bail here if 'to' is called for the current version
    if(past_index === (this.labels.length - 1)) {
        debug('to: called for current');
        return;
    }

    // Checkout the tag we're moving to
    try {
        // If we're off master we need to delete temp so we can re-create
        if(!(yield* this._on_master())) {
            // Switch back ot master momentarily
            yield this.git.exec('checkout master');
        }
    } catch(ex) {
        // TODO: Why does this have a non-zero exit code when it suceeds?
        //debug('to:master checkout failed', ex);
    }

    try {
        // Try to delete temp
        yield this.git.exec('branch -D temp');
    } catch(ex) {
        // 'temp' didn't exist, which leaves us on a new 'temp' branch
        //debug('to:deleting temp failed', ex);
    }

    try {
        yield this.git.exec(`checkout "tags/${label}" -b temp`);
    } catch(ex) {
        //debug('to:master checkout failed', ex);
    }

    if(past_index >= 0) {
        // Make sure we move all commits we're bypassing onto 'future'
        this.future = this.labels.splice(past_index + 1).concat(this.future);
    } else if (future_index >= 0) {
        // Move any items now in the past out of 'this.future', back into labels
        this.labels = this.labels.concat(this.future.splice(0, future_index + 1));
    }

    debug('end to', label, this.labels, this.future);
});

Recoverer.prototype.list = co.wrap(function*() {
    yield this.get_tags;
    return this.labels.concat(this.future);
});

Recoverer.prototype._on_master = function*() {
    let branch = yield this.git.exec('rev-parse --abbrev-ref HEAD');
    return /^master/.test(branch);
};

Recoverer.prototype._flush_tags = function*(tags) {
    for(let tag of tags) {
        debug('flushing tag "%s"', tag);

        // Use try-to to retry the (particularly flaky) tag removal upto 10 times
        yield tryto(() => this.git.exec(`tag -d "${tag}"`))
            .for(10)
            .now();
    }
};

module.exports = exports = function(cfg) {
    return new Recoverer(cfg);
};

exports.Recoverer = Recoverer;
