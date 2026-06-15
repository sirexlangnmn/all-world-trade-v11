const path = require('path');
const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars').default;

const et = {};

et.sendEmailToClient = (receiverEmailAddress, emailData) => {
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SERVERHOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        auth: {
            user: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
            pass: process.env.SUPPORT_RECEIVER_PASSWORD,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    const handlebarOptions = {
        viewEngine: {
            extName: '.handlebars',
            partialsDir: path.resolve('./public/view/email'),
            defaultLayout: false,
        },
        viewPath: path.resolve('./public/view/email'),
        extName: '.handlebars',
    };

    transporter.use('compile', hbs(handlebarOptions));

    // setup email data with unicode symbols
    let mailOptions = {
        from: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
        to: receiverEmailAddress,
        subject: "All World Trade - Traders you're trying to connect with.",
        template: 'notifyClientOnTraderTheyContact',
        context: {
            emailData: emailData,
        },
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('transporter.sendMail Email to Client error: ', error);
            // return error;
        } else {
            // res.send('email sent');
            console.log('Email has been sent to Client: ', receiverEmailAddress);
        }
        // console.log('Message sent info: ', info);
        // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        // res.render('Email has been sent');
    });
};

et.notifyAWTwhenClientSentEmailToTrader = (emailData) => {
    const receiverEmailAddress = 'allworldtrade.com@gmail.com';
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SERVERHOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        auth: {
            user: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
            pass: process.env.SUPPORT_RECEIVER_PASSWORD,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    const handlebarOptions = {
        viewEngine: {
            extName: '.handlebars',
            partialsDir: path.resolve('./public/view/email'),
            defaultLayout: false,
        },
        viewPath: path.resolve('./public/view/email'),
        extName: '.handlebars',
    };

    transporter.use('compile', hbs(handlebarOptions));

    // setup email data with unicode symbols
    let mailOptions = {
        from: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
        to: receiverEmailAddress,
        subject: 'All World Trade - Client sent a message to a Trader',
        template: 'notifyAWTwhenClientSentEmailToTrader',
        context: {
            emailData: emailData,
        },
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('transporter.sendMail Email to AWT error: ', error);
            // return error;
        } else {
            // res.send('email sent');
            console.log('Email has been sent to AWT: ', receiverEmailAddress);
        }
        // console.log('Message sent info: ', info);
        // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        // res.render('Email has been sent');
    });
};

et.clientEmailTheTrader = (emailData) => {
    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SERVERHOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        auth: {
            user: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
            pass: process.env.SUPPORT_RECEIVER_PASSWORD,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    const handlebarOptions = {
        viewEngine: {
            extName: '.handlebars',
            partialsDir: path.resolve('./public/view/email'),
            defaultLayout: false,
        },
        viewPath: path.resolve('./public/view/email'),
        extName: '.handlebars',
    };

    transporter.use('compile', hbs(handlebarOptions));

    // setup email data with unicode symbols
    let mailOptions = {
        from: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
        to: emailData.traderEmail,
        subject: 'All World Trade - Client message you.',
        template: 'client-email-the-trader',
        context: {
            emailData: emailData,
        },
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('transporter.sendMail Email to Trader error: ', error);
            // return error;
        } else {
            // res.send('email sent');
            console.log('Email has been sent to Trader: ', emailData.traderEmail);
        }
        // console.log('Message sent info: ', info);
        // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        // res.render('Email has been sent');
    });
};

et.sendEmailReportEveryMidnight = (receiverEmailAddress, emailData) => {
    console.log('sendEmailReportEveryMidnight receiverEmailAddress: ', receiverEmailAddress);
    console.log('sendEmailReportEveryMidnight emailData: ', emailData);

    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SERVERHOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        auth: {
            user: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
            pass: process.env.SUPPORT_RECEIVER_PASSWORD,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    const handlebarOptions = {
        viewEngine: {
            extName: '.handlebars',
            partialsDir: path.resolve('./public/view/email'),
            defaultLayout: false,
            helpers: {
                add: (a, b) => a + b,
            },
        },
        viewPath: path.resolve('./public/view/email'),
        extName: '.handlebars',
    };

    transporter.use('compile', hbs(handlebarOptions));

    // setup email data with unicode symbols
    let mailOptions = {
        from: process.env.SUPPORT_RECEIVER_EMAIL_ADDRESS,
        to: receiverEmailAddress,
        subject: "All World Trade - Traders you're trying to connect with.",
        template: 'midnight-email-report',
        context: {
            emailData: emailData,
        },
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('transporter.sendMail Email to Trader error: ', error);
            // return error;
        } else {
            // res.send('email sent');
            console.log('Email has been sent to Trader: ', receiverEmailAddress);
        }
        // console.log('Message sent info: ', info);
        // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        // res.render('Email has been sent');
    });
};

module.exports = et;
