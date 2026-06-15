module.exports = (sequelize, Sequelize) => {
    const Users_accounts = sequelize.define('users_accounts', {
        email_or_social_media: {
            type: Sequelize.STRING,
        },
        social_media_contact_type: {
            type: Sequelize.TINYINT,
        },
        contact_number: {
            type: Sequelize.STRING,
        },
        password: {
            type: Sequelize.STRING,
        },
        type: {
            type: Sequelize.TINYINT,
        },
        status: {
            type: Sequelize.TINYINT,
        },
        verification_code: {
            type: Sequelize.STRING,
        },
        login_status: {
            type: Sequelize.TINYINT,
        },
        uuid: {
            type: Sequelize.STRING,
        },
    });

    return Users_accounts;
};
