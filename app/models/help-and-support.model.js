const sql = require('./db.js');
const { v4: uuidV4 } = require('uuid');
const SUPPORT_ACCOUNTS = require('../query/support_accounts.query.js');

const Model = function (model) {
    // support_accounts
    this.first_name = model.first_name;
    this.last_name = model.last_name;
    this.email_address = model.email_address;
    this.password = model.password;
    this.uuid = uuidV4();
    this.session = model.session;
};

Model.create = (newModel, result) => {
    /* Begin transaction */
    sql.beginTransaction(function (err) {
        if (err) {
            throw err;
        }

        const usersObject = {
            first_name: newModel.first_name,
            last_name: newModel.last_name,
            email_address: newModel.email_address,
            password: newModel.password,
            uuid: newModel.uuid,
        };

        sql.query(SUPPORT_ACCOUNTS.CREATE, Object.values(usersObject), function (err, rows) {
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
    });
    /* End transaction */
};

module.exports = Model;
