const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;

const ecdc = {};

ecdc.decryptUuid = (encryptedUuid) => {
    const bytes = CryptoJS.AES.decrypt(encryptedUuid, JWT_SECRET);
    return bytes.toString(CryptoJS.enc.Utf8);
};

module.exports = ecdc;
