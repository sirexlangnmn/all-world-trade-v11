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



exports.getWaitingRoom = async (req, res) => {
    console.log('controller getWaitingRoom called');
    const latestWaitingRoom = await WaitingRooms.findOne({
        order: [['createdAt', 'DESC']],
        attributes: ['waiting_room'],
    });

    const communicator_link = latestWaitingRoom ? latestWaitingRoom.get('waiting_room') : null;
    console.log('controller getWaitingRoom communicator_link', communicator_link);

    res.send({ communicator_link });
};



exports.checkIfTraderIsActive = async (req, res) => {
    try {
        const hashedUuid = req.session.user?.uuid;
        const visitorUuid = ecdc.decryptUuid(hashedUuid);
        const traderUuid = req.body.trader_uuid;

        const queryObject = { uuid: traderUuid };

        const data = await Users_accounts.findOne({
            where: queryObject,
            attributes: ['login_Status'],
        });

        if (data) {

            const recordTradersVisitorsRes = await recordTradersVisitors(visitorUuid, traderUuid);
            console.log('Record recordTradersVisitorsRes:', recordTradersVisitorsRes);

            const loginStatus = data.get('login_Status'); // Extract the login_Status value
            console.log(`controller checkIfTraderIsActive response::: `, loginStatus);

            if (loginStatus == 1) {
                res.send({ isActive: loginStatus });
            } else {
                const latestWaitingRoom = await Waiting_rooms.findOne({
                    order: [['createdAt', 'DESC']],
                    attributes: ['waiting_room'],
                });

                const communicatorAWT = latestWaitingRoom ? latestWaitingRoom.get('waiting_room') : null;
                console.log('controller checkIfTraderIsActive communicatorAWT', communicatorAWT);

                res.send({ isActive: communicatorAWT });
            }
            // else {
            //     const queryObject = { uuid: '61f980d3-3f7e-43bd-9ff3-87dd4276f981' };

            //     const userAccounts = await Users_businesses.findOne({
            //         where: queryObject,
            //         attributes: ['communicator'],
            //     });

            //     const communicatorAWT = userAccounts.get('communicator');
            //     console.log('controller checkIfTraderIsActive communicatorAWT', communicatorAWT);

            //     res.send({ isActive: communicatorAWT });
            // }
        } else {
            console.log('controller checkIfTraderIsActive response::: Trader not found');
        }
    } catch (error) {
        console.error('Error in checkIfTraderIsActive:', error);
    }
};