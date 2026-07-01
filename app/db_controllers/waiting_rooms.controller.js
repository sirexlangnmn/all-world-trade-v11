const db = require('../db_models/index.js');
const sequelizeConfig = require('../config/sequelize.config.js');
const WaitingRooms = db.waiting_rooms;
const Op = db.Sequelize.Op;
const { v4: uuidV4 } = require('uuid');

exports.generateWaitingRoom = async (req, res) => {
    const uuid = uuidV4();
    console.log('generateWaitingRoom called');
    console.log('generateWaitingRoom uuid:', uuid);

    try {
        const waitingRoom = await WaitingRooms.create({ waiting_room: uuid });
        console.log('generateWaitingRoom created:', waitingRoom.toJSON());
        res.status(201).json({ success: true, uuid });
    } catch (error) {
        console.error('generateWaitingRoom error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

