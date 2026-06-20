const db = require('../db_models');
const sequelizeConfig = require('../config/sequelize.config.js');

const Support_links = db.support_links;
const Users_businesses = db.users_businesses;

const Op = db.Sequelize.Op;

exports.findCommunicator = async (req, res) => {
    // console.log('req.params', req.params.link);
    let paramsLink = req.params.link;

    var supportLinksCondition = paramsLink ? { communicator_link: { [Op.like]: `%${paramsLink}%` }, status: 0 } : null;
    var usersBusinessesCondition = paramsLink ? { communicator: { [Op.like]: `%${paramsLink}%` } } : null;

    const getRowsInSupporLinks = await Support_links.findAll({ where: supportLinksCondition })
        .then((data) => {
            return data;
        })
        .catch((err) => {
            console.log('Some error occurred while retrieving tutorials.');
            return 'Some error occurred while retrieving tutorials.';
        });

    const getRowsInUsersBusinesses = await Users_businesses.findAll({ where: usersBusinessesCondition })
        .then((data) => {
            return data;
        })
        .catch((err) => {
            console.log('Some error occurred while retrieving tutorials.');
            return 'Some error occurred while retrieving tutorials.';
        });

    if (getRowsInSupporLinks.length > 0 || getRowsInUsersBusinesses.length > 0) {
        let data = { message: 'valid' };
        res.send(data);
    } else {
        let data = { message: 'not_found' };
        res.send(data);
    }
};

// exports.peersCount = async (req, res) => {
//     let peersCount = req.params.peers_count;
//     let strippedRoomId = req.params.strippedRoomId;

//     console.log('controller peersCount : ', peersCount)
//     console.log('controller strippedRoomId : ', strippedRoomId)
// };

const updatePeersCount = async (communicator, peers_count) => {
    try {
        return await Users_businesses.update({ peers_count: peers_count }, { where: { communicator } });
    } catch (error) {
        throw new Error(`Error updating peers count: ${error.message}`);
    }
};

exports.peersCount = async (req, res) => {
    const peersCount = req.params.peers_count;
    const strippedRoomId = req.params.strippedRoomId;

    console.log('controller peersCount : ', peersCount);
    console.log('controller strippedRoomId : ', strippedRoomId);

    try {
        const [rowCount] = await updatePeersCount(strippedRoomId, peersCount);

        if (rowCount > 0) {
            console.log('Peers count updated successfully');
            res.status(200).send('Peers count updated successfully');
        } else {
            console.log('No matching business found for the given roomI');
            res.status(404).send('No matching business found for the given roomId');
        }
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Error updating peers count');
    }
};
