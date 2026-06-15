const sql = require('./db.js');

// constructor
const Model = function (model) {
    // some code here
};

Model.getMinorSubCategoriesBySubCategoryId = (id, result) => {
    sql.query(`SELECT * FROM minor_sub_categories WHERE sub_category_id = ${id}`, (err, res) => {
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

Model.getMinorSubCategoryTitleById = (id, result) => {
    sql.query(`SELECT title FROM minor_sub_categories WHERE id = "${id}"`, (err, res) => {
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

Model.getMinorSubCategoriesById = (id, result) => {
    sql.query(`SELECT id, title FROM minor_sub_categories WHERE id = "${id}"`, (err, res) => {
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

Model.getMinorSubCategoryByTitle = (title, result) => {
    sql.query(`SELECT id, title FROM minor_sub_categories WHERE title = "${title}"`, (err, res) => {
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
