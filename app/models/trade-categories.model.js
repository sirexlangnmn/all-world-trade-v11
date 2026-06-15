const sql = require('./db.js');
const QUERY = require('../query/trade_categories.query.js');

// constructor
const Model = function (model) {
    //some code here
};

Model.getTradeCategoryTitleById = (id, result) => {
    // sql.query(`SELECT title FROM trade_categories WHERE id = "${id}"`, (err, res) => { // old way
    sql.query(QUERY.SELECT_TRADE_CATEGORY_TITLE_BY_ID, [id], (err, res) => {
        // new way

        if (err) {
            result(err, null);
            return;
        }

        if (res.length) {
            result(null, res);
            return;
        }

        // not found Tutorial with the id
        result({ kind: 'not_found' }, null);
    });
};

Model.getTradeCategoriesForToday = (title, result) => {
    sql.query(QUERY.SELECT_TRADE_CATEGORIES_FOR_TODAY, (err, res) => {
        if (err) {
            result(null, err);
            return;
        }

        result(null, res);
    });
};

module.exports = Model;
