const path = require('path');

module.exports = {
    entry: './public/assets/js/home.js',
    output: {
        filename: 'home.js',
        path: path.resolve(__dirname, './public/assets/js-min'),
    },
    //   mode: 'development',
    mode: 'production',
    optimization: {
        usedExports: true,
    },
};
