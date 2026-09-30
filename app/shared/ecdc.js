const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;

const ecdc = {};

// Byte-compatible with every UUID already sitting in a live session and with
// the inline CryptoJS.AES.encrypt(uuid, JWT_SECRET).toString() that
// app/models/login.model.js used to perform. Never change the algorithm here:
// every req.session.user.uuid in the app is decrypted with decryptUuid.
ecdc.encryptUuid = (uuid) => CryptoJS.AES.encrypt(uuid, JWT_SECRET).toString();

ecdc.decryptUuid = (encryptedUuid) => {
    const bytes = CryptoJS.AES.decrypt(encryptedUuid, JWT_SECRET);
    return bytes.toString(CryptoJS.enc.Utf8);
};

module.exports = ecdc;
