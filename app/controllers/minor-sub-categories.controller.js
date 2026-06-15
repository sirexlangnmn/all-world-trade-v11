const Model = require('../models/minor-sub-categories.model.js');

// Get Sub Categories By Trade Category Id
exports.getMinorSubCategoriesBySubCategoryId = (req, res) => {};

// Get minor sub Categories Title Id
exports.getMinorSubCategoryTitleById = (req, res) => {};

exports.getMinorSubCategoriesById = (req, res) => {};

exports.getMinorSubCategoryByTitle = (req, res) => {};

// ===================
// Retrieve objects
// ===================
exports.getMinorSubCategoriesBySubCategoryId = (req, res) => {
    Model.getMinorSubCategoriesBySubCategoryId(req.params.id, (err, data) => {
        if (err) {
            if (err.kind === 'not_found') {
                res.status(404).send({
                    // message: `Not found minor sub categories with id ${req.params.id}.`,
                    errorResponse: {
                        type: 404,
                        message: 'Not found minor sub categories with id',
                        id: `${req.params.id}`,
                    },
                });
            } else {
                res.status(500).send({
                    // errorResponse: 'Error retrieving minor sub categories with id ' + req.params.id,
                    errorResponse: {
                        type: 500,
                        message: 'Error retrieving minor sub categories with id',
                        id: `${req.params.id}`,
                    },
                });
            }
        } else res.send(data);
    });
};

// ===================
// Retrieve objects
// ===================
exports.getMinorSubCategoryTitleById = (req, res) => {
    Model.getMinorSubCategoryTitleById(req.params.id, (err, data) => {
        if (err) {
            if (err.kind === 'not_found') {
                res.status(404).send({
                    message: `Not found minor sub category title with  id ${req.params.id}.`,
                });
            } else {
                res.status(500).send({
                    message: 'Error retrieving minor sub category title with  id ' + req.params.id,
                });
            }
        } else res.send(data);
    });
};

// ===================
// Retrieve objects
// ===================
exports.getMinorSubCategoriesById = (req, res) => {
    Model.getMinorSubCategoriesById(req.params.id, (err, data) => {
        if (err) {
            if (err.kind === 'not_found') {
                res.status(404).send({
                    message: `Not found minor sub category title with  id ${req.params.id}.`,
                });
            } else {
                res.status(500).send({
                    message: 'Error retrieving minor sub category title with  id ' + req.params.id,
                });
            }
        } else res.send(data);
    });
};

exports.getMinorSubCategoryByTitle = (req, res) => {
    Model.getMinorSubCategoryByTitle(req.params.title, (err, data) => {
        if (err) {
            if (err.kind === 'not_found') {
                res.status(404).send({
                    message: `Not found minor sub category with title ${req.params.title}.`,
                });
            } else {
                res.status(500).send({
                    message: 'Error retrieving minor sub category with title ' + req.params.title,
                });
            }
        } else res.send(data);
    });
};
