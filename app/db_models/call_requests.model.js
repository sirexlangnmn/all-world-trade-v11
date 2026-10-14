module.exports = (sequelize, Sequelize) => {
    const Call_requests = sequelize.define(
        'call_requests',
        {
            call_id: {
                type: Sequelize.STRING,
                unique: true,
            },
            caller_uuid: {
                type: Sequelize.STRING,
            },
            receiver_uuid: {
                type: Sequelize.STRING,
            },
            room: {
                type: Sequelize.STRING,
            },
            // 0 ringing, 1 accepted, 2 declined, 3 cancelled, 4 missed, 5 ended
            status: {
                type: Sequelize.TINYINT,
            },
            responded_at: {
                type: Sequelize.DATE,
            },
        },
        {
            tableName: 'call_requests',
        },
    );

    return Call_requests;
};
