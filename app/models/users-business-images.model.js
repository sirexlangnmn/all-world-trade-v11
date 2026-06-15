const sql = require('./db.js');
const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;

// constructor
const Tutorial = function (tutorial) {};

Tutorial.getAll = (uuid, result) => {
    let query = 'SELECT * FROM users_business_medias';

    const bytes = CryptoJS.AES.decrypt(uuid, JWT_SECRET);
    const originalUuid = bytes.toString(CryptoJS.enc.Utf8);

    // console.log('Tutorial.getAll originalUuid', originalUuid);

    if (originalUuid) {
        query += ` WHERE uuid = "${originalUuid}"`;
    }

    sql.query(query, (err, res) => {
        if (err) {
            result(null, err);
            return;
        }

        result(null, res);
    });
};

module.exports = Tutorial;
