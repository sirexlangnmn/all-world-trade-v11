module.exports = (sequelize, Sequelize) => {
    const Support_links = sequelize.define('support_links', {
        communicator_link: {
            type: Sequelize.TEXT('long'),
        },
        support_accounts_uuid: {
            type: Sequelize.STRING,
        },
        users_accounts_uuid: {
            type: Sequelize.STRING,
        },
        isOccupied: {
            type: Sequelize.TINYINT,
        },
        status: {
            type: Sequelize.TINYINT,
        },
    });

    return Support_links;
};
