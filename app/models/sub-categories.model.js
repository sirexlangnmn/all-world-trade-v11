const sql = require('./db.js');
const QUERY = require('../query/sub_categories.query.js');

// constructor
const Model = function (model) {
    // some code here
};

Model.getSubCategoriesByTradeCategoryId = (id, result) => {
    // sql.query(`SELECT * FROM sub_categories WHERE trade_category_id = ${id}`, (err, res) => { // old way
    sql.query(QUERY.SELECT_SUB_CATEGORIES, [id], (err, res) => {
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

Model.getSubCategoryTitleById = (id, result) => {
    sql.query(`SELECT title FROM sub_categories WHERE id = "${id}"`, (err, res) => {
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

module.exports = Model;
