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
                it('it restores the folder to its previous state', function() {

                });
            });
        });
    });

    describe('when to is called', function() {
        describe('and no value is passed in', function() {
            it('it errors', function() {

            });
        });

        describe('and a value which isn\'t a string is passed in', function() {
            it('it errors', function() {

            });
        });

        describe('and a string is passed in', function() {
            describe('and the string is not a valid recover label', function() {
                it('it errors', function() {

                });
            });

            describe('and the string is a valid recover label', function() {
                it('it restores the folder to its previous state', function() {

                });

                describe('amd content is then changed', function() {
                    describe('and push is called', function() {
                        it('it does not restore the folder to its previous state', function() {

                        });

                        describe('and pop is called', function() {
                            it('it restores the folder to its previous state', function() {

                            });
                        });

                        describe('and then we try to go to a recover point which has been destroyed', function() {
                            it('it errors', function() {

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
