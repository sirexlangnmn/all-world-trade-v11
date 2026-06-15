const sql = require('./db.js');
const USERS_ACCOUNTS = require('../query/users_accounts.query.js');

const Model = function (model) {
    this.email_or_social_media = model.email_or_social_media;
    this.session = model.session;
};

Model.create = (newModel, result) => {
    let email = newModel.email_or_social_media;

    sql.query(USERS_ACCOUNTS.GET_BY_EMAIL, [email], (err, res) => {
        if (err) {
            result(null, { message: 'not found' });
            return;
        } else if (res.length > 0) {
            newModel.session.forgotPassword = res[0];
            result(null, {
                message: 'found',
                email_or_social_media: email,
                password: res[0].password,
                uuid: res[0].uuid,
            });
        } else {
            result(null, { message: 'not found' });
        }
    });
};

module.exports = Model;
