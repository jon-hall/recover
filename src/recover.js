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
        gitdir: path.join(ospath.data(), `recover/${getFolderName(cfg.target || process.cwd())}/.git`)
    }, cfg);

    // TODO: Error if no target (test!)

    // TODO: [sync] git init if target not git dir

    // TODO: Read all existing commits in to get list of labels
    this.labels = [];

    this.git = new Git({
        cwd: this.cfg.target,
        gitdir: this.cfg.gitdir
    });
}

function getFolderName(folder) {
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

    // TODO: git commit

    this.labels.push(label);

    return label;
});

Recoverer.prototype.pop = function() {
    console.log('pop');
};

Recoverer.prototype.reset = function() {
    console.log('reset');
};

Recoverer.prototype.to = function(label) {
    console.log('to: %s', label);
};

module.exports = exports = function(cfg) {
    return new Recoverer(cfg);
};

exports.Recoverer = Recoverer;
