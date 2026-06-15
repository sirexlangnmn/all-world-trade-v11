const db = require('../db_models');
const sequelizeConfig = require('../config/sequelize.config.js');

const Users_businesses = db.users_businesses;
const Users_accounts = db.users_accounts;

const Op = db.Sequelize.Op;

exports.numberOfTraderMembers = async (req, res) => {
    let condition = { type: 1 };

    const getRows = await Users_accounts.findAll({
        where: condition,
    })
        .then((data) => {
            res.send(data);
        })
        .catch((err) => {
            return 'Some error occurred while retrieving number Of Trader Members.';
        });
};
