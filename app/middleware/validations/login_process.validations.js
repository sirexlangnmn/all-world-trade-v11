const { check, validationResult } = require('express-validator');

const validationMiddleware = [
    //check('loginEmailAddress').trim().escape().isEmail().normalizeEmail().withMessage('S: Invalid Email Address.'), // remove normalizeEmail() because it delete the point in my email address
    check('loginEmailAddress').not().isEmpty().trim().escape().isEmail().withMessage('S: Email Address is required.'),
];

module.exports = validationMiddleware;
