// Determining if crypto support is unavailable
let crypto;
try {
    crypto = require('crypto');
} catch (err) {
    console.log('crypto support is disabled!');
}

// Generating a nonce for Lodash with crypto
let lodashNonce = crypto.randomBytes(16).toString('hex');

// Maybe you'll have some other later
module.exports = { lodashNonce };
