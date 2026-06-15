const Model = require('../models/global-region.model.js');

// Retrieve all Tutorials from the database (with condition).
exports.findAll = (req, res) => {};

// Get Sub Categories By Trade Category Id
exports.getRegionOfOpertaionByIso = (req, res) => {};

// ===================
// Retrieve objects
// ===================
// Retrieve all Categories from the database (with condition).
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
exports.getRegionOfOpertaionByIso = (req, res) => {
    Model.getRegionOfOpertaionByIso(req.params.id, (err, data) => {
        if (err) {
            if (err.kind === 'not_found') {
                res.status(404).send({
                    message: `Not found region of opertation with id ${req.params.id}.`,
                });
            } else {
                res.status(500).send({
                    message: 'Error retrieving region of opertation with id ' + req.params.id,
                });
            }
        } else res.send(data);
    });
};
