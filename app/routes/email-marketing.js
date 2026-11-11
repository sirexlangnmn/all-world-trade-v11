module.exports = (app) => {
    const db = require('../db_models');
    const sequelizeConfig = require('../config/sequelize.config.js');
    const Users_accounts = db.users_accounts;
    const Prospects = db.prospects;
    const Op = db.Sequelize.Op;

    const express = require('express');
    const path = require('path');
    const CryptoJS = require('crypto-js');
    const emailService = require('../services/email.service.js');

    app.use(express.static(path.join(__dirname, '../../', 'public')));

    const submitClientEmailToTheTrader = require('../email_controllers/submit-client-email-to-the-trader.controller.js');

    app.post(['/api/v3/post/submit-client-email-to-the-trader'], submitClientEmailToTheTrader.create);

    app.post('/api/post/emails/introduction', async (req, res) => {
        try {
            const records = await getAllProspects();
            records.forEach((record, index) => {
                let receiverEmailAddress = record.email_address;
                if (receiverEmailAddress) {
                    setTimeout(() => {
                        sendIntroductionEmail(receiverEmailAddress, index);
                    }, index * 2000);
                }
            });
        } catch (error) {
            console.error(error);
        }
    });

    app.post('/api/post/emails/notify-trader-on-client-contact', async (req, res) => {
        try {
            const { trader_uuid } = req.body;
            const userUuidEncrypted = req.session.user.uuid;
            const userEmail = req.session.user.email_or_social_media;

            console.log('Trader UUID:', trader_uuid);
            console.log('User UUID (Encrypted):', userUuidEncrypted);
            console.log('User Email:', userEmail);

            const userUuid = decryptUuid(userUuidEncrypted);
            console.log('Decrypted User UUID:', userUuid);

            const traderData = await fetchTraderData(trader_uuid);
            const traderEmail = logTraderData(traderData);

            if (traderEmail) {
                sendEmailToTrader(traderEmail, userEmail);
                sendEmailToClient(userEmail, traderEmail);
                sendEmailToAllWorldTrade(traderEmail, userEmail);

                console.log('Continue with the email notification process');
            } else {
                console.log('Notification process aborted due to missing trader email');
            }
        } catch (error) {
            console.error('Error in notify-trader-on-client-contact:', error);
        }
    });

    async function getAllProspects() {
        try {
            const records = await Prospects.findAll();
            return records;
        } catch (error) {
            console.error(error);
        }
    }

    function sendIntroductionEmail(receiverEmailAddress, index) {
        console.log('Number to be send: ', index);

        emailService
            .sendIntroductionEmail(receiverEmailAddress)
            .catch((error) => console.error('Introduction email failed:', error.message));
    }

    const decryptUuid = (encryptedUuid) => {
        try {
            return CryptoJS.AES.decrypt(encryptedUuid, process.env.JWT_SECRET).toString(CryptoJS.enc.Utf8);
        } catch (error) {
            console.error('Error decrypting UUID:', error);
            throw new Error('Failed to decrypt UUID');
        }
    };

    const fetchTraderData = async (traderUuid) => {
        try {
            const condition = traderUuid ? { uuid: traderUuid } : null;
            return await Users_accounts.findAll({ where: condition });
        } catch (error) {
            console.error('Error fetching trader data:', error);
            throw new Error('Failed to retrieve trader data');
        }
    };

    const logTraderData = (traderData) => {
        if (traderData && traderData.length > 0) {
            const traderEmail = traderData[0].dataValues.email_or_social_media;
            console.log('Trader email:', traderEmail);
            return traderEmail;
        } else {
            console.log('No trader data found');
            return null;
        }
    };

    function sendEmailToTrader(receiverEmailAddress, emailData) {
        console.log('sendEmailToTrader receiverEmailAddress :', receiverEmailAddress);
        console.log('sendEmailToTrader emailData :', emailData);

        emailService
            .sendTraderContactNotification(receiverEmailAddress, emailData)
            .catch((error) => console.error('Trader contact email failed:', error.message));
    }

    function sendEmailToClient(receiverEmailAddress, emailData) {
        emailService
            .sendClientContactNotification(receiverEmailAddress, emailData)
            .catch((error) => console.error('Client contact email failed:', error.message));
    }

    function sendEmailToAllWorldTrade(traderEmail, clientEmail) {
        emailService
            .sendAllWorldTradeContactNotification(traderEmail, clientEmail)
            .catch((error) => console.error('All World Trade contact email failed:', error.message));
    }
};
