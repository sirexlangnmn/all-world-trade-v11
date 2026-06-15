const Model = require('../models/trade-categories.model.js');

// Get Trade Categories Title Id
exports.getTradeCategoryTitleById = (req, res) => {};

exports.getTradeCategoriesForToday = (req, res) => {};

// ===================
// Retrieve objects
// ===================
exports.getTradeCategoryTitleById = (req, res) => {
    Model.getTradeCategoryTitleById(req.params.id, (err, data) => {
        if (err) {
            if (err.kind === 'not_found') {
                res.status(404).send({
                    message: `Not found trade category title with  id ${req.params.id}.`,
                });
            } else {
                res.status(500).send({
                    message: 'Error retrieving trade category title with  id ' + req.params.id,
                });
            }
        } else res.send(data);
    });
};

exports.getTradeCategoriesForToday = (req, res) => {
    const title = req.query.title;

    Model.getTradeCategoriesForToday(title, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving categories.',
            });
        else res.send(data);
    });
};
