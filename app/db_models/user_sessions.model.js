module.exports = (sequelize, Sequelize) => {
    const User_sessions = sequelize.define('user_sessions', {
        user_id: {
            type: Sequelize.STRING,
        },
        login_at: {
            type: Sequelize.DATE,
        },
        logout_at: {
            type: Sequelize.DATE,
        },
    });

    return User_sessions;
};
