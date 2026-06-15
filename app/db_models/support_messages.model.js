module.exports = (sequelize, Sequelize) => {
    const Support_messages = sequelize.define('support_messages', {
        email_address: {
            type: Sequelize.STRING,
        },
        messages: {
            type: Sequelize.TEXT('long'),
        },
    });

    return Support_messages;
};
