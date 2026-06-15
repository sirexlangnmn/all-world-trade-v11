// module.exports = {
//   HOST: '',
//   USER: '',
//   PASSWORD: '',
//   DB: '',
// };

//sequelize version
module.exports = {
    HOST: process.env.DB_SERVERHOST,
    USER: process.env.DB_USERNAME,
    PASSWORD: process.env.DB_PASSWORD,
    DB: process.env.DB_NAME,
    dialect: process.env.DB_DIALECT,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
};
