const sql = require('./db.js');
const { v4: uuidV4 } = require('uuid');
const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;
const USERS_BUSINESS = require('../query/users_business.query.js');

// constructor
const Tutorial = function (tutorial) {};

Tutorial.getAll = (uuid, result) => {
    // let query = 'SELECT * FROM users_businesses';
    let query =
        'SELECT * FROM users_businesses JOIN users_business_characteristics ON users_businesses.uuid = users_business_characteristics.uuid';

    const bytes = CryptoJS.AES.decrypt(uuid, JWT_SECRET);
    const originalUuid = bytes.toString(CryptoJS.enc.Utf8);

    if (originalUuid) {
        query += ` WHERE users_businesses.uuid = "${originalUuid}"`;
    }

    sql.query(query, (err, res) => {
        if (err) {
            result(null, err);
            return;
        }

        result(null, res);
    });
};

Tutorial.getUsersBusiness = (uuid, result) => {
    let query = 'SELECT * FROM users_businesses';
    const originalUuid = CryptoJS.AES.decrypt(uuid, JWT_SECRET).toString(CryptoJS.enc.Utf8);

    if (originalUuid) {
        query += ` WHERE uuid = "${originalUuid}"`;
    }

    sql.query(query, (err, res) => {
        if (err) {
            result(null, err);
            return;
        }

        result(null, res);
    });
};

Tutorial.getBusinessLocationCode = (uuid, result) => {
    let query =
        'SELECT business_country, business_states, business_city, region_of_operation, country_of_operation, country_for_state, states_of_operation, city_of_operation FROM users_businesses';

    const bytes = CryptoJS.AES.decrypt(uuid, JWT_SECRET);
    const originalUuid = bytes.toString(CryptoJS.enc.Utf8);

    if (originalUuid) {
        query += ` WHERE uuid = "${originalUuid}"`;
    }

    sql.query(query, (err, res) => {
        if (err) {
            result(null, err);
            return;
        }

        result(null, res);
    });
};

Tutorial.getAllPublished = (result) => {
    sql.query('SELECT * FROM users_businesses WHERE status=1', (err, res) => {
        if (err) {
            result(null, err);
            return;
        }

        result(null, res);
    });
};

Tutorial.getCommunicator = (params, result) => {
    sql.query(`SELECT communicator FROM users_businesses WHERE communicator = "${params.link}"`, (err, res) => {
        if (err) {
            result(err, null);
            return;
        }

        if (res.length > 0) {
            result(null, { message: 'valid' });
            return;
        }

        // not found Tutorial with the id
        result({ kind: 'not_found' }, null);
    });
};

Tutorial.createCommunicatorLink = (uuid, result) => {
    const communicator_link = uuidV4();
    const linkObject = {
        communicator: communicator_link,
    };

    const bytes = CryptoJS.AES.decrypt(uuid, JWT_SECRET);
    const originalUuid = bytes.toString(CryptoJS.enc.Utf8);

    sql.query(USERS_BUSINESS.UPDATE_COMMUNICATOR_LINK, [...Object.values(linkObject), originalUuid], (err, rows) => {
        if (err) {
            console.log(err);
        } else {
            result(null, { id: rows.insertId, ...linkObject });
        }
    });
};

module.exports = Tutorial;
