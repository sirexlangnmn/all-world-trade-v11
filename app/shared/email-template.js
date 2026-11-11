const emailService = require('../services/email.service.js');

const et = {};

const logSendFailure = (context) => (error) => {
    console.error(`${context}:`, error.message);
};

et.sendEmailToClient = (receiverEmailAddress, emailData) => {
    emailService
        .sendClientContactNotification(receiverEmailAddress, emailData)
        .catch(logSendFailure('Email to Client failed'));
};

et.notifyAWTwhenClientSentEmailToTrader = (emailData) => {
    emailService
        .sendAllWorldTradeClientEmailNotification(emailData)
        .catch(logSendFailure('Email to All World Trade failed'));
};

et.clientEmailTheTrader = (emailData) => {
    emailService.sendClientEmailToTrader(emailData).catch(logSendFailure('Email to Trader failed'));
};

et.sendEmailReportEveryMidnight = (receiverEmailAddress, emailData) => {
    console.log('sendEmailReportEveryMidnight receiverEmailAddress: ', receiverEmailAddress);
    console.log('sendEmailReportEveryMidnight emailData: ', emailData);

    emailService
        .sendLegacyMidnightReport(receiverEmailAddress, emailData)
        .catch(logSendFailure('Midnight report email failed'));
};

module.exports = et;
