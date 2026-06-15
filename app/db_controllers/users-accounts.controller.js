const db = require('../db_models');
const ecdc = require('../shared/ecdc.js');
const sequelizeConfig = require('../config/sequelize.config.js');

const Users_accounts = db.users_accounts;
const Users_businesses = db.users_businesses;

const Op = db.Sequelize.Op;

exports.numberOfVisitorMembers = async (req, res) => {
    const getRows = await Users_accounts.findAll()
        .then((data) => {
            res.send(data);
        })
        .catch((err) => {
            return 'Some error occurred while retrieving number Of Trader Members.';
        });
};

exports.tradersData = async (req, res) => {
    const traders = { type: 1 };
    const large_scale = { type: 2 };
    const medium_scale = { type: 3 };
    const small_scale = { type: 4 };

    const smallScale = await Users_accounts.findAll({ where: small_scale });
    const mediumScale = await Users_accounts.findAll({ where: medium_scale });
    const largeScale = await Users_accounts.findAll({ where: large_scale });
    const Alltraders = await Users_accounts.findAll({ where: traders });

    let data = [];
    data = {
        'Number of Small Scale: ': smallScale.length,
        'Number of Medium Scale: ': mediumScale.length,
        'Number of Large Scale: ': largeScale.length,
        'Number of Trader: ': Alltraders.length,
        'All: ': Alltraders.length + smallScale.length + mediumScale.length + largeScale.length,
    };

    res.send(data);
};

// exports.checkIfTraderIsActive = async (req, res) => {
//     const traderUuid = { uuid: req.body.trader_uuid };
//     const data = await Users_accounts.findOne({
//             where: traderUuid,
//             attributes: ['login_Status']
//         });
//     console.log(`controller checkIfTraderIsActive response::: `, data.login_Status)
//     res.send(data.login_Status);
// };

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
                const queryObject = { uuid: '61f980d3-3f7e-43bd-9ff3-87dd4276f981' };

                const userAccounts = await Users_businesses.findOne({
                    where: queryObject,
                    attributes: ['communicator'],
                });

                const communicatorAWT = userAccounts.get('communicator');
                console.log('controller checkIfTraderIsActive communicatorAWT', communicatorAWT);

                res.send({ isActive: communicatorAWT });
            }
        } else {
            console.log('controller checkIfTraderIsActive response::: Trader not found');
        }
    } catch (error) {
        console.error('Error in checkIfTraderIsActive:', error);
    }
};


async function recordTradersVisitors(visitorUuid, traderUuid) {
    const Traders_visitors = db.traders_visitors;

    const parameters = {
        visitor_id: visitorUuid,
        trader_id: traderUuid,
    };

    console.log('recordTradersVisitors parameters:::', parameters);

    try {
        const result = await Traders_visitors.create(parameters);

        if (!result) {
            console.log('Insert failed');
            return false;
        }

        console.log('Visitor recorded successfully');
        return true;

    } catch (error) {
        console.error('Error recording visitor:', error);
        return false;
    }
}
