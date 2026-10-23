const sql = require('./db.js');
const USERS_ACCOUNTS = require('../query/users_accounts.query.js');

const Model = function (model) {
    this.email_or_social_media = model.email_or_social_media;
};

Model.create = (newModel, result) => {
    const email = newModel.email_or_social_media;

    sql.query(USERS_ACCOUNTS.GET_BY_EMAIL, [email], (err, res) => {
        if (err) {
            result(null, { message: 'not found' });
            return;
        }

        if (res.length > 0) {
            result(null, {
                message: 'found',
                email_or_social_media: email,
                uuid: res[0].uuid,
            });
        } else {
            result(null, { message: 'not found' });
        }
    });
};

module.exports = Model;
