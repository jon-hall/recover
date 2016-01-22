'use strict';

// HACK: jasmine-es6-promise-matchers tries to use window,
// so do this to prevent it from crashing
global.window = '';
require('jasmine-es6-promise-matchers');

const temp = require('temp').track(),
    JasminePromiseMatchers = global.JasminePromiseMatchers,
    fileHelper = require('./util/file'),
    recover = require('../src/recover');

describe('recover', function() {
    beforeEach(JasminePromiseMatchers.install);
    afterEach(JasminePromiseMatchers.uninstall);

    describe('when we make a recoverer', function() {
        describe('and an non-existent target dir is supplied', function() {
            it('it throws an error', function() {
                expect(() => recover({
                    target: __dirname + '/notadirectory'
                })).toThrow();
            });
        });

        describe('and the gitdir supplied doesn\'t exist', function() {
            it('it should not throw an error', function(done) {
                temp.mkdir('recover_test', function(err, gitdir) {
                    gitdir += '/a/b/c/d/';
                    expect(() => recover({ gitdir })).not.toThrow();
                    done();
                });
            });
        });
    });

    beforeEach(function(done) {
        let _this = this;

        // These are full integration tests, so give them plenty of time
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;

        temp.mkdir('recover_test', function(err, target) {
            if(err) {
                throw err;
            }

            temp.mkdir('recover_test', function(err2, gitdir) {
                if(err2) {
                    throw err2;
                }

                gitdir += '/more/folders/.git';
                _this.rec = recover({
                    target,
                    gitdir
                });
                _this.target = target;
                _this.files = fileHelper(target);
                _this.gitdir = gitdir;

                done();
            });
        });
    });

    afterEach(function(done) {
        temp.cleanup(function(err, stats) {
            // TODO: Should clean-up failing cause the tests to fail?
            if(err) {
                console.error(err);
            }
            done();
        });
    });

    describe('when push is called', function() {
        describe('and no changes have been made to the folder', function() {
            it('it returns null', function(done) {
                this.rec.push().then(r => {
                    expect(r).toBe(null);
                }, err => {
                    expect('reject').toBe('not called');
                }).then(done, done);
            });
        });

        describe('and changes have been made to the folder', function() {
            beforeEach(function(done) {
                this.files.write('a.txt', 'some text').then(done, done.fail);
            });

            describe('and no value is passed in', function() {
                it('it should return the label created', function(done) {
                    expect(this.rec.push().then(label =>
                        typeof label)).toBeResolvedWith('string', done);
                });
            });

            describe('with a value which isn\'t a string is passed in', function() {
                it('it errors', function(done) {
                    expect(this.rec.push(5)).toBeRejectedWith('Label must be a string', done);
                });
            });


            describe('and a string is passed in', function() {
                describe('and the label has already been used', function() {
                    it('it errors', function(done) {
                        expect(this.rec.push('a')).toBeResolved(() => {
                            expect(this.rec.push('a')).toBeRejectedWith('Label already in use', done);
                        });
                    });
                });

                describe('and the label has not already been used', function() {
                    it('it doesn\'t error', function(done) {
                        expect(this.rec.push('a')).toBeResolved(() => {
                            expect(this.rec.push('b')).toBeResolved(done);
                        });
                    });
                });
            });

            describe('and pop is subsequently called', function() {
                it('it returns the first label', function(done) {
                    // First push inits the repo
                    this.rec.push('a')
                        .then(() => {
                        expect(this.files.read('a.txt')).toBeResolved(() => {
                            expect(this.rec.pop()).toBeResolvedWith('a', done);
                        });
                    });
                });

                describe('and pop is called again', function() {
                    it('it doesn\'t error when trying to pop the first push', function(done) {
                        this.rec.push('a')
                            .then(() => {
                            expect(this.files.read('a.txt')).toBeResolved(() => {
                                expect(this.rec.pop()
                                    .then(() => this.rec.pop()))
                                    .toBeResolvedWith(undefined, done);
                            });
                        });
                    });
                });
            });

            describe('and push is called again', function() {
                describe('and pop is subsequently called', function() {
                    it('it restores the folder to its initial state', function(done) {
                        this.rec.push('a')
                            .then(() => this.files.write('b.txt', 'more stuff'))
                            // Second push is the first 'poppable' push
                            .then(() => this.rec.push('b'))
                            .then(() => {
                            expect(this.files.read('b.txt')).toBeResolved(() => {
                                this.rec.pop().then(() => {
                                    expect(this.files.read('b.txt')).toBeRejected(done);
                                }, done.fail);
                            });
                        });
                    });

                    it('even if there are unpushed files', function(done) {
                        this.rec.push('a')
                            .then(() => this.files.write('b.txt', 'more stuff'))
                            .then(() => this.rec.push('b'))
                            .then(() => this.files.write('c.txt', 'even more stuff'))
                            .then(() => {
                            expect(this.files.read('c.txt')).toBeResolved(() => {
                                this.rec.pop().then(() => {
                                    expect(this.files.read('c.txt')).toBeRejected(done);
                                }, done.fail);
                            });
                        });
                    });
                });
            });
        });
    });

    describe('when to is called', function() {
        describe('and no value is passed in', function() {
            it('it errors', function(done) {
                expect(this.rec.to()).toBeRejectedWith('Label is required and must be a string', done);
            });
        });

        describe('and a value which isn\'t a string is passed in', function() {
            it('it errors', function(done) {
                expect(this.rec.to(new Date())).toBeRejectedWith('Label is required and must be a string', done);
            });
        });

        describe('and a string is passed in', function() {
            describe('and the string is not a valid recover label', function() {
                it('it errors', function(done) {
                    expect(this.rec.to('notavalidlabel')).toBeRejectedWith('Unrecognised label', done);
                });
            });

            describe('and the string is a valid recover label', function() {
                beforeEach(function(done) {
                    this.files.write('a.txt', 'some text')
                        .then(() => this.rec.push('a'))
                        .then(() => this.files.write('b.txt', 'more stuff'))
                        .then(() => this.rec.push('b'))
                        .then(() => this.files.write('c.txt', 'even more stuff'))
                        .then(() => this.rec.push('c'))
                        .then(done, done);
                });

                it('it restores the folder to its previous state', function(done) {
                    expect(this.files.read('c.txt')).toBeResolved(() => {
                        this.rec.to('b')
                            .then(() => {
                                expect(this.files.read('c.txt')).toBeRejected(done);
                            }, done.fail);
                    });
                });

                describe('and content is then changed', function() {
                    beforeEach(function(done) {
                        this.rec.to('b')
                            .then(() => this.files.write('d.txt', 'some more stuff'))
                            .then(done, done.fail);
                    });

                    describe('and push is called', function() {
                        beforeEach(function(done) {
                            this.rec.push('d').then(done, done.fail);
                        });

                        it('it does not restore the folder to its previous state', function(done) {
                            expect(this.files.read('d.txt')).toBeResolved(done);
                        });

                        describe('and pop is called', function() {
                            beforeEach(function(done) {
                                this.rec.pop().then(done, done.fail);
                            });

                            it('it restores the folder to its previous state', function(done) {
                                expect(this.files.read('d.txt')).toBeRejected(done);
                            });
                        });

                        describe('and then we try to go to a recover point which has been destroyed', function() {
                            it('it errors', function(done) {
                                expect(this.rec.to('c')).toBeRejectedWith('Unrecognised label', done);
                            });
                        });
                    });
                });
            });
        });
    });

    describe('when reset is called', function() {
        beforeEach(function(done) {
            this.files.write('a.txt', 'some text')
                .then(() => this.rec.push('a'))
                .then(() => this.files.write('b.txt', 'more stuff'))
                .then(() => this.rec.push('b'))
                .then(done, done.fail);
        });

        it('it resets any changes since the current version', function(done) {
            this.files.write('c.txt', 'some more text')
                .then(() => this.files.read('c.txt'))
                .then(() => this.rec.reset())
                .then(() => {
                    expect(this.files.read('c.txt')).toBeRejected(done);
                }, done.fail);
        });

        describe('and we\'re not at the latest version', function() {
            beforeEach(function(done) {
                this.rec.to('a')
                    .then(() => this.files.read('b.txt'), done.fail)
                    .then(done.fail, done);
            });

            it('it resets any changes since the current version', function(done) {
                this.files.write('c.txt', 'some more text')
                    .then(() => this.files.read('c.txt'))
                    .then(() => this.files.write('a.txt', 'some different text'))
                    .then(() => this.rec.reset())
                    .then(() => {
                        expect(this.files.read('c.txt')).toBeRejected(() => {
                            expect(this.files.read('a.txt'))
                                .toBeResolvedWith('some text', done);
                        });
                    }, done.fail);
            });

            describe('and we try to go to a future commit', function() {
                it('it works and restores the folder content', function(done) {
                    this.files.write('c.txt', 'some more text')
                        .then(() => this.files.read('c.txt'))
                        .then(() => this.files.write('a.txt', 'some different text'))
                        .then(() => this.rec.reset())
                        .then(() => this.files.read('c.txt'))
                        .then(done.fail, () => this.files.read('b.txt'))
                        .then(done.fail, () => this.rec.to('b'))
                        .then(() => this.files.read('b.txt'))
                        .then(done, done.fail);
                });
            });
        });
    });
});
