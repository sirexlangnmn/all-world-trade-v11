const { Config } = require('tailwindcss');

const config = {
    mode: 'jit',
    content: ['./public/**/*.ejs', './public/**/*.html', './public/**/*.js'],
    theme: {
        extend: {},
    },
    plugins: [],
};

module.exports = config;
