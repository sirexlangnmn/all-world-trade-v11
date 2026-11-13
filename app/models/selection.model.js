const sql = require('./db.js');
// const USERS_BUSINESS_MEDIAS = require('../query/users_business_medias.query.js');

// constructor
const Model = function (model) {};

Model.getCompaniesRelatedToCurrentUser = (param, result) => {
    const startId = Number(param.randomNumber) || 1;
    const limit = Number(param.limit) || 5;
    console.log('getCompaniesRelatedToCurrentUser param :', param);

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

    const firstQuery = `${selectColumns} ${fromClause} AND users_businesses.id >= ? ORDER BY users_businesses.id ASC LIMIT ?`;
    const secondQuery = `${selectColumns} ${fromClause} AND users_businesses.id < ? ORDER BY users_businesses.id ASC LIMIT ?`;

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

Model.getPrevFiveCompanies = (param, result) => {
    const firstId = param.firstId;
    const limit = param.limit || 5;

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
        `${selectColumns} ${fromClause} WHERE users_businesses.id < ? ORDER BY users_businesses.id DESC LIMIT ?`,
        [firstId, limit],
        (err, tail) => {
            if (err) {
                result(null, err);
                return;
            }

            if (tail.length >= limit) {
                result(null, tail);
                return;
            }

            const remaining = limit - tail.length;

            sql.query(
                `${selectColumns} ${fromClause} WHERE users_businesses.id >= ? ORDER BY users_businesses.id DESC LIMIT ${remaining}`,
                [firstId],
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

// Returns an integer in [0, max(total - limit, 0)] so a bounded window never
// starts past the last eligible row. `random` is injectable for tests.
function computeRandomOffset(total, limit, random = Math.random) {
    const size = Number(total);
    const window = Number(limit);
    if (!Number.isFinite(size) || !Number.isFinite(window) || size <= 0 || window <= 0) return 0;

    const maxOffset = Math.max(Math.floor(size) - Math.floor(window), 0);
    if (maxOffset === 0) return 0;

    const sample = typeof random === 'function' ? random() : random;
    const r = Number(sample);
    const clamped = Number.isFinite(r) ? Math.min(Math.max(r, 0), 0.999999999999) : 0;
    return Math.floor(clamped * (maxOffset + 1));
}

Model.computeRandomOffset = computeRandomOffset;

Model.getRandomCompanies = (result) => {
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
        WHERE users_business_medias.banner != ''
        AND users_business_medias.logo != ''
        AND users_businesses.isPaid = 1`;

    const limit = 5;
    const countQuery = `SELECT COUNT(*) AS total ${fromClause}`;
    const pageQuery = `${selectColumns} ${fromClause} ORDER BY users_businesses.id ASC LIMIT ? OFFSET ?`;

    sql.query(countQuery, (err, countRows) => {
        if (err) {
            result(null, err);
            return;
        }

        const total = Number(countRows?.[0]?.total) || 0;
        if (total === 0) {
            result(null, []);
            return;
        }

        const offset = computeRandomOffset(total, limit);

        sql.query(pageQuery, [limit, offset], (err, rows) => {
            if (err) {
                result(null, err);
                return;
            }

            result(null, rows);
        });
    });
};

module.exports = Model;
