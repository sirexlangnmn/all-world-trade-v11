const sql = require('./db.js');
const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;

const Model = function (model) {
    const bytes = CryptoJS.AES.decrypt(model.uuid, JWT_SECRET);
    const originalUuid = bytes.toString(CryptoJS.enc.Utf8);
    this.uuid = originalUuid;

    // users
    this.first_name = model.first_name;
    this.last_name = model.last_name;
    this.middle_name = model.middle_name;

    // users_accounts
    //this.email_or_social_media = model.email_or_social_media;
    this.social_media_contact_type = model.social_media_contact_type;
    this.contact_number = model.contact_number;

    // users_address
    this.country = model.country;
    this.state_or_province = model.state_or_province;
    this.city = model.city;

    // // users_business
    this.business_name = model.business_name;
    this.business_email = model.business_email;
    this.business_contact = model.business_contact;
    this.business_language_of_communication =
        model.editLanguagesOfCommunication === undefined
            ? model.currentLanguagesOfCommunication
            : model.editLanguagesOfCommunication.toString(); //new

    // users_business_media / users_business
    this.business_website = model.business_website;
    this.business_social_media_contact_type = model.business_social_media_contact_type;
    this.business_social_media_contact_number = model.business_social_media_contact_number;

    // users_business_location / users_business
    this.business_country = model.business_country;
    this.business_states = model.business_states;
    this.business_city = model.business_city;
};

Model.update = (newModel, result) => {
    // users
    const usersData = [newModel.first_name, newModel.last_name, newModel.middle_name, newModel.uuid];

    const usersQuery = `UPDATE users SET 
        first_name = ?, 
        last_name = ?, 
        middle_name = ?
        WHERE uuid = ?`;

    // users_accounts
    const usersAccountsData = [newModel.social_media_contact_type, newModel.contact_number, newModel.uuid];

    const usersAccountsQuery = `UPDATE users_accounts SET 
        social_media_contact_type = ?, 
        contact_number = ?
        WHERE uuid = ?`;

    // users_address
    const usersAddressData = [newModel.country, newModel.state_or_province, newModel.city, newModel.uuid];

    const usersAddressQuery = `UPDATE users_address SET 
        country = ?, 
        state_or_province = ?, 
        city = ?
        WHERE uuid = ?`;

    // users_business
    const usersBusinessData = [
        newModel.business_name,
        newModel.business_email,
        newModel.business_contact,
        newModel.business_language_of_communication,
        newModel.business_website,
        newModel.business_social_media_contact_type,
        newModel.business_social_media_contact_number,
        newModel.business_country,
        newModel.business_states,
        newModel.business_city,
        newModel.uuid,
    ];

    const usersBusinessQuery = `UPDATE users_businesses SET 
        business_name = ?, 
        business_email = ?, 
        business_contact = ?, 
        business_language_of_communication = ?, 
        business_website = ?, 
        business_social_media_contact_type = ?, 
        business_social_media_contact_number = ?,
        business_country = ?, 
        business_states = ?, 
        business_city = ?
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
                sql.query(usersAccountsQuery, usersAccountsData, function (err, rows) {
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
                                        sql.commit(function (err) {
                                            if (err) {
                                                sql.rollback(function () {
                                                    throw err;
                                                });
                                            } else {
                                                result(null, { id: rows.insertId, ...newModel });
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
