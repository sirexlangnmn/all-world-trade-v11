/*

http://patorjk.com/software/taag/#p=display&f=ANSI%20Regular&t=Server

███████ ███████ ██████  ██    ██ ███████ ██████
██      ██      ██   ██ ██    ██ ██      ██   ██
███████ █████   ██████  ██    ██ █████   ██████
     ██ ██      ██   ██  ██  ██  ██      ██   ██
███████ ███████ ██   ██   ████   ███████ ██   ██

dependencies: {
    compression     : https://www.npmjs.com/package/compression
    cors            : https://www.npmjs.com/package/cors
    dotenv          : https://www.npmjs.com/package/dotenv
    express         : https://www.npmjs.com/package/express
    socket.io       : https://www.npmjs.com/package/socket.io
    swagger         : https://www.npmjs.com/package/swagger-ui-express
    uuid            : https://www.npmjs.com/package/uuid
    yamljs          : https://www.npmjs.com/package/yamljs
    ejs             : https://www.npmjs.com/package/ejs
    mysql           : https://www.npmjs.com/package/mysql
    body-parser     : https://www.npmjs.com/package/body-parser
    bcrypt          : https://www.npmjs.com/package/bcrypt
    express-flash   : https://www.npmjs.com/package/express-flash
    express-session : https://www.npmjs.com/package/express-session
    method-override : https://www.npmjs.com/package/method-override
    nodemon         : https://www.npmjs.com/package/nodemon
    passport        : https://www.npmjs.com/package/passport
    passport-local  : https://www.npmjs.com/package/passport-local
    jsonwebtoken    : https://www.npmjs.com/package/jsonwebtoken
    pdfkit          : https://www.npmjs.com/package/pdfkit
}

*/

'use strict'; // https://www.w3schools.com/js/js_strict.asp

require('dotenv').config();

const { Server } = require('socket.io');
const http = require('http');
const https = require('https');
const compression = require('compression');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieSession = require('cookie-session');
const path = require('path');
const app = express();
const cron = require('node-cron');

// let corsOptions = {
//     origin: "dev.allworldtrade.com"
// };

//app.use(cors(corsOptions));

app.use(
    cors({
        origin: [
            'https://allworldtrade.com',
            'https://www.allworldtrade.com',
            'https://dev.allworldtrade.com',
            'http://localhost:3000',
            'https://meet.allworldtrade.com',
            'https://meet2.allworldtrade.com',
        ],
    }),
);
//app.use(cors()); // Enable All CORS Requests for all origins

app.use(compression()); // Compress all HTTP responses using GZip

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// parse requests of content-type - application/json
app.use(bodyParser.json());

const session = require('express-session');
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: {
            maxAge: 365 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'strict', //👈 new code
        },
    }),
);

let { lodashNonce } = require('../middleware/nonces');

// Set CSP with helmet
// const helmet = require("../middleware/helmet")
// app.use(helmet);

app.use(function (req, res, next) {
    // let location_hostname = req.hostname;
    // let host = '';
    // if (location_hostname === 'localhost') {
    //     host = 'http://' + location_hostname + ':' + 3000;
    // }
    // if (location_hostname === 'allworldtrade.com' || location_hostname.endsWith('.allworldtrade.com') || location_hostname === 'meet.allworldtrade.com' || location_hostname === 'meet2.allworldtrade.com') {
    //     host = 'https://' + location_hostname;
    // }

    const corsWhitelist = [
        'http://localhost:3000',
        'https://meet.allworldtrade.com',
        'https://meet2.allworldtrade.com',
        'https://allworldtrade.com',
        'https://www.allworldtrade.com',
        'https://dev.allworldtrade.com',
    ];

    //console.log('check: ', 'Content-Security-Policy-Report-Only', "font-src 'self' https://fonts.gstatic.com; img-src 'self'; script-src 'self' https://code.jquery.com/jquery-3.6.0.min.js https://cdnjs.cloudflare.com/ajax/libs/limonte-sweetalert2/11.3.0/sweetalert2.min.js https://unpkg.com/ionicons@5.2.3/dist/ionicons/ionicons.esm.js https://unpkg.com/ionicons@5.2.3/dist/ionicons.js 'nonce-" + lodashNonce +"'; frame-ancestors 'self'; frame-src 'self'");
    if (corsWhitelist.indexOf(req.headers.origin) !== -1) {
        res.header('Access-Control-Allow-Origin', req.headers.origin);
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    }

    res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    // res.setHeader('Content-Security-Policy', "frame-ancestors 'self'; frame-src 'self'");
    // res.setHeader(
    //     'Content-Security-Policy-Report-Only', "default-src 'self'; font-src 'self' https://fonts.gstatic.com/s/orbitron/v25/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1nyGy6BoWgz.woff2; img-src 'self'; script-src 'self' 'nonce-" + lodashNonce +"' ; style-src 'self' 'nonce-" + lodashNonce +"' https://fonts.googleapis.com; frame-ancestors 'self'; form-action 'self'; frame-src 'self'",
    // );

    res.setHeader('X-Frame-Options', 'sameorigin');

    next();
});

const isHttps = false; // must be the same to client.js isHttps
const port = process.env.PORT; // must be the same to client.js signalingServerPort

let io, server, host;

if (isHttps) {
    const fs = require('fs');
    const options = {
        key: fs.readFileSync(path.join(__dirname, '../ssl/key.pem'), 'utf-8'),
        cert: fs.readFileSync(path.join(__dirname, '../ssl/cert.pem'), 'utf-8'),
    };
    server = https.createServer(options, app);
    io = new Server().listen(server);
    host = 'https://' + 'localhost' + ':' + port;
} else {
    server = http.createServer(app);
    io = new Server().listen(server);
    host = 'http://' + 'localhost' + ':' + port;
}

const api_key_secret = process.env.API_KEY_SECRET;

require('../routes/index.js')(app);
require('../routes/password.js')(app);
require('../routes/upload-file.js')(app);
require('../routes/email-marketing.js')(app);
require('../routes/forgot-password.js')(app);
require('../email_controllers/cron-email.controller.js')(app);

const pdfService = require('../service/pdf-service');
const pdfServiceForTrader = require('../service/pdf-trader');

const Logger = require('./Logger');
const log = new Logger('server');

// Use all static files from the public folder
app.use(express.static(path.join(__dirname, '../../', 'public')));

// Api parse body data as json
app.use(express.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true })); // dati naka comment ito

// Remove trailing slashes in url handle bad requests
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        log.debug('Request Error', {
            header: req.headers,
            body: req.body,
            error: err.message,
        });
        return res.status(400).send({ status: 404, message: err.message }); // Bad request
    }
    if (req.path.substr(-1) === '/' && req.path.length > 1) {
        let query = req.url.slice(req.path.length);
        res.redirect(301, req.path.slice(0, -1) + query);
    } else {
        next();
    }
});

// set the view engine to ejs
app.set('view engine', 'ejs');

// ======================================
// db sequelize sync process [start]
//=======================================
const db = require('../db_models');
const ecdc = require('../shared/ecdc.js');

db.sequelize
    .sync()
    .then(() => {
        console.log('Synced db.');
    })
    .catch((err) => {
        console.log('Failed to sync db: ' + err.message);
    });

// // drop the table if it already exists
// db.sequelize.sync({ force: true }).then(() => {
//   console.log("Drop and re-sync db.");
// });

require('../routes/sequelize.route.js')(app);
require('../routes/encrypt.route.js')(app);

// set port, listen for requests
// app.listen(port, () => {
//   console.log(`Server is running on port ${port}.`);
// });

// =====================================
// db sequelize sync process [end]
//======================================



// ==============================
// Helpers / Utilities
// ==============================

function phTime() {
    const now = new Date();

    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(now);

    const get = (type) => parts.find((p) => p.type === type).value;

    const phTime = `${get('year')}-${get('month')}-${get('day')} ` + `${get('hour')}:${get('minute')}:${get('second')}`;

    return phTime;
}


const getUserUuidFromSession = (sessionUser) => {
    if (!sessionUser || !sessionUser.uuid) return null;
    return ecdc.decryptUuid(sessionUser.uuid);
};


const buildLoginViewData = () => ({
    ourGenerateNonce: lodashNonce,
});


const buildViewData = (sessionUser) => ({
    uuid: sessionUser.uuid,
    type: sessionUser.type,
    first_name: sessionUser.first_name,
    last_name: sessionUser.last_name,
    email: sessionUser.email_or_social_media,
    ourGenerateNonce: lodashNonce,
});


const renderLogin = (res) => {
    return res.render(
        path.join(__dirname, '../../', 'public/view/login/index'),
        { data: buildLoginViewData() }
    );
};





const VIEW_BASE_PATH = path.join(__dirname, '../../', 'public/view');

const renderPage = (res, page, data = {}) => {
    const viewPath = path.join(VIEW_BASE_PATH, page, 'index');

    return res.render(viewPath, { data });
};


// ==============================
// Business Logic
// ==============================

const isUserLoggedIn = async (sessionUser) => {
    const userUuid = getUserUuidFromSession(sessionUser);

    if (!userUuid) return false;

    const loginStatus = await checkUserLoginStatus(userUuid);

    console.log('isUserLoggedIn userUuid:', userUuid);
    console.log('isUserLoggedIn loginStatus:', loginStatus);

    return !!loginStatus;
};



// home
app.get(['/'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            uuid: '',
            type: '',
            first_name: '',
            last_name: '',
            email: '',
            country: '',
            state_or_province: '',
            ourGenerateNonce: lodashNonce,
        };

        res.render(path.join(__dirname, '../../', 'public/view/home/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
            country: req.session.user.country,
            state_or_province: req.session.user.state_or_province,
            ourGenerateNonce: lodashNonce,
        };

        res.render(path.join(__dirname, '../../', 'public/view/home/index'), {
            data: sessionData,
        });
    }
});

app.get(['/all-about-events'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            uuid: '',
            type: '',
            first_name: '',
            last_name: '',
            email: '',
            country: '',
            state_or_province: '',
            ourGenerateNonce: lodashNonce,
        };

        res.render(path.join(__dirname, '../../', 'public/view/all-about-events/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
            country: req.session.user.country,
            state_or_province: req.session.user.state_or_province,
            ourGenerateNonce: lodashNonce,
        };

        res.render(path.join(__dirname, '../../', 'public/view/all-about-events/index'), {
            data: sessionData,
        });
    }
});

app.get(['/job-fair'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            ourGenerateNonce: lodashNonce,
        };
        res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
            country: req.session.user.country,
            state_or_province: req.session.user.state_or_province,
            ourGenerateNonce: lodashNonce,
        };

        res.render(path.join(__dirname, '../../', 'public/view/wizard-job-fair/index'), {
            data: sessionData,
        });
    }
});

app.get(['/template'], (req, res) => {
    if (req.session.user === undefined) {
        res.render(path.join(__dirname, '../../', 'public/view/login/index'));
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
            country: req.session.user.country,
            state_or_province: req.session.user.state_or_province,
        };

        res.render(path.join(__dirname, '../../', 'public/view/home/template'));
    }
});

// selections
// app.get(['/selection'], async (req, res) => {

//     console.log('selection req.session.user: ', req.session.user);

//     if (req.session.user === undefined) {
//         const sessionData = {
//             ourGenerateNonce: lodashNonce,
//         };
//         res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
//             data: sessionData,
//         });
//     } else {
//         const userUuid = req.session.user ? ecdc.decryptUuid(req.session.user.uuid) : null;
//         const loginStatus = await checkUserLoginStatus(userUuid);

//         console.log('selection userUuid: ', userUuid);
//         console.log('selection loginStatus: ', loginStatus);

//         if (loginStatus) {
//             const sessionData = {
//                 uuid: req.session.user.uuid,
//                 type: req.session.user.type,
//                 first_name: req.session.user.first_name,
//                 last_name: req.session.user.last_name,
//                 email: req.session.user.email_or_social_media,
//                 ourGenerateNonce: lodashNonce,
//             };

//             res.render(path.join(__dirname, '../../', 'public/view/selection/index'), {
//                 data: sessionData,
//             });
//         } else {
//             const sessionData = {
//                 ourGenerateNonce: lodashNonce,
//             };
//             res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
//                 data: sessionData,
//             });
//         }
//     }
// });


const checkUserLoginStatus = (userUuid) => {
    const Users_accounts = db.users_accounts;

    console.log('checkUserLoginStatus() userUuid: ', userUuid);

    if (!userUuid) {
        console.log('No checkUserLoginStatus userUuid found');
        return Promise.resolve(null); // return a resolved promise
    }

    return Users_accounts.findOne({
        where: { uuid: userUuid },
        attributes: ['login_status']
    })
    .then(usersAccounts => {
        if (!usersAccounts) {
            console.log('No user found with that UUID');
            return null;
        }

        console.log('Successfully got user login status:', usersAccounts.login_status);
        return usersAccounts.login_status;
    })
    .catch(error => {
        console.error('Error in getting user login status:', error);
        return null;
    });
};


app.get('/selection', async (req, res) => {
    try {
        const sessionUser = req.session.user;

        console.log('selection req.session.user:', sessionUser);

        // 1️⃣ No session → go to login
        if (!sessionUser) {
            return renderLogin(res);
        }

        // 2️⃣ Check login status from DB
        const loggedIn = await isUserLoggedIn(sessionUser);

        // 3️⃣ Render based on status
        if (!loggedIn) {
            return renderLogin(res);
        }

        return renderPage(res, 'selection', buildViewData(sessionUser));

    } catch (error) {
        console.error('Error in selection route:', error);

        // fallback (fail-safe)
        return renderLogin(res);
    }
});







app.get(['/profile'], (req, res) => {
    // let location_hostname = req.hostname;
    // let host = '';
    // if (location_hostname === 'localhost') {
    //     host = 'http://' + location_hostname + ':' + 3000;
    // }
    // if (location_hostname === 'allworldtrade.com' || location_hostname.endsWith('.allworldtrade.com')) {
    //     host = 'https://' + location_hostname;
    // }

    // res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    // res.header('Access-Control-Allow-Origin', '');
    // res.setHeader('Access-Control-Allow-Origin', host);

    // res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    if (req.session.user === undefined) {
        const sessionData = {
            ourGenerateNonce: lodashNonce,
        };

        res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
            ourGenerateNonce: lodashNonce,
        };

        if (req.session.user.type == 1) {
            res.render(path.join(__dirname, '../../', 'public/view/profile/traders'), {
                data: sessionData,
            });
        }
        if (req.session.user.type == 2) {
            res.render(path.join(__dirname, '../../', 'public/view/profile/large-scale-company'), {
                data: sessionData,
            });
        }
        if (req.session.user.type == 3) {
            res.render(path.join(__dirname, '../../', 'public/view/profile/medium-scale-company'), {
                data: sessionData,
            });
        }
        if (req.session.user.type == 4) {
            res.render(path.join(__dirname, '../../', 'public/view/profile/small-scale-company'), {
                data: sessionData,
            });
        }
        if (req.session.user.type == 5) {
            res.render(path.join(__dirname, '../../', 'public/view/profile/customer-service'), {
                data: sessionData,
            });
        }
    }
});

app.get(['/profile2'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            ourGenerateNonce: lodashNonce,
        };
        res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
        };

        res.render(path.join(__dirname, '../../', 'public/view/profile/edit'), {
            data: sessionData,
        });
    }
});

app.get(['/help-and-support-profile'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            ourGenerateNonce: lodashNonce,
        };

        res.render(path.join(__dirname, '../../', 'public/view/login/help-and-support-login'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: '',
            status: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_address,
            ourGenerateNonce: lodashNonce,
        };

        if (req.session.user.status == 1) {
            res.render(path.join(__dirname, '../../', 'public/view/profile/help-and-support'), {
                data: sessionData,
            });
        }
    }
});

const { readFileSync, writeFile } = require('fs');
const { check } = require('express-validator');
const countriesData = readFileSync(path.join(__dirname, '../../', 'public/assets/json/countries.json'));
const statesData = readFileSync(path.join(__dirname, '../../', 'public/assets/json/states.json'));
const citiesData = readFileSync(path.join(__dirname, '../../', 'public/assets/json/cities.json'));

//const countriesData2 = readFileSync(path.join(__dirname, '../../', 'public/assets/json/cities-ready-to-delete.json'));

// app.get(['/rewirte-json'], (req, res) => {
//     let value = "latitude";
//     let arr = JSON.parse(citiesData);

//    // iterate and delete time property
//     arr.forEach(o => delete o.state_name);
//     arr.forEach(o => delete o.country_name);
//     arr.forEach(o => delete o.latitude);
//     arr.forEach(o => delete o.longitude);
//     arr.forEach(o => delete o.wikiDataId);

//     // convert back to JSON string
//     let json = JSON.stringify(arr);

//     writeFile(path.join(__dirname, '../../', 'public/assets/json/rewrite-states.json'), json, (err) => {
//         // Error checking
//         if (err) throw err;
//         console.log("New data added");
//     });
// });

app.get(['/rewirte-json'], (req, res) => {
    let arr = JSON.parse(countriesData);

    // iterate and delete time property
    arr.forEach((o) => delete o.phone_code);
    arr.forEach((o) => delete o.capital);
    arr.forEach((o) => delete o.currency);
    arr.forEach((o) => delete o.currency_name);
    arr.forEach((o) => delete o.currency_symbol);
    arr.forEach((o) => delete o.tld);
    arr.forEach((o) => delete o.native);
    arr.forEach((o) => delete o.region);
    arr.forEach((o) => delete o.subregion);
    arr.forEach((o) => delete o.timezones);
    arr.forEach((o) => delete o.translations);
    arr.forEach((o) => delete o.latitude);
    arr.forEach((o) => delete o.longitude);
    arr.forEach((o) => delete o.emoji);
    arr.forEach((o) => delete o.emojiU);

    // convert back to JSON string
    let json = JSON.stringify(arr);

    writeFile(path.join(__dirname, '../../', 'public/assets/json/rewrite-countries.json'), json, (err) => {
        // Error checking
        if (err) throw err;
        console.log('New data added');
    });
});

app.get(['/download-current-visitor-data'], (req, res) => {
    let countries = JSON.parse(countriesData);
    let states = JSON.parse(statesData);
    let cities = JSON.parse(citiesData);

    let visitorCountryCode = req.session.current_visitor_address.country;
    let visitorStateCode = req.session.current_visitor_address.state_or_province;
    let visitorCityCode = req.session.current_visitor_address.city;
    let country = visitorCountryCode ? countries.filter((d) => d.iso2 == visitorCountryCode) : 'N/A';
    let state = visitorStateCode ? states.filter((d) => d.id == visitorStateCode) : 'N/A';
    let city = visitorCityCode ? cities.filter((d) => d.id == visitorCityCode) : 'N/A';
    let socialMediaContactType = displayBusinessSocialMediaContactType(
        req.session.current_visitor.social_media_contact_type,
    );

    const visitorData = {
        email: req.session.current_visitor.email_or_social_media,
        contact_number: req.session.current_visitor.contact_number,
        first_name: req.session.current_visitor.first_name,
        last_name: req.session.current_visitor.last_name,
        middle_name: req.session.current_visitor.middle_name,
        date_created: req.session.current_visitor_date_created,
        country: country[0].name,
        state: state[0].name,
        city: city[0].name,
        language: req.session.current_visitor_language.business_language_of_communication,
        social_media_contact_type: socialMediaContactType,
    };

    const stream = res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment;filename=data_of_current_visitor.pdf`,
    });
    pdfService.buildPDF(
        (chunk) => stream.write(chunk),
        () => stream.end(),
        visitorData,
    );
});

app.get(['/download-current-trader-data'], (req, res) => {
    const sessionData = req.session;
    const sessionDataItems = sessionData.items;

    const currentTraderCategoryItem = sessionDataItems.find((item) => item.current_trader_major_category);
    const currentTraderSubCategoryItem = sessionDataItems.find((item) => item.current_trader_sub_category);
    const currentTraderMinorSubCategoryItem = sessionDataItems.find((item) => item.current_trader_minor_sub_category);

    const currentTraderCategory = currentTraderCategoryItem
        ? currentTraderCategoryItem.current_trader_major_category
        : '';
    const currentTraderSubCategory = currentTraderSubCategoryItem
        ? currentTraderSubCategoryItem.current_trader_sub_category
        : '';
    const currentTraderMinorSubCategory = currentTraderMinorSubCategoryItem
        ? currentTraderMinorSubCategoryItem.current_trader_minor_sub_category
        : '';

    console.log('download-current-trader-data sessionData.items: ', sessionData);
    console.log('download-current-trader-data sessionData.items: ', sessionData.items);
    console.log('download-current-trader-data currentTraderCategory: ', currentTraderCategory);
    console.log('download-current-trader-data currentTraderSubCategory: ', currentTraderSubCategory);
    console.log('download-current-trader-data currentTraderMinorSubCategory: ', currentTraderMinorSubCategory);

    userDownloadHistory(req.session.user.uuid, sessionData.current_trader.business_name);

    const countries = JSON.parse(countriesData);
    const states = JSON.parse(statesData);
    const cities = JSON.parse(citiesData);
    const traderCountryCode = sessionData.current_trader.business_country;
    const visitorStateCode = sessionData.current_trader.business_states;
    const visitorCityCode = sessionData.current_trader.business_city;
    const country = traderCountryCode ? countries.filter((d) => d.iso2 == traderCountryCode)[0].name : 'N/A';
    const state = visitorStateCode ? states.filter((d) => d.id == visitorStateCode)[0].name : 'N/A';
    const city = visitorCityCode ? cities.filter((d) => d.id == visitorCityCode)[0].name : 'N/A';
    const businessName = sessionData.current_trader.business_name;
    const businessWebsite = sessionData.current_trader.business_website;
    const businessEmail = sessionData.current_trader.business_email;
    const businessContact = sessionData.current_trader.business_contact;
    const businessAddress = sessionData.current_trader.business_address;
    const tags = sessionData.current_trader_business_characteristics.business_industry_belong_to;
    const businessScale = sessionData.current_trader_business_characteristics.business_scale;
    const regionOfOperation = sessionData.current_trader.region_of_operation;
    const countryOfOperation = sessionData.current_trader.country_of_operation;
    const statesOfOperation = sessionData.current_trader.states_of_operation;
    const date_created = sessionData.current_trader_date_created;

    const traderData = {
        business_name: businessName,
        business_website: businessWebsite,
        business_email: businessEmail,
        business_contact: businessContact,
        business_address: businessAddress,
        business_country: country,
        business_states: state,
        business_city: city,
        trade_categories: currentTraderCategory,
        sub_categories: currentTraderSubCategory,
        minor_sub_categories: currentTraderMinorSubCategory,
        tags: formattingBusinessTags(tags) || 'N/A',
        businessScale: formattingBusinessScale(businessScale) || 'N/A',
        region_of_operation: formattingBusinessTags(regionOfOperation) || 'N/A',
        country_of_operation: formattedCountryOfOperation(countryOfOperation, countriesData) || 'N/A',
        state_of_operation: statesOfOperation ? states.filter((d) => d.id == statesOfOperation)[0].name : 'N/A',
        date_created: date_created,
    };

    // console.log('pdfServiceForTrader traderData: ', traderData);
    // console.log('pdfServiceForTrader sessionData: ', sessionData);

    const stream = res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment;filename=data_of_current_trader-${businessName}.pdf`,
    });
    pdfServiceForTrader.buildPDF(
        (chunk) => stream.write(chunk),
        () => stream.end(),
        traderData,
    );
});


// function userDownloadHistory(userId, businessName) {
//     const userUuid = userId ? ecdc.decryptUuid(userId) : null;
//     console.log('userDownloadHistory userUuid: ', userUuid);
//     console.log('userDownloadHistory businessName: ', businessName);

//     const Users_businesses = db.users_businesses;
//     const User_download_history = db.user_download_history;
//     const Op = db.Sequelize.Op;

//     if (userUuid) {
//         // 1. query to users_businesses table to get uuid  business_name === businessName


//         // query to user_download_history table this data:
//         // - user_id
//         // - trader_id
//         // - createdAt
//     }

// };


// async function userDownloadHistory(userId, businessName) {
//     const userUuid = userId ? ecdc.decryptUuid(userId) : null;
//     console.log('userDownloadHistory userUuid: ', userUuid);
//     console.log('userDownloadHistory businessName: ', businessName);

//     if (!userUuid) return []; // early return if no user

//     const Users_businesses = db.users_businesses;
//     const User_download_history = db.user_download_history;
//     const Op = db.Sequelize.Op;

//     try {
//         // 1️⃣ Get the business UUID for the given businessName
//         const business = await Users_businesses.findOne({
//             where: {
//                 business_name: businessName
//             },
//             attributes: ['uuid'] // only need uuid
//         });

//         if (!business) {
//             console.log('No business found with that name');
//             return [];
//         }

//         const businessUuid = business.uuid;

//         // 2️⃣ Insert a new download history record for this user and business
//         const newHistory = await User_download_history.create({
//             user_id: userUuid,
//             trader_id: businessUuid, // assuming trader_id refers to business.uuid
//             createdAt: phTime() // or new Date() if you want current timestamp
//         });

//         if (!newHistory) {
//             console.log('No newHistory created');
//             return [];
//         } else {
//             console.log(' history created successfully');
//             console.log(newHistory);
//         }

//     } catch (error) {
//         console.error('Error fetching user download history:', error);
//         return [];
//     }
// }


function userDownloadHistory(userId, businessName) {
    const userUuid = userId ? ecdc.decryptUuid(userId) : null;
    const phTimeValue = phTime();
    console.log('userDownloadHistory userUuid: ', userUuid);
    console.log('userDownloadHistory businessName: ', businessName);
    console.log('userDownloadHistory phTimeValue: ', phTimeValue);

    if (!userUuid) return;
    if (!phTimeValue) return;

    const Users_businesses = db.users_businesses;
    const User_download_histories = db.user_download_histories;


    // 1️⃣ Get the business UUID for the given businessName
    Users_businesses.findOne({
        where: { business_name: businessName },
        attributes: ['uuid'] // only need uuid
    })
    .then(business => {
        if (!business) {
            console.log('No business found with that name');
            return null; // stop here
        }

        const businessUuid = business.uuid;
        const newHistoryData = {
            user_id: userUuid,
            trader_id: businessUuid, // assuming trader_id refers to business.uuid
            download_at: phTimeValue // or new Date() if you want current timestamp
        };

        console.log('userDownloadHistory newHistoryData: ', newHistoryData);
        // 2️⃣ Insert a new download history record for this user and business
        return User_download_histories.create(newHistoryData);
    })
    .then(newHistory => {
        if (!newHistory) return;

        console.log('History created successfully');
        console.log(newHistory);
    })
    .catch(error => {
        console.error('Error in userDownloadHistory:', error);
    });
}



function formattedCountryOfOperation(string, countriesData) {
    let countries = JSON.parse(countriesData);
    let value = [];

    if (string) {
        let data = string.split(',');
        for (var i = 0; i < data.length; i++) {
            let country = countries.filter((d) => d.iso2 == data[i]);
            value.push(' ' + country[0].name);
        }

        return value;
    } else {
        return 'N/A';
    }
}

function displayBusinessSocialMediaContactType(value) {
    let filtered;
    let jsonObj =
        '{ "socialMediaContactType" : [' +
        '{ "id":"1" , "title":"Viber" },' +
        '{ "id":"2" , "title":"Wechat" },' +
        '{ "id":"3" , "title":"Whatsapp" } ]}';

    const parsedObj = JSON.parse(jsonObj);
    let data = parsedObj.socialMediaContactType;

    filtered = data.filter((d) => d.id == value);
    return filtered[0].title;
}

function formattingBusinessTags(string) {
    let value = [];
    if (string) {
        let data = string.split(',');
        for (var i = 0; i < data.length; i++) {
            value.push(' ' + data[i]);
        }
        return value;
    } else {
        return 'N/A';
    }
}

function formattingBusinessScale(id) {
    let value;

    switch (id) {
        case '1':
            value = 'Small Scale';
            break;
        case '2':
            value = 'Medium Scale';
            break;
        case '3':
            value = 'Large Scale';
            break;
        default:
            value = 'N/A';
    }

    return value;
}

app.get(['/edit-traders-profile'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            ourGenerateNonce: lodashNonce,
        };
        res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
        };

        res.render(path.join(__dirname, '../../', 'public/view/profile/edit-traders'), {
            data: sessionData,
        });
    }
});

app.get(['/edit-small-scale-profile'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            ourGenerateNonce: lodashNonce,
        };
        res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
        };

        res.render(path.join(__dirname, '../../', 'public/view/profile/edit-small-scale-company'), {
            data: sessionData,
        });
    }
});

app.get(['/edit-medium-scale-profile'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            ourGenerateNonce: lodashNonce,
        };
        res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
        };

        res.render(path.join(__dirname, '../../', 'public/view/profile/edit-medium-scale-company'), {
            data: sessionData,
        });
    }
});

app.get(['/edit-large-scale-profile'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            ourGenerateNonce: lodashNonce,
        };
        res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
        };

        res.render(path.join(__dirname, '../../', 'public/view/profile/edit-large-scale-company'), {
            data: sessionData,
        });
    }
});

// registration new
app.get(['/registration'], (req, res) => {
    // const sessionData = {
    //     ourGenerateNonce: lodashNonce,
    // };
    // res.render(path.join(__dirname, '../../', 'public/view/registration-v2/index'), {
    //     data: sessionData,
    // });

    if (req.session.user === undefined) {
        const sessionData = {
            ourGenerateNonce: lodashNonce,
        };
        res.render(path.join(__dirname, '../../', 'public/view/registration-v2/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
            ourGenerateNonce: lodashNonce,
        };

        res.render(path.join(__dirname, '../../', 'public/view/selection/index'), {
            data: sessionData,
        });
    }
});

// registration old
app.get(['/registration-for-small-scale-company'], (req, res) => {
    const sessionData = {
        ourGenerateNonce: lodashNonce,
    };
    res.render(path.join(__dirname, '../../', 'public/view/registration/small-scale-company'), {
        data: sessionData,
    });
});

// registration old
app.get(['/registration-for-medium-scale-company'], (req, res) => {
    const sessionData = {
        ourGenerateNonce: lodashNonce,
    };
    res.render(path.join(__dirname, '../../', 'public/view/registration/medium-scale-company'), {
        data: sessionData,
    });
});

// registration old
app.get(['/registration-for-large-scale-company'], (req, res) => {
    const sessionData = {
        ourGenerateNonce: lodashNonce,
    };
    res.render(path.join(__dirname, '../../', 'public/view/registration/large-scale-company'), {
        data: sessionData,
    });
});

// registration old
app.get(['/traders-registration'], (req, res) => {
    const sessionData = {
        ourGenerateNonce: lodashNonce,
    };
    res.render(path.join(__dirname, '../../', 'public/view/registration/traders'), {
        data: sessionData,
    });
});

// help and support registration
app.get(['/help-and-support-registration'], (req, res) => {
    res.render(path.join(__dirname, '../../', 'public/view/registration/help-and-support-registration'));
});

app.get(['/upgrade-plan'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            ourGenerateNonce: lodashNonce,
        };
        res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
        };

        res.render(path.join(__dirname, '../../', 'public/view/upgrade/index'), {
            data: sessionData,
        });
    }
});

app.get(['/upgrade-to-medium-scale'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            ourGenerateNonce: lodashNonce,
        };
        res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
        };

        res.render(path.join(__dirname, '../../', 'public/view/upgrade/medium-scale-company'), {
            data: sessionData,
        });
    }
});

app.get(['/upgrade-to-large-scale'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            ourGenerateNonce: lodashNonce,
        };
        res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
        };

        res.render(path.join(__dirname, '../../', 'public/view/upgrade/large-scale-company'), {
            data: sessionData,
        });
    }
});

app.get(['/upgrade-to-traders'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            ourGenerateNonce: lodashNonce,
        };
        res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
        };

        res.render(path.join(__dirname, '../../', 'public/view/upgrade/traders'), {
            data: sessionData,
        });
    }
});

// email-verification
app.get(['/email-verification'], (req, res) => {
    res.render(path.join(__dirname, '../../', 'public/view/verification/email-verification'), {
        registration_email_address: req.session.registration_email_address,
    });
});

app.get(['/login'], (req, res) => {
    const sessionData = {
        ourGenerateNonce: lodashNonce,
    };

    res.render(path.join(__dirname, '../../', 'public/view/login/index'), {
        data: sessionData,
    });
});

app.get(['/help-and-support-login'], (req, res) => {
    res.render(path.join(__dirname, '../../', 'public/view/login/help-and-support-login'));
});

app.get(['/terms-and-conditions'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            id: null,
            uuid: null,
            type: null,
            first_name: null,
            last_name: null,
            email: null,
            ourGenerateNonce: lodashNonce,
        };

        res.render(path.join(__dirname, '../../', 'public/view/legal/terms-and-conditions'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
        };

        res.render(path.join(__dirname, '../../', 'public/view/legal/terms-and-conditions'), {
            data: sessionData,
        });
    }
});

app.get(['/data-privacy-notice'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            id: null,
            uuid: null,
            type: null,
            first_name: null,
            last_name: null,
            email: null,
            ourGenerateNonce: lodashNonce,
        };

        res.render(path.join(__dirname, '../../', 'public/view/legal/data-privacy-notice'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
        };

        res.render(path.join(__dirname, '../../', 'public/view/legal/data-privacy-notice'), {
            data: sessionData,
        });
    }
});

app.get(['/cookie-policy'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            id: null,
            uuid: null,
            type: null,
            first_name: null,
            last_name: null,
            email: null,
            ourGenerateNonce: lodashNonce,
        };

        res.render(path.join(__dirname, '../../', 'public/view/legal/cookie-policy'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
        };

        res.render(path.join(__dirname, '../../', 'public/view/legal/cookie-policy'), {
            data: sessionData,
        });
    }
});

app.get(['/pricing'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            id: null,
            uuid: null,
            type: null,
            first_name: null,
            last_name: null,
            email: null,
            ourGenerateNonce: lodashNonce,
        };

        res.render(path.join(__dirname, '../../', 'public/view/pricing/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
        };

        res.render(path.join(__dirname, '../../', 'public/view/pricing/index'), {
            data: sessionData,
        });
    }
});

app.get(['/pricing2'], (req, res) => {
    if (req.session.user === undefined) {
        const sessionData = {
            id: null,
            uuid: null,
            type: null,
            first_name: null,
            last_name: null,
            email: null,
            ourGenerateNonce: lodashNonce,
        };

        res.render(path.join(__dirname, '../../', 'public/view/pricing/pricing2'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
        };

        res.render(path.join(__dirname, '../../', 'public/view/pricing/pricing2'), {
            data: sessionData,
        });
    }
});

app.get('/traders-page/:companyName', (req, res) => {
    const companyName = req.params.companyName; // "company-name"
    // res.send(`Company Name: ${companyName}`);

    let sessionData = {
        companyName: companyName,
    };

    if (req.session.user === undefined) {
        const sessionData = {
            uuid: '',
            type: '',
            first_name: '',
            last_name: '',
            email: '',
            country: '',
            state_or_province: '',
            ourGenerateNonce: lodashNonce,
        };

        res.render(path.join(__dirname, '../../', 'public/view/home/index'), {
            data: sessionData,
        });
    } else {
        const sessionData = {
            uuid: req.session.user.uuid,
            type: req.session.user.type,
            first_name: req.session.user.first_name,
            last_name: req.session.user.last_name,
            email: req.session.user.email_or_social_media,
            country: req.session.user.country,
            state_or_province: req.session.user.state_or_province,
            companyName: companyName,
            ourGenerateNonce: lodashNonce,
        };

        res.render(path.join(__dirname, '../../', 'public/view/traders-page/index'), {
            data: sessionData,
        });
    }
});


// app.get('/logout', function (req, res, next) {
//     const Users_accounts = db.users_accounts;
//     const User_sessions = db.user_sessions;
//     const Op = db.Sequelize.Op;

//     const userUuid = req.session.user ? req.session.user.uuid : null;
//     if (userUuid) {
//         Users_accounts.update({ login_status: null }, { where: { uuid: userUuid } });
//         User_sessions.update({ logout_at: phTime() }, { where: { user_id: userUuid, logout_at: null } });
//     }

//     req.session.destroy();

//     // destroy session data
//     req.session = null;

//     // redirect to homepage
//     res.redirect('/login');
// });


app.get('/logout', async function (req, res, next) {
    try {
        const Users_accounts = db.users_accounts;
        const User_sessions = db.user_sessions;

        const userUuid = req.session.user ? ecdc.decryptUuid(req.session.user.uuid) : null;
        const phTimeValue = phTime();
        if (userUuid && phTimeValue) {
            console.log('Logging out user with UUID:', userUuid);
            console.log('Logging out phTimeValue:', phTimeValue);
            // Wait for updates to finish
            await Users_accounts.update(
                { login_status: null },
                { where: { uuid: userUuid } }
            );

            await User_sessions.update(
                { logout_at: phTimeValue },
                { where: { user_id: userUuid, logout_at: null } }
            );
        }

        // Destroy session
        req.session.destroy(err => {
            if (err) return next(err);

            req.session = null;
            res.redirect('/login');
        });

    } catch (err) {
        next(err);
    }
});


app.post('/session-checker/:random', function (req, res, next) {
    var asd = req.params.random;

    res.send(req.session);
});

// not match any of page before, so 404 not found
// app.get('*', function (req, res) {
//     res.sendFile(path.join(__dirname, '../../', 'public/view/404.html'));
// });

server.listen(port, null, () => {
    log.debug(
        `%c

	███████╗██╗ ██████╗ ███╗   ██╗      ███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗ 
	██╔════╝██║██╔════╝ ████╗  ██║      ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗
	███████╗██║██║  ███╗██╔██╗ ██║█████╗███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝
	╚════██║██║██║   ██║██║╚██╗██║╚════╝╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗
	███████║██║╚██████╔╝██║ ╚████║      ███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║
	╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝      ╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝ started...

	`,
        'font-family:monospace',
    );

    // server settings
    log.debug('settings', {
        server: host,
        api_key_secret: api_key_secret,
    });
});
