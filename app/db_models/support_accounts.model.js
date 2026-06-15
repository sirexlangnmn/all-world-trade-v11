module.exports = (sequelize, Sequelize) => {
    const Support_accounts = sequelize.define('support_accounts', {
        first_name: {
            type: Sequelize.STRING,
        },
        last_name: {
            type: Sequelize.STRING,
        },
        email_address: {
            type: Sequelize.STRING,
        },
        password: {
            type: Sequelize.STRING,
        },
        status: {
            type: Sequelize.TINYINT,
        },
        uuid: {
            type: Sequelize.STRING,
        },
    });

    return Support_accounts;
};
