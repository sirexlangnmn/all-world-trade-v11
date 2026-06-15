// require('dotenv').config();
const dotenv = require('dotenv').config();
const mysql = require('mysql2');
// const dbConfig = require('../config/db.config.js');

// Create a connection to the database
const connection = mysql.createConnection({
    // host: dbConfig.HOST,
    // user: dbConfig.USER,
    // password: dbConfig.PASSWORD,
    // database: dbConfig.DB,

    host: process.env.DB_SERVERHOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// open the MySQL connection
connection.connect((error) => {
    if (error) throw error;
    console.log('Successfully connected to the database.');
});

// connection.connect(function(err) {
//   if (err) {
//     console.error('error connecting: ' + err.stack);
//     return;
//   }
//   console.log('connected as id ' + connection.threadId);
// });

module.exports = connection;
