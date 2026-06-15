const sql = require('./db.js');
const bcrypt = require('bcrypt');
const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;

const Model = function (model) {
    this.email_address = model.email_address;
    this.password = model.password;
    this.session = model.session;
};

Model.create = (newModel, result) => {
    const usersAccountsQuery = `SELECT password FROM support_accounts WHERE email_address = "${newModel.email_address}" && status = 1`;
    sql.query(usersAccountsQuery, (err, res) => {
        if (err) {
            result(err, null);
            return;
        }

        if (res.length > 0) {
            let plainPasswordInput = newModel.password;
            let hashedPassword = res[0].password;
            const verified = bcrypt.compareSync(plainPasswordInput, hashedPassword);

            if (verified) {
                const usersAccountsQuery = `SELECT first_name, last_name, email_address, status, uuid FROM support_accounts WHERE email_address = "${newModel.email_address}" && status = 1`;

                sql.query(usersAccountsQuery, (err, res) => {
                    if (err) {
                        result(err, null);
                        return;
                    }

                    let UuidToBeEncrypt = res[0].uuid;
                    const cipherUuid = CryptoJS.AES.encrypt(UuidToBeEncrypt, JWT_SECRET).toString();

                    let sessionUser = {
                        uuid: cipherUuid,
                        email_address: res[0].email_address,
                        status: res[0].status,
                        first_name: res[0].first_name,
                        last_name: res[0].last_name,
                    };

                    if (res.length) {
                        newModel.session.user = sessionUser;
                        result(null, { message: 'found' });
                        return;
                    } else {
                        result(null, { message: 'not found' });
                        return;
                    }
                });
            } else {
                result(null, { message: 'Please check your email address and password' });
                return;
            }
        } else {
            result(null, { message: 'Please check your email address and password' });
            return;
        }
    });
};

module.exports = Model;
