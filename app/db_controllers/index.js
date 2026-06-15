const controller = {};
controller.large_scale_company_registration = require('./large-scale-company-registration.controller.js');
controller.medium_scale_company_registration = require('./medium-scale-company-registration.controller.js');
controller.small_scale_company_registration = require('./small-scale-company-registration.controller.js');
controller.trader_scale_company_registration = require('./trader-scale-company-registration.controller.js');
controller.help_and_support_registration = require('./help-and-support.controller.js');
controller.support_links = require('./support-links.controller.js');
controller.support_messages = require('./support_messages.controller.js');
controller.communicator = require('./communicator.controller.js');
controller.users_businesses = require('./users-businesses.controller.js');
controller.users_accounts = require('./users-accounts.controller.js');
controller.registration_v2 = require('./registration_v2.controller.js');
controller.update_trader = require('./update-trader.controller.js');
controller.region_of_operation = require('./region_of_operation.controller.js');
controller.join = require('./join.controller.js');

controller.update_traders = require('./update-traders.controller.js'); // delete in future
controller.update_large_scale_company = require('./update-large-scale-company.controller.js'); // delete in future
controller.update_medium_scale_company = require('./update-medium-scale-company.controller.js'); // delete in future

module.exports = controller;
