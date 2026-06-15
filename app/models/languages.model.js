const sql = require('./db.js');
const QUERY = require('../query/languages.query.js');

// constructor
const Model = function (model) {
    // this.title = model.title;
    // this.description = model.description;
    // this.published = model.published;
};

Model.getAll = (title, result) => {
    let query = QUERY.SELECT_LANGUAGES;
    // let query = 'SELECT name, code FROM languages';

    if (title) {
        query += ` WHERE title LIKE '%${title}%'`;
    }

    // query += ` ORDER BY identity ASC, name ASC`;

    sql.query(query, (err, res) => {
        if (err) {
            result(null, err);
            return;
        }

        result(null, res);
    });
};

Model.getLanguageNameByCode = (id, result) => {
    sql.query(`SELECT name FROM languages WHERE code = "${id}"`, (err, res) => {
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
