// /middleware/helmet.js

const helmet = require('helmet');
let { lodashNonce } = require('../nonces');

module.exports = helmet({
    contentSecurityPolicy: {
        directives: {
            scriptSrc: [
                "'strict-dynamic'", // For nonces to work
                `'nonce-${lodashNonce}'`,
            ],
            scriptSrcAttr: null, // Remove Firefox warning
            styleSrc: ["'self'", 'https:'], // Remove 'unsafe-inline'
        },
    },
});
