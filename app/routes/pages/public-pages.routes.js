'use strict';

const path = require('path');

const { buildLoginViewData, buildOptionalSessionViewData } = require('../../middleware/view-data.middleware.js');

const VIEW_BASE_PATH = path.join(__dirname, '../../../public/view');

function getViewPath(view) {
    return path.join(VIEW_BASE_PATH, view);
}

function renderOptionalSessionPage(req, res, view) {
    res.render(getViewPath(view), {
        data: buildOptionalSessionViewData(req.session.user, res.locals.cspNonce),
    });
}

module.exports = (app) => {
    app.get(['/email-verification'], (req, res) => {
        res.render(getViewPath('verification/email-verification'), {
            registration_email_address: req.session.registration_email_address,
        });
    });

    app.get(['/login'], (req, res) => {
        res.render(getViewPath('login/index'), {
            data: buildLoginViewData(res.locals.cspNonce),
        });
    });

    app.get(['/help-and-support-login'], (req, res) => {
        res.render(getViewPath('login/help-and-support-login'));
    });

    app.get(['/terms-and-conditions'], (req, res) => {
        renderOptionalSessionPage(req, res, 'legal/terms-and-conditions');
    });

    app.get(['/data-privacy-notice'], (req, res) => {
        renderOptionalSessionPage(req, res, 'legal/data-privacy-notice');
    });

    app.get(['/cookie-policy'], (req, res) => {
        renderOptionalSessionPage(req, res, 'legal/cookie-policy');
    });

    app.get(['/pricing'], (req, res) => {
        renderOptionalSessionPage(req, res, 'pricing/index');
    });

    app.get(['/pricing2'], (req, res) => {
        renderOptionalSessionPage(req, res, 'pricing/pricing2');
    });
};
