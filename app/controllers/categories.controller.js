const Model = require('../models/categories.model.js');

// Retrieve all Tutorials from the database (with condition).
exports.findAll = (req, res) => {};

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
