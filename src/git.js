'use strict';

const exec = require('child_process').exec,
    path = require('path');

function Git(options) {
    this.cwd = options.cwd || process.cwd();
    this.gitdir = options.gitdir;
}

/**
 * A simple promise-returning wrapper around exec(' git ...') which executes in a predefined
 * directory, and with a predefined $GIT_DIR if specified.
 * @param  {String} cmd The git command to run (minus the 'git ' part).
 * @return {Promise}    Resolves with stdout or rejects with err/stderr.
 */
Git.prototype.exec = function(cmd) {
    let _this = this;

    if(this.gitdir) {
        cmd = `git --git-dir="${path.resolve(this.gitdir)}" ${cmd}`;
    } else {
        cmd = `git ${cmd}`;
    }

    return new Promise(function(res, rej) {
        exec(cmd, { cwd: _this.cwd }, function(err, stdout, stderr) {
            if(err) {
                return rej(err);
            }

            if(stderr) {
                return rej(stderr);
            }

            res(stdout);
        });
    });
};

module.exports = Git;
