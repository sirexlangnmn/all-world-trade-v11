module.exports = (sequelize, Sequelize) => {
    const Users_address = sequelize.define('users_address', {
        address: {
            type: Sequelize.STRING,
        },
        country: {
            type: Sequelize.STRING,
        },
        state_or_province: {
            type: Sequelize.STRING,
        },
        city: {
            type: Sequelize.STRING,
        },
        uuid: {
            type: Sequelize.STRING,
        },
    });

    return Users_address;
};
