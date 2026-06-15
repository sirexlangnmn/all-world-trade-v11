const sql = require('./db.js');
const bcrypt = require('bcrypt');
const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;

const Model = function (model) {
    console.log('model', model);
    this.email_or_social_media = model.email_or_social_media;
    // this.email_or_social_media = "a.dimaano.awt@gmail.com"
    this.password = model.password;
    this.session = model.session;
};

function phTime() {
    const now = new Date();

    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(now);

    const get = (type) => parts.find((p) => p.type === type).value;

    const phTime = `${get('year')}-${get('month')}-${get('day')} ` + `${get('hour')}:${get('minute')}:${get('second')}`;

    return phTime;
}

Model.create = (newModel, result) => {
    //const usersAccountsQuery = `SELECT id, uuid, email_or_social_media, password, type FROM users_accounts WHERE email_or_social_media = "${newModel.email_or_social_media}"`;
    console.log('newModel', newModel);
    const usersAccountsQuery = `SELECT password FROM users_accounts WHERE email_or_social_media = "${newModel.email_or_social_media}"`;

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
                const usersAccountsQuery = `SELECT 
                    users_accounts.id, 
                    users_accounts.uuid, 
                    users_accounts.email_or_social_media, 
                    users_accounts.password, 
                    users_accounts.type, 
                    users.first_name, 
                    users.last_name,
                    users_addresses.country,
                    users_addresses.state_or_province
                    FROM users_accounts
                    INNER JOIN users 
                    ON users.uuid = users_accounts.uuid 
                    INNER JOIN users_addresses 
                    ON users_addresses.uuid = users_accounts.uuid 
                    WHERE users_accounts.email_or_social_media = "${newModel.email_or_social_media}"`;

                sql.query(usersAccountsQuery, (err, res) => {
                    if (err) {
                        result(err, null);
                        return;
                    }

                    let UuidToBeEncrypt = res[0].uuid;
                    const cipherUuid = CryptoJS.AES.encrypt(UuidToBeEncrypt, JWT_SECRET).toString();

                    let sessionUser = {
                        uuid: cipherUuid,
                        email_or_social_media: res[0].email_or_social_media,
                        type: res[0].type,
                        first_name: res[0].first_name,
                        last_name: res[0].last_name,
                        country: res[0].country,
                        state_or_province: res[0].state_or_province,
                    };

                    if (res.length) {
                        let insertSessionQuery = `INSERT INTO user_sessions (user_id, login_at) VALUES (?, ?)`;

                        // const phTime = new Date().toLocaleString("en-GB", {
                        //     timeZone: "Asia/Manila"
                        // });

                        sql.query(insertSessionQuery, [UuidToBeEncrypt, phTime()], (insertErr, insertRes) => {
                            if (insertErr) {
                                console.log('user_sessions insert error ::: ', insertErr);
                            }
                            console.log('user_sessions login_at inserted');
                        });

                        // update login status
                        let updateQuery = `UPDATE users_accounts SET login_status = ? WHERE uuid = ?`;

                        // Execute the update query with parameters
                        sql.query(updateQuery, [1, UuidToBeEncrypt], (updateErr, updateRes) => {
                            if (updateErr) {
                                // result(updateErr, null);
                                // return;
                                console.log('login status update error ::: ', updateErr);
                            }
                            // result(null, { message: 'found and updated' });
                            console.log('login status updated');
                        });

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

function ec(dataToBeEncrypt) {
    let dataToBeEncryptx = 31;
    const ciphertext = CryptoJS.AES.encrypt(dataToBeEncryptx, JWT_SECRET).toString();
    return ciphertext;
}

module.exports = Model;
