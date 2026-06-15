const sql = require('./db.js');

// constructor
const Model = function (model) {
    this.title = model.title;
    this.description = model.description;
    this.published = model.published;
};

Model.getAll = (title, result) => {
    let query = 'SELECT name, iso FROM region_of_operations';

    if (title) {
        query += ` WHERE title LIKE '%${title}%'`;
    }

    query += ` ORDER BY identity ASC, name ASC`;

    sql.query(query, (err, res) => {
        if (err) {
            result(null, err);
            return;
        }

        result(null, res);
    });
};

Model.getRegionOfOpertaionByIso = (id, result) => {
    sql.query(`SELECT includes FROM region_of_operations WHERE iso = "${id}"`, (err, res) => {
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
