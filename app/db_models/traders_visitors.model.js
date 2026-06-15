module.exports = (sequelize, Sequelize) => {
    const Traders_visitors = sequelize.define('traders_visitors', {
        trader_id: {
            type: Sequelize.STRING,
        },
        visitor_id: {
            type: Sequelize.STRING,
        },
        date_created: {
            type: Sequelize.DATE,
        },
    });

    return Traders_visitors;
};
