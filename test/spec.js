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

    beforeEach(function(done) {
        let _this = this;

        temp.mkdir('recover_test', function(err, target) {
            if(err) {
                throw err;
            }

            temp.mkdir('recover_test', function(err2, gitdir) {
                if(err2) {
                    throw err2;
                }

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
            if(err) {
                throw err;
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
                        let _this = this;

                        expect(this.rec.push('a')).toBeResolved(_ => {
                            expect(_this.rec.push('a')).toBeRejectedWith('Label already in use', done);
                        });
                    });
                });

                describe('and the label has not already been used', function() {
                    it('it doesn\'t error', function(done) {
                        let _this = this;
                        expect(this.rec.push('a')).toBeResolved(_ => {
                            expect(_this.rec.push('b')).toBeResolved(done);
                        });
                    });
                });
            });

            describe('and pop is subsequently called', function() {
                it('it errors, since you can\'t pop the first push', function(done) {
                    // First push inits the repo
                    this.rec.push('a')
                        .then(() => {
                        expect(this.files.read('a.txt')).toBeResolved(() => {
                            expect(this.rec.pop()).toBeRejected(done);
                        });
                    });
                });
            });

            describe('and push is called again', function() {
                describe('and pop is subsequently called', function() {
                    it('it restores the folder to its initial state', function(done) {
                        // First push inits the repo
                        this.rec.push('a')
                            .then(() => this.files.write('b.txt', 'more stuff'))
                            // Second push is the first 'poppable' push
                            .then(() => this.rec.push('b'))
                            .then(() => {
                            expect(this.files.read('b.txt')).toBeResolved(() => {
                                this.rec.pop().then(() => {
                                    expect(this.files.read('b.txt')).toBeRejected(done);
                                }, console.log.bind(console));
                            });
                        });
                    });

                    it('even if there are unpushed files', function(done) {
                        // First push inits the repo
                        this.rec.push('a')
                            .then(() => this.files.write('b.txt', 'more stuff'))
                            // Second push is the first 'poppable' push
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
                        // Second push is the first 'poppable' push
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
                            .then(done, done);
                    });

                    describe('and push is called', function() {
                        beforeEach(function(done) {
                            this.rec.push('d').then(done, done);
                        });

                        it('it does not restore the folder to its previous state', function(done) {
                            expect(this.files.read('d.txt')).toBeResolved(done);
                        });

                        describe('and pop is called', function() {
                            beforeEach(function(done) {
                                this.rec.pop().then(done, done);
                            });

                            it('it restores the folder to its previous state', function(done) {
                                expect(this.files.read('d.txt')).toBeRejected(done);
                            });
                        });

                        describe('and then we try to go to a recover point which has been destroyed', function() {
                            it('it errors', function() {
                                expect(this.rec.to('c')).toBeRejectedWith('Unrecognised label');
                            });
                        });
                    });

                    describe('and reset is called', function() {
                        it('it restores the folder to its previous state', function() {
                            expect(1).toBe(1);
                        });
                    });
                });
            });
        });
    });
});
