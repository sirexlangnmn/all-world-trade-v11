const sql = require('./db.js');
const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;

const Model = function (data) {
    const bytes = CryptoJS.AES.decrypt(data.uuid, JWT_SECRET);
    const originalUuid = bytes.toString(CryptoJS.enc.Utf8);

    this.uuid = originalUuid;

    // users
    this.first_name = data.first_name;
    this.last_name = data.last_name;
    this.middle_name = data.middle_name;

    // users_address
    this.country = data.country;
    this.state_or_province = data.state_or_province;
    this.city = data.city;

    // users_accounts
    this.social_media_contact_type = data.social_media_contact_type;
    this.contact_number = data.contact_number;

    // users_business
    this.business_language_of_communication =
        data.editLanguagesOfCommunication === undefined
            ? data.currentLanguagesOfCommunication
            : data.editLanguagesOfCommunication.toString(); //new
};

Model.update = (data, result) => {
    // users_business
    const usersData = [data.first_name, data.last_name, data.middle_name, data.uuid];

    // users_address
    const usersAddressData = [data.country, data.state_or_province, data.city, data.uuid];

    //users_accounts
    const usersAccountsData = [data.social_media_contact_type, data.contact_number, data.uuid];

    // users_business
    const usersBusinessData = [data.business_language_of_communication, data.uuid];

    const usersQuery = `UPDATE users SET 
        first_name = ?, 
        last_name = ?, 
        middle_name = ?
        WHERE uuid = ?`;

    const usersAddressQuery = `UPDATE users_address SET 
        country = ?, 
        state_or_province = ?, 
        city = ?
        WHERE uuid = ?`;

    const usersAccountsQuery = `UPDATE users_accounts SET 
        social_media_contact_type = ?, 
        contact_number = ?
        WHERE uuid = ?`;

    const usersBusinessQuery = `UPDATE users_businesses SET 
        business_language_of_communication = ?
        WHERE uuid = ?`;

    /* Begin transaction */
    sql.beginTransaction(function (err) {
        if (err) {
            throw err;
        }

        sql.query(usersQuery, usersData, function (err, rows) {
            if (err) {
                sql.rollback(function () {
                    throw err;
                });
            } else {
                sql.query(usersAddressQuery, usersAddressData, (err, rows) => {
                    if (err) {
                        sql.rollback(function () {
                            throw err;
                        });
                    } else {
                        sql.query(usersBusinessQuery, usersBusinessData, (err, rows) => {
                            if (err) {
                                sql.rollback(function () {
                                    throw err;
                                });
                            } else {
                                sql.query(usersAccountsQuery, usersAccountsData, (err, rows) => {
                                    if (err) {
                                        sql.rollback(function () {
                                            throw err;
                                        });
                                    } else {
                                        sql.commit(function (err) {
                                            if (err) {
                                                sql.rollback(function () {
                                                    throw err;
                                                });
                                            } else {
                                                result(null, { id: rows.insertId, ...data });
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    });
    /* End transaction */
};

module.exports = Model;
