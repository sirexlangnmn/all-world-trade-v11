module.exports = (sequelize, Sequelize) => {
    const Users = sequelize.define('users', {
        first_name: {
            type: Sequelize.STRING,
        },
        last_name: {
            type: Sequelize.STRING,
        },
        middle_name: {
            type: Sequelize.STRING,
        },
        gender: {
            type: Sequelize.TINYINT,
        },
        status: {
            type: Sequelize.TINYINT,
        },
        type: {
            type: Sequelize.TINYINT,
        },
        uuid: {
            type: Sequelize.STRING,
        },
    });

    return Users;
};
