module.exports = (sequelize, Sequelize) => {
    const User_download_histories = sequelize.define('user_download_histories', {
        user_id: {
            type: Sequelize.STRING,
        },
        trader_id: {
            type: Sequelize.STRING,
        },
        download_at: {
            type: Sequelize.STRING,
        },
    });

    return User_download_histories;
};
