const sql = require('./db.js');
// const USERS_BUSINESS_MEDIAS = require('../query/users_business_medias.query.js');

// constructor
const Model = function (model) {};

Model.getCompaniesRelatedToCurrentUser = (param, result) => {
    sql.query('SELECT id FROM trade_categories WHERE status = 1', (err, res) => {
        let tradeCategoryId = res[0].id;
        if (err) {
            result(null, err);
            return;
        } else {
            sql.query(
                `SELECT COUNT(users_businesses.id) AS id_count 
                FROM users_businesses JOIN users_business_characteristics 
                ON users_businesses.uuid = users_business_characteristics.uuid 
                JOIN users_business_medias 
                ON users_businesses.uuid = users_business_medias.uuid 
                WHERE users_business_characteristics.business_major_category = '${tradeCategoryId}' 
                AND users_businesses.country_of_operation = '${param.country}'
                AND users_business_medias.banner != ''
                OR users_business_medias.banner != null`,
                (err, res) => {
                    if (err) {
                        result(null, err);
                        return;
                    } else {
                        let randomNumber = Math.floor(1 + Math.random() * res[0].id_count);

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
                            users_businesses.communicator,
                            users_businesses.uuid,
                            users_business_characteristics.business_industry_belong_to,
                            users_business_characteristics.business_major_category,
                            users_business_characteristics.business_sub_category,
                            users_business_characteristics.business_minor_sub_category,
                            users_business_characteristics.business_scale,
                            users_business_medias.banner
                            FROM users_businesses 
                            JOIN users_business_characteristics 
                            ON users_businesses.uuid = users_business_characteristics.uuid 
                            JOIN users_business_medias 
                            ON users_businesses.uuid = users_business_medias.uuid 
                            WHERE users_business_characteristics.business_major_category = '${tradeCategoryId}' 
                            AND users_businesses.country_of_operation LIKE '%${param.country}%'
                            AND users_business_medias.banner != ''
                            OR users_business_medias.banner != null
                            ORDER BY RAND()  
                            LIMIT 50`,
                            (err, res) => {
                                if (err) {
                                    result(null, err);
                                    return;
                                } else {
                                    result(null, res);
                                }
                            },
                        );
                    }
                },
            );
        }
    });
};

Model.getAllBySearchParameter = (param, result) => {
    console.log('getAllBySearchParameter param :', param);
    let query = `SELECT 
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
        users_businesses.communicator,
        users_businesses.uuid,
        users_business_characteristics.business_industry_belong_to,
        users_business_characteristics.business_major_category,
        users_business_characteristics.business_sub_category,
        users_business_characteristics.business_minor_sub_category,
        users_business_characteristics.business_scale,
        users_business_medias.banner
        FROM users_businesses 
        JOIN users_business_characteristics 
        ON users_businesses.uuid = users_business_characteristics.uuid 
        JOIN users_business_medias 
        ON users_businesses.uuid = users_business_medias.uuid 
        WHERE users_business_medias.banner != ''`;

    if (param.trade_categories) {
        query += ` AND users_business_characteristics.business_major_category = '${param.trade_categories}'`;
        //query += `users_business_characteristics.business_major_category = '${param.trade_categories}'`;
    }
    if (param.regionOfOperationCode) {
        query += `AND users_businesses.region_of_operation LIKE '%${param.regionOfOperationCode}%'`;
    }
    if (param.countryCode) {
        // query += ` AND users_business.country_of_operation = '${param.countryCode}'`;
        query += ` AND users_businesses.country_of_operation LIKE '%${param.countryCode}%'`;
    }
    if (param.selectionState) {
        query += ` OR users_businesses.states_of_operation = '${param.selectionState}'`;
    }
    if (param.selectionCity) {
        query += ` OR users_businesses.city_of_operation = '${param.selectionCity}'`;
    }
    if (param.language) {
        query += ` AND users_businesses.business_language_of_communication LIKE '%${param.language}%'`;
    }
    if (param.business_scale) {
        query += ` AND users_business_characteristics.business_scale = '${param.business_scale}'`;
    }
    if (param.sub_categories) {
        query += ` AND users_business_characteristics.business_sub_category = '${param.sub_categories}'`;
    }
    if (param.minor_sub_categories) {
        query += ` AND users_business_characteristics.business_minor_sub_category = '${param.minor_sub_categories}'`;
    }
    if (param.product_service_input) {
        query += ` OR users_business_characteristics.business_industry_belong_to LIKE '%${param.product_service_input}%'`;
    }
    if (param.company_name_input) {
        query += ` OR users_businesses.business_name LIKE '%${param.company_name_input}%'`;
    }

    // query += ` AND users_business_medias.banner != ''`;
    query += ` ORDER BY RAND () LIMIT 50`;

    sql.query(query, (err, res) => {
        if (err) {
            result(null, err);
            return;
        } else {
            console.log('getAllBySearchParameter res :', res);
            result(null, res);
        }
    });
};

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
        users_businesses.communicator,
        users_businesses.uuid,
        users_business_characteristics.business_industry_belong_to,
        users_business_characteristics.business_major_category,
        users_business_characteristics.business_sub_category,
        users_business_characteristics.business_minor_sub_category,
        users_business_characteristics.business_scale,
        users_business_medias.banner
        FROM users_businesses 
        JOIN users_business_characteristics 
        ON users_businesses.uuid = users_business_characteristics.uuid 
        JOIN users_business_medias 
        ON users_businesses.uuid = users_business_medias.uuid 
        WHERE users_business_characteristics.business_major_category = 1
        AND users_business_medias.banner != ''
        ORDER BY RAND()  
        LIMIT 50`,
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
