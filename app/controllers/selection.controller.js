const Model = require('../models/selection.model.js');

exports.findCompaniesRelatedToCurrentUser = (req, res) => {};

exports.findNextFiveCompanies = (req, res) => {};

exports.findRandomCompanies = (req, res) => {};

exports.findCompaniesRelatedToCurrentUser = (req, res) => {
    const parameters = {
        uuid: req.session.user.uuid,
        country: req.session.user.country,
        state_or_province: req.session.user.state_or_province,
        randomNumber: Number(req.body.randomNumber) || 1,
        limit: 5,
    };

    Model.getCompaniesRelatedToCurrentUser(parameters, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving companies.',
            });
        else res.send(data);
    });
};

exports.findPrevFiveCompanies = (req, res) => {
    const parameters = {
        firstId: req.body.firstId,
        limit: req.body.limit || 5,
    };

    Model.getPrevFiveCompanies(parameters, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving companies.',
            });
        else res.send(data);
    });
};

exports.findNextFiveCompanies = (req, res) => {
    const parameters = {
        uuid: req.session.user.uuid,
        lastId: req.body.lastId,
        limit: req.body.limit,
    };

    Model.getNextFiveCompanies(parameters, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving companies.',
            });
        else res.send(data);
    });
};

exports.findRandomCompanies = (req, res) => {
    Model.getRandomCompanies((err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving companies.',
            });
        else res.send(data);
    });
};
