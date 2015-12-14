'use strict';

const fs = require('fs'),
    path = require('path');

module.exports = function(folder) {
    return {
        write(file, data) {
            return new Promise((res, rej) => {
                fs.writeFile(path.resolve(folder, file), data, (err) => {
                    if(err) {
                        return rej(err);
                    }
                    res();
                });
            });
        },
        read(file) {
            return new Promise((res, rej) => {
                fs.readFile(path.resolve(folder, file), 'utf8', (err, data) => {
                    if(err) {
                        return rej(err);
                    }
                    res(data);
                });
            });
        }
    }
};
