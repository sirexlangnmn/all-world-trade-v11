const middleware = {};
middleware.isAuthenticated = require('./auth.middleware.js').isAuthenticated;
middleware.createIsAuthenticated = require('./auth.middleware.js').createIsAuthenticated;
middleware.apiRateLimit = require('./rate-limit/api.rate-limit.js');
middleware.passwordResetRateLimit = require('./rate-limit/password-reset.rate-limit.js');
middleware.smallScaleCompanyRegistrationValidation = require('./validations/small-scale-company-registration.validation.js');
middleware.mediumScaleCompanyRegistrationValidation = require('./validations/medium-scale-company-registration.validation.js');
middleware.largeScaleCompanyRegistrationValidation = require('./validations/large-scale-company-registration.validation.js');
middleware.traderScaleCompanyRegistrationValidation = require('./validations/trader-scale-company-registration.validation.js');
middleware.login_process = require('./validations/login_process.validations.js');
middleware.registration_v2 = require('./validations/registration_v2.validations.js');

module.exports = middleware;
