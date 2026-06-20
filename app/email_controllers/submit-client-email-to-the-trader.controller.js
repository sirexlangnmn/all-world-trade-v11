const db = require('../db_models');
const ecdc = require('../shared/ecdc.js');
const emailTemplate = require('../shared/email-template.js');
const FREE_CONTACT_LIMIT = process.env.FREE_CONTACT_LIMIT;
const Users_businesses = db.users_businesses;
const Contact_requests = db.contact_requests;
const Op = db.Sequelize.Op;

exports.create = async (req, res) => {
    try {
        const payload = extractRequestPayload(req);
        const userSession = extractUserSession(req);

        const usersBusinessData = await getUsersBusinessDataByBusinessName(payload.companyName);
        if (!usersBusinessData) {
            return handleError('Business not found');
        }

        const emailData = buildEmailData(payload, userSession, usersBusinessData);
        const contactRequestData = buildContactRequestData(payload, userSession, usersBusinessData);

        const canSendEmail = await handleContactRequest(contactRequestData);

        if (canSendEmail) {
            sendAllEmails(emailData);
        } else {
            console.log('Free contact limit reached or failed to create contact request.');
            const emailData2 = buildEmailData2(payload, userSession, usersBusinessData);
            sendAllEmails2(emailData, emailData2);
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error in notify-trader-on-client-contact:', error);
        return res.status(500).json({ success: false });
    }
};

function extractRequestPayload(req) {
    const { cett_company_name, cett_message } = req.body;

    return {
        companyName: cett_company_name,
        message: cett_message,
    };
}

function extractUserSession(req) {
    const user = req.session.user;

    return {
        visitorId: ecdc.decryptUuid(user.uuid),
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email_or_social_media,
    };
}

function buildEmailData(payload, userSession, usersBusinessData) {
    return {
        clientFirstName: userSession.firstName,
        clientLastName: userSession.lastName,
        clientEmail: userSession.email,
        traderEmail: usersBusinessData.business_email,
        companyName: payload.companyName,
        message: payload.message,
    };
}

function buildEmailData2(payload, userSession, usersBusinessData) {
    return {
        clientFirstName: maskString(userSession.firstName),
        clientLastName: maskString(userSession.lastName),
        clientEmail: maskString(userSession.email),
        traderEmail: usersBusinessData.business_email,
        companyName: payload.companyName,
        message: payload.message,
    };
}

function maskString(input) {
    // 1. Check if input is a pure string
    if (typeof input !== 'string') {
        return null; // or throw an error if you prefer
    }

    // Trim spaces just in case
    const value = input.trim();

    // Helper function to mask a string while keeping first & last character
    function maskText(text) {
        if (text.length <= 2) {
            return text; // nothing to mask
        }

        const firstChar = text[0];
        const lastChar = text[text.length - 1];
        const masked = '*'.repeat(text.length - 2);

        return firstChar + masked + lastChar;
    }

    // 2. Check if input is an email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailRegex.test(value)) {
        const [localPart, domain] = value.split('@');
        const maskedLocalPart = maskText(localPart);

        // 3. Mask only the local part, keep domain original
        return `${maskedLocalPart}@${domain}`;
    }

    // 4. If not email, mask the whole string
    return maskText(value);
}

function buildContactRequestData(payload, userSession, usersBusinessData) {
    return {
        trader_id: usersBusinessData.uuid,
        visitor_id: userSession.visitorId,
        message: payload.message,
    };
}

async function handleContactRequest(contactRequestData) {
    const createResult = await createContactRequest(contactRequestData);
    if (!createResult?.success) return false;

    const countResult = await getContactRequestByTraderId(contactRequestData);

    console.log('Unique contact count:', countResult.count);
    console.log('FREE_CONTACT_LIMIT:', FREE_CONTACT_LIMIT);

    return FREE_CONTACT_LIMIT > countResult.count;
}

function sendAllEmails(emailData) {
    emailTemplate.clientEmailTheTrader(emailData);
    emailTemplate.sendEmailToClient(emailData.clientEmail, emailData.traderEmail);
    emailTemplate.notifyAWTwhenClientSentEmailToTrader(emailData);
}

function sendAllEmails2(emailData, emailData2) {
    emailTemplate.clientEmailTheTrader(emailData2);
    emailTemplate.sendEmailToClient(emailData.clientEmail, emailData.traderEmail);
    emailTemplate.notifyAWTwhenClientSentEmailToTrader(emailData);
}

function handleError(message) {
    console.error(message);
    throw new Error(message);
}

async function getUsersBusinessDataByBusinessName(businessName) {
    try {
        const result = await Users_businesses.findOne({
            attributes: ['business_email', 'uuid'],
            where: { business_name: businessName },
            raw: true,
        });

        return result || null;
    } catch (error) {
        console.error(error);
    }
}

async function createContactRequest(contactRequestData) {
    try {
        const result = await Contact_requests.create({
            trader_id: contactRequestData.trader_id,
            visitor_id: contactRequestData.visitor_id,
            message: contactRequestData.message,
        });

        return {
            success: true,
            message: 'Contact request created successfully',
        };
    } catch (error) {
        console.error('Error creating contact request:', error);

        return {
            success: false,
            message: 'Failed to create contact request',
            error: error.message,
        };
    }
}

async function getContactRequestByTraderId(contactRequestData) {
    const trader_id = contactRequestData.trader_id;

    try {
        const uniqueVisitorCount = await Contact_requests.count({
            where: {
                trader_id: trader_id,
            },
            distinct: true,
            col: 'visitor_id',
        });

        return {
            success: true,
            message: 'Unique contact requests retrieved successfully',
            count: uniqueVisitorCount,
        };
    } catch (error) {
        console.error('Error get contact request by trader id:', error);

        return {
            success: false,
            message: 'Failed to get contact request by trader id',
            error: error.message,
        };
    }
}
