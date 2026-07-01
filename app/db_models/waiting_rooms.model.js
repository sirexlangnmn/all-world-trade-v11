module.exports = (sequelize, Sequelize) => {
    const Waiting_rooms = sequelize.define('waiting_rooms', {
        waiting_room: {
            type: Sequelize.STRING,
        },
    });

    return Waiting_rooms;
};
