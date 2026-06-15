const sql = require('./db.js');
const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;

// constructor
const Tutorial = function (tutorial) {};

Tutorial.getAll = (uuid, result) => {
    let query = 'SELECT * FROM users_accounts';

    const bytes = CryptoJS.AES.decrypt(uuid, JWT_SECRET);
    const originalUuid = bytes.toString(CryptoJS.enc.Utf8);

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

Tutorial.emailVerification = (registration_uuid, verification_code, inputCode, result) => {
    let query = 'SELECT verification_code FROM users_accounts';

    if (registration_uuid) {
        query += ` WHERE uuid = "${registration_uuid}"`;
    }

    sql.query(query, (err, res) => {
        if (err) {
            result(null, err);
            return;
        } else {
            if (res[0].verification_code == inputCode) {
                const usersAccountsData = [1, registration_uuid];
                const usersAccountsQuery = `UPDATE users_accounts SET status = ? WHERE uuid = ?`;

                sql.query(usersAccountsQuery, usersAccountsData, (err, res) => {
                    if (err) {
                        result(null, err);
                        return;
                    } else {
                        // result(null, { id: res.insertId });
                        result(null, 'valid');
                    }
                });
            } else {
                result(null, 'not_valid');
            }
        }
    });
};

module.exports = Tutorial;
