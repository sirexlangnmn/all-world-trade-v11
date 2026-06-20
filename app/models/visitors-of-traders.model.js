const sql = require('./db.js');
const CryptoJS = require('crypto-js');
const JWT_SECRET = process.env.JWT_SECRET;
const TRADERS_VISITORS = require('../query/traders_visitors.query.js');
const USERS_ACCOUNTS = require('../query/users_accounts.query.js');
const USERS_ADDRESS = require('../query/users_address.query.js');
const USERS_BUSINESS = require('../query/users_business.query.js');
const USERS_BUSINESS_CHARACTERISTICS = require('../query/users_business_characteristics.query.js');

const Model = function (model) {
    const bytes = CryptoJS.AES.decrypt(model.uuid, JWT_SECRET);
    const originalUuid = bytes.toString(CryptoJS.enc.Utf8);
    this.uuid = originalUuid;
    this.session = model.session;
};

Model.getCurrentVisitor = (newModel, result) => {
    const bytes = CryptoJS.AES.decrypt(newModel.uuid, JWT_SECRET);
    const trader_uuid = bytes.toString(CryptoJS.enc.Utf8);

    sql.query(TRADERS_VISITORS.SELECT_CURRENT_VISITOR, [trader_uuid], (err, res) => {
        if (res.length > 0) {
            let visitor_uuid = res[0].visitor_id;

            newModel.session.current_visitor_date_created = res[0].date_created;

            if (err) {
                result(null, err);
                return;
            } else {
                sql.query(USERS_ADDRESS.ADDRESS, [visitor_uuid], (err, res) => {
                    if (err) {
                        return;
                    } else {
                        newModel.session.current_visitor_address = res[0];
                    }
                });

                sql.query(USERS_BUSINESS.LANGUAGE, [visitor_uuid], (err, res) => {
                    if (err) {
                        return;
                    } else {
                        newModel.session.current_visitor_language = res[0];
                    }
                });

                sql.query(USERS_ACCOUNTS.SELECT_CURRENT_VISITOR, [visitor_uuid], (err, res) => {
                    if (err) {
                        result(null, err);
                        return;
                    } else {
                        newModel.session.current_visitor = res[0];
                        result(null, res);
                    }
                });
            }
        } else {
            result(null, res);
        }
    });
};

// Model.connectVisitorAndTrader = (newModel, result) => {
//     const bytes = CryptoJS.AES.decrypt(newModel.uuid, JWT_SECRET);
//     const originalUuid = bytes.toString(CryptoJS.enc.Utf8);

//     const visitorTraderObject = {
//         visitor_id: originalUuid,
//         trader_id: newModel.trader_uuid,
//         date_created: date_time(),
//         createdAt: date_time(),
//         updatedAt: date_time(),
//     };

//     sql.query(TRADERS_VISITORS.CREATE, Object.values(visitorTraderObject), function (err, rows) {
//         if (err) {
//             sql.rollback(function () {
//                 throw err;
//             });
//         } else {
//             sql.query(USERS_BUSINESS.GET_TRADER_COMMUNICATOR, [newModel.trader_uuid], (err, res) => {
//                 if (err) {
//                     result(null, err);
//                 } else {
//                     console.log('GET_TRADER_COMMUNICATOR: ', res);
//                     result(null, res);
//                 }
//             });
//         }
//     });
// };

// Model.connectVisitorAndTrader = async (newModel, result) => {
//     try {
//         const bytes = CryptoJS.AES.decrypt(newModel.uuid, JWT_SECRET);
//         const originalUuid = bytes.toString(CryptoJS.enc.Utf8);

//         // Validation query
//         const peersCount = await new Promise((resolve, reject) => {
//             sql.query(USERS_BUSINESS.GET_PEERS_COUNT, [newModel.trader_uuid], (err, res) => {
//                 if (err) {
//                     reject(err);
//                 } else {
//                     console.log('USERS_BUSINESS.GET_PEERS_COUNT : ', res)
//                     resolve(res);
//                 }
//             });
//         });

//         console.log('peersCount peersCount[0].peers_count: ', peersCount[0].peers_count);
//         // Continue if validation passes
//         if (peersCount[0].peers_count < 4 ) {
//             const visitorTraderObject = {
//                 visitor_id: originalUuid,
//                 trader_id: newModel.trader_uuid,
//                 date_created: date_time(),
//                 createdAt: date_time(),
//                 updatedAt: date_time(),
//             };

//             await new Promise((resolve, reject) => {
//                 sql.query(TRADERS_VISITORS.CREATE, Object.values(visitorTraderObject), function (err, rows) {
//                     if (err) {
//                         reject(err);
//                     } else {
//                         resolve(rows);
//                     }
//                 });
//             });

//             const res = await new Promise((resolve, reject) => {
//                 sql.query(USERS_BUSINESS.GET_TRADER_COMMUNICATOR, [newModel.trader_uuid], (err, res) => {
//                     if (err) {
//                         reject(err);
//                     } else {
//                         resolve(res);
//                     }
//                 });
//             });

//             console.log('GET_TRADER_COMMUNICATOR: ', res[0].communicator);
//             let data = res[0].communicator
//             result(null, data);
//         } else {
//             console.log('Peers count validation failed peersCount: ', peersCount);
//             // result("Peers count validation failed", peersCount);
//             let data = 'max 5 already'
//             result(null, data);
//         }
//     } catch (error) {
//         result(error, null);
//     }
// };

const decryptUuid = (encryptedUuid) => {
    const bytes = CryptoJS.AES.decrypt(encryptedUuid, JWT_SECRET);
    return bytes.toString(CryptoJS.enc.Utf8);
};

const getPeersCount = async (traderUuid) => {
    return new Promise((resolve, reject) => {
        sql.query(USERS_BUSINESS.GET_PEERS_COUNT, [traderUuid], (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res[0].peers_count);
            }
        });
    });
};

const createVisitorTraderObject = (originalUuid, traderUuid) => {
    return {
        visitor_id: originalUuid,
        trader_id: traderUuid,
        date_created: date_time(),
        createdAt: date_time(),
        updatedAt: date_time(),
    };
};

const createVisitorTraderConnection = async (visitorTraderObject) => {
    return new Promise((resolve, reject) => {
        sql.query(TRADERS_VISITORS.CREATE, Object.values(visitorTraderObject), (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

const getTraderCommunicator = async (traderUuid) => {
    return new Promise((resolve, reject) => {
        sql.query(USERS_BUSINESS.GET_TRADER_COMMUNICATOR, [traderUuid], (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res[0].communicator);
            }
        });
    });
};

Model.connectVisitorAndTrader = async (newModel, result) => {
    try {
        const originalUuid = decryptUuid(newModel.uuid);
        const peersCount = await getPeersCount(newModel.trader_uuid);

        if (peersCount < 5) {
            const visitorTraderObject = createVisitorTraderObject(originalUuid, newModel.trader_uuid);
            await createVisitorTraderConnection(visitorTraderObject);
            const communicator = await getTraderCommunicator(newModel.trader_uuid);
            result(null, communicator);
        } else {
            result(null, 'max 5 already');
        }
    } catch (error) {
        result(error, null);
    }
};

Model.getCurrentTrader = (newModel, result) => {
    newModel.session.items = [];

    let trader_uuid = newModel.trader_uuid;

    newModel.session.current_trader_date_created = date_time();
    sql.query(USERS_BUSINESS_CHARACTERISTICS.BUSINESS_CHARACTERISTIC, [trader_uuid], (err, res) => {
        if (err) return;
        let { business_major_category, business_sub_category, business_minor_sub_category } = res[0];
        newModel.session.current_trader_business_characteristics = res[0];
        const fetchTitle = (table, id, target) => {
            // if (!id) return;
            if (id && id != null) {
                sql.query(`SELECT title FROM ${table} WHERE id = "${id}"`, (err, res) => {
                    if (err) {
                        console.log('fetchTitle err' + table + ': ', err);
                    } else {
                        console.log('fetchTitle res[0]' + table + ': ', res[0]);
                        newModel.session.items.push({ [target]: res[0].title });
                    }
                });
            } else {
                newModel.session[target] = null;
            }
        };

        fetchTitle('trade_categories', business_major_category, 'current_trader_major_category');
        fetchTitle('sub_categories', business_sub_category, 'current_trader_sub_category');
        fetchTitle('minor_sub_categories', business_minor_sub_category, 'current_trader_minor_sub_category');

        setTimeout(() => {
            sql.query(USERS_BUSINESS.DETAILS, [trader_uuid], (err, res) => {
                if (err) {
                    newModel.session.current_trader = null;
                    result(null, err);
                } else {
                    newModel.session.current_trader = res[0];
                    newModel.session.items.push(res[0]);
                    result(null, res);
                }
            });
        }, 1500);
    });
};

function date_time() {
    let date_ob = new Date();

    // current date
    // adjust 0 before single digit date
    let date = ('0' + date_ob.getDate()).slice(-2);

    // current month
    let month = ('0' + (date_ob.getMonth() + 1)).slice(-2);

    // current year
    let year = date_ob.getFullYear();

    // current hours
    let hours = date_ob.getHours();

    // current minutes
    let minutes = date_ob.getMinutes();

    // current seconds
    let seconds = date_ob.getSeconds();

    // // prints date in YYYY-MM-DD format
    // console.log(year + "-" + month + "-" + date);

    // // prints date & time in YYYY-MM-DD HH:MM:SS format
    // console.log(year + "-" + month + "-" + date + " " + hours + ":" + minutes + ":" + seconds);
    return year + '-' + month + '-' + date + ' ' + hours + ':' + minutes + ':' + seconds;
}

module.exports = Model;
