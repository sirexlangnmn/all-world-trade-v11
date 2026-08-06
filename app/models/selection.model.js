const sql = require('./db.js');
// const USERS_BUSINESS_MEDIAS = require('../query/users_business_medias.query.js');

// constructor
const Model = function (model) {};

// Model.getCompaniesRelatedToCurrentUser = (param, result) => {
//     sql.query('SELECT id FROM trade_categories WHERE status = 1', (err, res) => {
//         let tradeCategoryId = res[0].id;
//         if (err) {
//             result(null, err);
//             return;
//         } else {
//             sql.query(
//                 `SELECT COUNT(users_businesses.id) AS id_count
//                 FROM users_businesses JOIN users_business_characteristics
//                 ON users_businesses.uuid = users_business_characteristics.uuid
//                 JOIN users_business_medias
//                 ON users_businesses.uuid = users_business_medias.uuid
//                 WHERE users_business_characteristics.business_major_category = '${tradeCategoryId}'
//                 AND users_businesses.country_of_operation = '${param.country}'
//                 AND users_business_medias.banner != ''
//                 OR users_business_medias.banner != null`,
//                 (err, res) => {
//                     if (err) {
//                         result(null, err);
//                         return;
//                     } else {
//                         let randomNumber = Math.floor(1 + Math.random() * res[0].id_count);

//                         sql.query(
//                             `SELECT
//                             users_businesses.id,
//                             users_businesses.business_name,
//                             users_businesses.business_tagline,
//                             users_businesses.business_website,
//                             users_businesses.business_email,
//                             users_businesses.business_contact,
//                             users_businesses.business_language_of_communication,
//                             users_businesses.business_social_media_contact_type,
//                             users_businesses.business_social_media_contact_number,
//                             users_businesses.business_address,
//                             users_businesses.business_country,
//                             users_businesses.business_states,
//                             users_businesses.business_city,
//                             users_businesses.region_of_operation,
//                             users_businesses.country_of_operation,
//                             users_businesses.states_of_operation,
//                             users_businesses.city_of_operation,
//                             users_businesses.start_operating_hour,
//                             users_businesses.end_operating_hour,
//                             users_businesses.communicator,
//                             users_businesses.uuid,
//                             users_business_characteristics.business_industry_belong_to,
//                             users_business_characteristics.business_major_category,
//                             users_business_characteristics.business_sub_category,
//                             users_business_characteristics.business_minor_sub_category,
//                             users_business_characteristics.business_scale,
//                             users_business_medias.banner
//                             FROM users_businesses
//                             JOIN users_business_characteristics
//                             ON users_businesses.uuid = users_business_characteristics.uuid
//                             JOIN users_business_medias
//                             ON users_businesses.uuid = users_business_medias.uuid
//                             AND users_businesses.isPaid = 1
//                             AND users_business_medias.banner != ''
//                             OR users_business_medias.banner != null
//                             ORDER BY RAND()
//                             LIMIT 50`,
//                             (err, res) => {
//                                 if (err) {
//                                     result(null, err);
//                                     return;
//                                 } else {
//                                     result(null, res);
//                                 }
//                             },
//                         );
//                     }
//                 },
//             );
//         }
//     });
// };

Model.getCompaniesRelatedToCurrentUser = (param, result) => {
    const startId = Number(param.randomNumber) || 1;
    const limit = Number(param.limit) || 5;

    const selectColumns = `SELECT 
        users_businesses.id, 
        users_businesses.business_name, 
        users_businesses.business_tagline,
        users_businesses.business_website,
        users_businesses.business_email,
        users_businesses.business_contact,
        users_businesses.business_language_of_communication,
        users_businesses.business_social_media_contact_type,
        users_businesses.business_social_media_contact_number,
        users_businesses.business_address,
        users_businesses.business_country,
        users_businesses.business_states,
        users_businesses.business_city,
        users_businesses.region_of_operation,
        users_businesses.country_of_operation,
        users_businesses.states_of_operation,
        users_businesses.city_of_operation,
        users_businesses.start_operating_hour,
        users_businesses.end_operating_hour,
        users_businesses.communicator,
        users_businesses.uuid,
        users_business_characteristics.business_industry_belong_to,
        users_business_characteristics.business_major_category,
        users_business_characteristics.business_sub_category,
        users_business_characteristics.business_minor_sub_category,
        users_business_characteristics.business_scale,
        users_business_medias.banner,
        users_business_medias.logo`;

    const fromClause = `FROM users_businesses
        JOIN users_business_characteristics
        ON users_businesses.uuid = users_business_characteristics.uuid
        JOIN users_business_medias
        ON users_businesses.uuid = users_business_medias.uuid
        WHERE users_businesses.isPaid = 1
        AND users_business_medias.banner != ''
        AND users_business_medias.banner IS NOT NULL
        AND users_business_medias.logo != ''
        AND users_business_medias.logo IS NOT NULL`;

    const firstQuery = `${selectColumns} ${fromClause} AND users_businesses.id > ? ORDER BY users_businesses.id ASC LIMIT ?`;
    const secondQuery = `${selectColumns} ${fromClause} AND users_businesses.id <= ? ORDER BY users_businesses.id ASC LIMIT ?`;

    sql.query(firstQuery, [startId, limit], (err, tail) => {
        if (err) {
            result(null, err);
            return;
        }

        if (tail.length >= limit) {
            result(null, tail);
            return;
        }

        const remaining = limit - tail.length;

        sql.query(secondQuery, [startId, remaining], (err, head) => {
            if (err) {
                result(null, err);
                return;
            }

            result(null, [...tail, ...head]);
        });
    });
};

Model.getNextFiveCompanies = (param, result) => {
    const lastId = param.lastId;

    const selectColumns = `SELECT 
        users_businesses.id, 
        users_businesses.business_name, 
        users_businesses.business_tagline,
        users_businesses.business_website,
        users_businesses.business_email,
        users_businesses.business_contact,
        users_businesses.business_language_of_communication,
        users_businesses.business_social_media_contact_type,
        users_businesses.business_social_media_contact_number,
        users_businesses.business_address,
        users_businesses.business_country,
        users_businesses.business_states,
        users_businesses.business_city,
        users_businesses.region_of_operation,
        users_businesses.country_of_operation,
        users_businesses.states_of_operation,
        users_businesses.city_of_operation,
        users_businesses.start_operating_hour,
        users_businesses.end_operating_hour,
        users_businesses.communicator,
        users_businesses.uuid,
        users_business_characteristics.business_industry_belong_to,
        users_business_characteristics.business_major_category,
        users_business_characteristics.business_sub_category,
        users_business_characteristics.business_minor_sub_category,
        users_business_characteristics.business_scale,
        users_business_medias.banner,
        users_business_medias.logo`;

    const fromClause = `FROM users_businesses 
        JOIN users_business_characteristics 
        ON users_businesses.uuid = users_business_characteristics.uuid 
        JOIN users_business_medias 
        ON users_businesses.uuid = users_business_medias.uuid 
        AND users_businesses.isPaid = 1
        AND users_business_medias.banner != ''
        AND users_business_medias.banner IS NOT NULL
        AND users_business_medias.logo != ''
        AND users_business_medias.logo IS NOT NULL`;

    sql.query(
        `${selectColumns} ${fromClause} WHERE users_businesses.id > ? ORDER BY users_businesses.id ASC LIMIT 5`,
        [lastId],
        (err, tail) => {
            if (err) {
                result(null, err);
                return;
            }

            if (tail.length >= 5) {
                result(null, tail);
                return;
            }

            const remaining = 5 - tail.length;

            sql.query(
                `${selectColumns} ${fromClause} WHERE users_businesses.id <= ? ORDER BY users_businesses.id ASC LIMIT ${remaining}`,
                [lastId],
                (err, head) => {
                    if (err) {
                        result(null, err);
                        return;
                    }
                    result(null, [...tail, ...head]);
                },
            );
        },
    );
};

Model.getAllBySearchParameter = (param, result) => {
    console.log('getAllBySearchParameter param :', param);

    const selectColumns = `SELECT 
        users_businesses.id, 
        users_businesses.business_name, 
        users_businesses.business_tagline,
        users_businesses.business_website,
        users_businesses.business_email,
        users_businesses.business_contact,
        users_businesses.business_language_of_communication,
        users_businesses.business_social_media_contact_type,
        users_businesses.business_social_media_contact_number,
        users_businesses.business_address,
        users_businesses.business_country,
        users_businesses.business_states,
        users_businesses.business_city,
        users_businesses.region_of_operation,
        users_businesses.country_of_operation,
        users_businesses.states_of_operation,
        users_businesses.city_of_operation,
        users_businesses.start_operating_hour,
        users_businesses.end_operating_hour,
        users_businesses.communicator,
        users_businesses.uuid,
        users_business_characteristics.business_industry_belong_to,
        users_business_characteristics.business_major_category,
        users_business_characteristics.business_sub_category,
        users_business_characteristics.business_minor_sub_category,
        users_business_characteristics.business_scale,
        users_business_medias.banner,
        users_business_medias.logo`;

    const baseConditions = [
        `users_businesses.isPaid = 1`,
        `users_business_medias.banner != ''`,
        `users_business_medias.banner IS NOT NULL`,
        `users_business_medias.logo != ''`,
        `users_business_medias.logo IS NOT NULL`,
    ];

    const orConditions = [];
    const queryParams = [];

    const addEqual = (column, value) => {
        orConditions.push(`${column} = ?`);
        queryParams.push(value);
    };

    const addLike = (column, value) => {
        orConditions.push(`${column} LIKE ?`);
        queryParams.push(`%${value}%`);
    };

    if (param.trade_categories) {
        addEqual('users_business_characteristics.business_major_category', param.trade_categories);
    }
    if (param.regionOfOperationCode) {
        addEqual('users_businesses.region_of_operation', param.regionOfOperationCode);
    }
    if (param.countryCode) {
        addLike('users_businesses.country_of_operation', param.countryCode);
    }
    if (param.selectionState) {
        addEqual('users_businesses.states_of_operation', param.selectionState);
    }
    if (param.selectionCity) {
        addEqual('users_businesses.business_city', param.selectionCity);
        addEqual('users_businesses.city_of_operation', param.selectionCity);
    }
    if (param.language) {
        addLike('users_businesses.business_language_of_communication', param.language);
    }
    if (param.business_scale) {
        addEqual('users_business_characteristics.business_scale', param.business_scale);
    }
    if (param.sub_categories) {
        addEqual('users_business_characteristics.business_sub_category', param.sub_categories);
    }
    if (param.minor_sub_categories) {
        addEqual('users_business_characteristics.business_minor_sub_category', param.minor_sub_categories);
    }

    const searchTerms = [];
    if (param.product_service_input) {
        searchTerms.push(param.product_service_input);
    }
    if (param.company_name_input) {
        searchTerms.push(param.company_name_input);
    }

    if (searchTerms.length > 0) {
        const termGroups = [];

        searchTerms.forEach((term) => {
            const words = term.replace(/#/g, '').split(/[\s,]+/).filter(Boolean);
            if (words.length === 0) return;

            const wordConditions = words.map((word) => {
                const like = `%${word}%`;
                queryParams.push(like, like);
                return `(users_businesses.business_name LIKE ?
                    OR REPLACE(users_business_characteristics.business_industry_belong_to, '#', '') LIKE ?)`;
            });

            termGroups.push(`(${wordConditions.join(' OR ')})`);
        });

        if (termGroups.length > 0) {
            orConditions.push(`(${termGroups.join(' OR ')})`);
        }
    }

    const fromClause = `FROM users_businesses 
        JOIN users_business_characteristics 
        ON users_businesses.uuid = users_business_characteristics.uuid 
        JOIN users_business_medias 
        ON users_businesses.uuid = users_business_medias.uuid`;

    let query = `${selectColumns} ${fromClause} WHERE ${baseConditions.join(' AND ')}`;

    if (orConditions.length > 0) {
        query += ` AND (${orConditions.join(' OR ')})`;
    }

    // query += ` ORDER BY RAND() LIMIT 5`;

    console.log('getAllBySearchParameter query :', query);

    sql.query(query, queryParams, (err, res) => {
        if (err) {
            result(null, err);
            return;
        } else {
            result(null, res);
        }
    });
};

// Model.getRandomCompanies = (result) => {
//     sql.query(
//         `SELECT
//         users_businesses.id,
//         users_businesses.business_name,
//         users_businesses.business_tagline,
//         users_businesses.business_website,
//         users_businesses.business_email,
//         users_businesses.business_contact,
//         users_businesses.business_language_of_communication,
//         users_businesses.business_social_media_contact_type,
//         users_businesses.business_social_media_contact_number,
//         users_businesses.business_address,
//         users_businesses.business_country,
//         users_businesses.business_states,
//         users_businesses.business_city,
//         users_businesses.region_of_operation,
//         users_businesses.country_of_operation,
//         users_businesses.states_of_operation,
//         users_businesses.city_of_operation,
//         users_businesses.start_operating_hour,
//         users_businesses.end_operating_hour,
//         users_businesses.communicator,
//         users_businesses.uuid,
//         users_business_characteristics.business_industry_belong_to,
//         users_business_characteristics.business_major_category,
//         users_business_characteristics.business_sub_category,
//         users_business_characteristics.business_minor_sub_category,
//         users_business_characteristics.business_scale,
//         users_business_medias.banner
//         FROM users_businesses
//         JOIN users_business_characteristics
//         ON users_businesses.uuid = users_business_characteristics.uuid
//         JOIN users_business_medias
//         ON users_businesses.uuid = users_business_medias.uuid
//         WHERE users_business_characteristics.business_major_category = 1
//         AND users_business_medias.banner != ''
//         AND users_businesses.isPaid = 1
//         ORDER BY RAND()
//         LIMIT 50`,
//         (err, res) => {
//             if (err) {
//                 result(null, err);
//                 return;
//             } else {
//                 result(null, res);
//             }
//         },
//     );
// };

Model.getRandomCompanies = (result) => {
    sql.query(
        `SELECT 
        users_businesses.id, 
        users_businesses.business_name, 
        users_businesses.business_tagline,
        users_businesses.business_website,
        users_businesses.business_email,
        users_businesses.business_contact,
        users_businesses.business_language_of_communication,
        users_businesses.business_social_media_contact_type,
        users_businesses.business_social_media_contact_number,
        users_businesses.business_address,
        users_businesses.business_country,
        users_businesses.business_states,
        users_businesses.business_city,
        users_businesses.region_of_operation,
        users_businesses.country_of_operation,
        users_businesses.states_of_operation,
        users_businesses.city_of_operation,
        users_businesses.start_operating_hour,
        users_businesses.end_operating_hour,
        users_businesses.communicator,
        users_businesses.uuid,
        users_business_characteristics.business_industry_belong_to,
        users_business_characteristics.business_major_category,
        users_business_characteristics.business_sub_category,
        users_business_characteristics.business_minor_sub_category,
        users_business_characteristics.business_scale,
        users_business_medias.banner,
        users_business_medias.logo
        FROM users_businesses 
        JOIN users_business_characteristics 
        ON users_businesses.uuid = users_business_characteristics.uuid 
        JOIN users_business_medias 
        ON users_businesses.uuid = users_business_medias.uuid 
        WHERE users_business_medias.banner != ''
        AND users_business_medias.logo != ''
        AND users_businesses.isPaid = 1
        ORDER BY RAND()  
        LIMIT 5`,
        (err, res) => {
            if (err) {
                result(null, err);
                return;
            } else {
                result(null, res);
            }
        },
    );
};

module.exports = Model;
