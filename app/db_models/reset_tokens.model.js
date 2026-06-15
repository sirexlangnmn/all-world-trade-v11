module.exports = (sequelize, Sequelize) => {
    const Reset_tokens = sequelize.define('reset_tokens', {
        token: {
            type: Sequelize.TEXT('long'),
        },
        expiration: {
            type: Sequelize.DATE,
        },
        used: {
            type: Sequelize.TINYINT,
        },
        uuid: {
            type: Sequelize.STRING,
        },
    });

    return Reset_tokens;
};
