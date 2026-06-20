const { check, validationResult } = require('express-validator');

const validationMiddleware = [
    check('firstName').not().isEmpty().withMessage('S: Fullname is required.').trim().escape(),
    check('contactNumber').not().isEmpty().withMessage('S: Contact number is required.').trim().escape(),
    check('accountType').not().isEmpty().withMessage('S: Language is required.'),
    check('emailAddress')
        .not()
        .isEmpty()
        .withMessage('S: Email Address is required')
        .trim()
        .escape()
        .isEmail()
        .withMessage('S: Invalid Email Address.'),
    check('password').not().isEmpty().withMessage('S: Password is required.'),
    check('confirmPassword', 'S: Passwords do not match').custom((value, { req }) => value === req.body.password),
    check('terms').exists().withMessage('Accept Terms and Conditions'),
    // check('terms').isBoolean().withMessage('Accept Terms and Conditions'),
];

module.exports = validationMiddleware;
