const Model = require('../models/sub-categories.model.js');

// Get Sub Categories By Trade Category Id
exports.getSubCategoriesByTradeCategoryId = (req, res) => {};

// Get sub Categories Title Id
exports.getSubCategoryTitleById = (req, res) => {};

// ===================
// Retrieve objects
// ===================
exports.getSubCategoriesByTradeCategoryId = (req, res) => {
    Model.getSubCategoriesByTradeCategoryId(req.params.id, (err, data) => {
        if (err) {
            if (err.kind === 'not_found') {
                res.status(404).send({
                    message: `Not found category with id ${req.params.id}.`,
                });
            } else {
                res.status(500).send({
                    message: 'Error retrieving category with id ' + req.params.id,
                });
            }
        } else res.send(data);
    });
};

// ===================
// Retrieve objects
// ===================
exports.getSubCategoryTitleById = (req, res) => {
    Model.getSubCategoryTitleById(req.params.id, (err, data) => {
        if (err) {
            if (err.kind === 'not_found') {
                res.status(404).send({
                    message: `Not found sub category title with  id ${req.params.id}.`,
                });
            } else {
                res.status(500).send({
                    message: 'Error retrieving sub category title with  id ' + req.params.id,
                });
            }
        } else res.send(data);
    });
};
