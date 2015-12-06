exports.push = function(label) {
    console.log('push: %s', label);
};

exports.pop = function() {
    console.log('pop');
};

exports.reset = function() {
    console.log('reset');
};

exports.to = function(label) {
    console.log('to: %s', label);
};
