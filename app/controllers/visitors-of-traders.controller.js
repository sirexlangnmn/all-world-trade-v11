const Model = require('../models/visitors-of-traders.model.js');

exports.findCurrentVisitor = (req, res) => {};
exports.findCurrentTrader = (req, res) => {};
exports.connectVisitorAndTrader = (req, res) => {};

exports.findCurrentVisitor = (req, res) => {
    const parameters = {
        uuid: req.session.user.uuid,
        session: req.session,
    };

    Model.getCurrentVisitor(parameters, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving current visitor.',
            });
        else res.send(data);
    });
};

exports.findCurrentTrader = (req, res) => {
    const parameters = {
        session: req.session,
        trader_uuid: req.body.trader_uuid,
    };

    Model.getCurrentTrader(parameters, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving current trader.',
            });
        else res.send(data);
    });
};

exports.connectVisitorAndTrader = (req, res) => {
    const parameters = {
        uuid: req.session.user.uuid,
        trader_uuid: req.body.trader_uuid,
    };

    Model.connectVisitorAndTrader(parameters, (err, data) => {
        if (err)
            res.status(500).send({
                message: err.message || 'Some error occurred while retrieving companies.',
            });
        else res.send(data);
    });
};
