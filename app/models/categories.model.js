const sql = require('./db.js');
const QUERY = require('../query/trade_categories.query.js');

// constructor
const Model = function (model) {
    this.title = model.title;
    this.description = model.description;
    this.published = model.published;
};

Model.getAll = (title, result) => {
    let query = QUERY.SELECT_TRADE_CATEGORIES;
    // let query = 'SELECT * FROM trade_categories';

    if (title) {
        query += ` WHERE title LIKE '%${title}%'`;
    }

    sql.query(query, (err, res) => {
        if (err) {
            result(null, err);
            return;
        }

        result(null, res);
    });
};

module.exports = Model;
