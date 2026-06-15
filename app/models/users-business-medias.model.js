const sql = require('./db.js');
const USERS_BUSINESS_MEDIAS = require('../query/users_business_medias.query.js');
const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;

// constructor
const Tutorial = function (tutorial) {};

Tutorial.getAll = (uuid, result) => {
    let query = 'SELECT id, brochure, brochure_title FROM users_business_medias';

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

Tutorial.companiesProfilePicture = (companyID, companyUUID, result) => {
    console.log('companiesProfilePicture companyUUID: ', companyUUID);
    const bytes = CryptoJS.AES.decrypt(companyUUID, JWT_SECRET);
    const originalUuid = bytes.toString(CryptoJS.enc.Utf8);

    if (originalUuid) {
        let query = `SELECT banner FROM users_business_medias WHERE uuid = '${originalUuid}'`;

        sql.query(query, (err, res) => {
            if (err) {
                result(null, err);
                return;
            }

            result(null, res);
        });
    }
};

Tutorial.companiesProfilePictureInSelection = (companyID, companyUUID, result) => {
    if (companyUUID) {
        let query = `SELECT banner FROM users_business_medias WHERE uuid = '${companyUUID}'`;

        sql.query(query, (err, res) => {
            if (err) {
                result(null, err);
                return;
            }

            result(null, res);
        });
    }
};

module.exports = Tutorial;
