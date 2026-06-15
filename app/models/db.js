const mysql = require('mysql2');
const dbConfig = require('../config/db.config.js');

// Create a connection to the database
let connection;

let db_config = {
    host: dbConfig.HOST,
    user: dbConfig.USER,
    password: dbConfig.PASSWORD,
    database: dbConfig.DB,
};

function handleDisconnect() {
    connection = mysql.createPool(db_config); // Recreate the connection, since the old one cannot be reused.

    connection.getConnection(function (err) {
        // The server is either down or restarting (takes a while sometimes).
        if (err) {
            console.log('error when connecting to db:', err);
            setTimeout(handleDisconnect, 2000);
            // We introduce a delay before attempting to reconnect, to avoid a hot loop, and to allow our node script to
            // process asynchronous requests in the meantime. If you're also serving http, display a 503 error.
        }
    });

    connection.on('error', function (err) {
        console.log('db error', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            // Connection to the MySQL server is usually lost due to either server restart, or a
            // connnection idle timeout (the wait_timeout server variable configures this)
            handleDisconnect();
        } else {
            throw err;
        }
    });
}

handleDisconnect();

module.exports = connection;
