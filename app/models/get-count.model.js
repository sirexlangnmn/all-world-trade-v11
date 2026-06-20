const sql = require('./db.js');

const Model = function (model) {
    // code here
};

Model.tradersWithPicture = (result) => {
    let query = `SELECT users_accounts.uuid, users_accounts.email_or_social_media, users_accounts.type, users_businesses.business_name
    FROM users_accounts
    JOIN users_businesses ON users_accounts.uuid = users_businesses.uuid
    JOIN users_business_medias ON users_accounts.uuid = users_business_medias.uuid
    WHERE users_accounts.type = 1 AND (users_business_medias.banner IS NOT NULL AND users_business_medias.banner <> '');`;

    sql.query(query, (err, res) => {
        if (err) {
            result(null, err);
            return;
        }

        result(null, res);
    });
};

Model.tradersWithNoPicture = (result) => {
    let query = `SELECT users_accounts.uuid, users_accounts.email_or_social_media, users_accounts.type, users_businesses.business_name
    FROM users_accounts
    JOIN users_businesses ON users_accounts.uuid = users_businesses.uuid
    JOIN users_business_medias ON users_accounts.uuid = users_business_medias.uuid
    WHERE users_accounts.type = 1 AND (users_business_medias.banner = '' OR users_business_medias.banner IS NULL);`;

    sql.query(query, (err, res) => {
        if (err) {
            result(null, err);
            return;
        }

        result(null, res);
    });
};

Model.tradersWithNoPictureAndCompany = (result) => {
    let query = `SELECT accounts.uuid, accounts.email_or_social_media, accounts.type
    FROM users_accounts accounts
    LEFT JOIN users_business_medias medias
    ON accounts.uuid = medias.uuid
    WHERE accounts.type = 1 AND medias.uuid IS NULL;`;

    sql.query(query, (err, res) => {
        if (err) {
            result(null, err);
            return;
        }

        result(null, res);
    });
};

module.exports = Model;
