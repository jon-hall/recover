'use strict';

describe('recover', function() {
    describe('when push is called', function() {
        describe('and no value is passed in', function() {
            it('it should return the label created', function() {

            });
        });

        describe('with a value which isn\'t a string is passed in', function() {
            it('it errors', function() {

            });
        });


        describe('and a string is passed in', function() {
            describe('and the label has already been used', function() {
                it('it returns false', function() {

                });
            });

            describe('and the label has not already been used', function() {
                it('it returns true', function() {

                });
            });
        });

        describe('and pop is subsequently called', function() {
            it('it restores the folder to its previous state', function() {

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
