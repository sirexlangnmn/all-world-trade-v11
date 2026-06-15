const Model = require('../models/languages.model.js');

// Retrieve all Tutorials from the database (with condition).
exports.findAll = (req, res) => {};

// Get Sub Categories By Trade Category Id
exports.getLanguageNameByCode = (req, res) => {};

// ===================
// Retrieve objects
// ===================
// Retrieve all languages from the database (with condition).
exports.findAll = (req, res) => {
    const title = req.query.title;

    Model.getAll(title, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving categories.',
            });
        else res.send(data);
    });
};

// ===================
// Retrieve objects
// ===================
exports.getLanguageNameByCode = (req, res) => {
    Model.getLanguageNameByCode(req.params.id, (err, data) => {
        if (err) {
            if (err.kind === 'not_found') {
                res.status(404).send({
                    message: `Not found language name with code ${req.params.id}.`,
                });
            } else {
                res.status(500).send({
                    message: 'Error retrieving language name with code ' + req.params.id,
                });
            }
        } else res.send(data);
    });
};
