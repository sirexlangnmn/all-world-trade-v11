const sql = require('./db.js');

const { v4: uuidV4 } = require('uuid');

const Model = function (model) {
    this.session = model.session;

    // users
    this.first_name = model.first_name;
    this.last_name = model.last_name;
    this.middle_name = model.middle_name;
    this.uuid = uuidV4();

    // users_accounts
    this.email_or_social_media = model.email_or_social_media;
    this.social_media_contact_type = model.business_social_media_contact_type;
    this.contact_number = model.business_social_media_contact_number;
    this.password = model.password;
    this.type = model.type;
    this.verification_code = Math.floor(Math.random() * 900000) + 100000;

    // users_business
    this.business_language_of_communication = model.business_language_of_communication.toString();

    // users_address
    this.country = model.country;
    this.state_or_province = model.state_or_province;
    this.city = model.city;
};

Model.create = (newModel, result) => {
    const usersDataQuery = `INSERT INTO users
    (first_name, last_name, middle_name, uuid) VALUES (?, ?, ?, ?);`;

    const usersBusinessQuery = `INSERT INTO users_businesses
    (user_id, business_language_of_communication, uuid) VALUES (?, ?, ?);`;

    const usersAccountsQuery = `INSERT INTO users_accounts
    (user_id, email_or_social_media, social_media_contact_type, contact_number, password, type, verification_code, uuid) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;

    const usersAddressQuery = `INSERT INTO users_address
    (user_id, country, state_or_province, city, uuid) VALUES (?, ?, ?, ?, ?);`;

    /* Begin transaction */
    sql.beginTransaction(function (err) {
        if (err) {
            throw err;
        }

        // users
        const usersData = [newModel.first_name, newModel.last_name, newModel.middle_name, newModel.uuid];

        sql.query(usersDataQuery, usersData, function (err, rows) {
            //ok
            if (err) {
                sql.rollback(function () {
                    throw err;
                });
            } else {
                // users_accounts
                const usersAccountsData = [
                    rows.insertId,
                    newModel.email_or_social_media,
                    newModel.social_media_contact_type,
                    newModel.contact_number,
                    newModel.password,
                    newModel.type,
                    newModel.verification_code,
                    newModel.uuid,
                ];

                // users_address
                const usersAddressData = [
                    rows.insertId,
                    newModel.country,
                    newModel.state_or_province,
                    newModel.city,
                    newModel.uuid,
                ];

                sql.query(usersAccountsQuery, usersAccountsData, (err, rows) => {
                    //ok
                    if (err) {
                        sql.rollback(function () {
                            throw err;
                        });
                    }
                });

                sql.query(usersAddressQuery, usersAddressData, (err, rows) => {
                    //ok
                    if (err) {
                        sql.rollback(function () {
                            throw err;
                        });
                    }
                });

                //user_business
                const usersBusinessData = [rows.insertId, newModel.business_language_of_communication, newModel.uuid];

                sql.query(usersBusinessQuery, usersBusinessData, function (err, rows) {
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
                                newModel.session.verification_code = newModel.verification_code;
                                newModel.session.registration_uuid = newModel.uuid;
                                newModel.session.registration_email_address = newModel.email_or_social_media;
                                result(null, { id: rows.insertId, ...newModel });
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
