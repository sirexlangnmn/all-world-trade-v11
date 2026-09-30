const db = require('../db_models');

// SELECT contract inherited from the legacy raw-SQL search
// (app/models/selection.model.js getAllBySearchParameter).
const BUSINESS_ATTRIBUTES = Object.freeze([
    'id',
    'business_name',
    'business_tagline',
    'business_website',
    'business_email',
    'business_contact',
    'business_language_of_communication',
    'business_social_media_contact_type',
    'business_social_media_contact_number',
    'business_address',
    'business_country',
    'business_states',
    'business_city',
    'region_of_operation',
    'country_of_operation',
    'states_of_operation',
    'city_of_operation',
    'start_operating_hour',
    'end_operating_hour',
    'communicator',
    'uuid',
]);

const CHARACTERISTIC_ATTRIBUTES = Object.freeze([
    'business_industry_belong_to',
    'business_major_category',
    'business_sub_category',
    'business_minor_sub_category',
    'business_scale',
]);

const MEDIA_ATTRIBUTES = Object.freeze(['banner', 'logo']);

// Coerce a user-supplied value into a scalar that is safe inside an Op.*
// operator. Strings pass through unchanged, numbers/booleans are stringified,
// and objects/arrays are dropped entirely so operators can never be smuggled
// in as values.
function toScalar(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return undefined;
}

class BusinessSearchService {
    constructor(dbRef = db) {
        this.db = dbRef;
        this.Op = dbRef.Sequelize.Op;
        this.sequelize = dbRef.sequelize;
        this.UsersBusinesses = dbRef.users_businesses;
        this.UsersBusinessCharacteristics = dbRef.users_business_characteristics;
        this.UsersBusinessMedias = dbRef.users_business_medias;
    }

    // Base (always-on) media conditions: only paid businesses that carry both
    // a banner and a logo (mirrors the legacy search path).
    buildBaseMediaWhere() {
        const { Op } = this;
        return {
            banner: { [Op.ne]: '', [Op.not]: null },
            logo: { [Op.ne]: '', [Op.not]: null },
        };
    }

    // Legacy free-text tokenizer: strip '#' characters, split on whitespace or
    // commas, drop empty words. Behaviour is preserved so results stay stable.
    tokenizeSearchTerm(term) {
        if (term === undefined || term === null) return [];
        return String(term)
            .replace(/#/g, '')
            .split(/[\s,]+/)
            .filter(Boolean);
    }

    // A single word matches business_name OR the REPLACE()-normalized industry.
    buildFreeTextWordCondition(word) {
        const { Op, sequelize } = this;
        return {
            [Op.or]: [
                { business_name: { [Op.like]: `%${word}%` } },
                sequelize.where(
                    sequelize.fn(
                        'REPLACE',
                        sequelize.col('business_characteristics.business_industry_belong_to'),
                        '#',
                        '',
                    ),
                    { [Op.like]: `%${word}%` },
                ),
            ],
        };
    }

    // Words of a term are OR-ed; terms are OR-ed; the caller ANDs the whole
    // group to the base conditions.
    buildFreeTextConditions(searchTerms) {
        return searchTerms
            .map((term) => this.tokenizeSearchTerm(term))
            .filter((words) => words.length > 0)
            .map((words) => ({
                [this.Op.or]: words.map((word) => this.buildFreeTextWordCondition(word)),
            }));
    }

    // Minor sub-category is an exact match against the characteristics table.
    buildMinorSubCategoryCondition(value) {
        const { Op, sequelize } = this;
        return sequelize.where(sequelize.col('business_characteristics.business_minor_sub_category'), {
            [Op.eq]: value,
        });
    }

    // Legacy matched both the business-city and city-of-operation columns.
    buildCityCondition(city) {
        const { Op } = this;
        return { [Op.or]: [{ business_city: city }, { city_of_operation: city }] };
    }

    // Build the full findAll options for the search endpoint. Every
    // user-supplied value lives inside an Op.* object (or a raw-query
    // parameter), never inside a SQL string literal.
    //
    // Facet composition (matches the legacy getAllBySearchParameter semantics,
    // which placed every active filter in one `orConditions` group): each user
    // supplied search facet is OR-ed with every other facet, and the whole group
    // is AND-ed with the base conditions:
    //   WHERE base AND (facet1 OR facet2 OR ...)
    buildSearchOptions(params = {}) {
        const { Op } = this;
        const whereAnd = [{ isPaid: 1 }];
        const facets = [];

        // 1) Free text (product/service + company name).
        const searchTerms = [];
        for (const key of ['product_service_input', 'company_name_input']) {
            const term = toScalar(params[key]);
            if (term) searchTerms.push(term);
        }
        const freeTextConditions = this.buildFreeTextConditions(searchTerms);
        if (freeTextConditions.length > 0) {
            facets.push({ [Op.or]: freeTextConditions });
        }

        // 2) Minor sub-category (characteristics table).
        const minorSubCategory = toScalar(params.minor_sub_categories);
        if (minorSubCategory) {
            facets.push(this.buildMinorSubCategoryCondition(minorSubCategory));
        }

        // 3) City of operation (businesses table) — legacy matched both columns.
        const selectionCity = toScalar(params.selectionCity);
        if (selectionCity) {
            facets.push(this.buildCityCondition(selectionCity));
        }

        // Remaining filters intentionally stay disabled to preserve current
        // search results: trade_categories, business_scale, sub_categories
        // (characteristics); regionOfOperationCode, countryCode, selectionState,
        // language (businesses). The client hardcodes regionOfOperationCode
        // 'SouthEast Asia', countryCode 'PH' and selectionState 1347; re-enabling
        // them would empty the result set (unless OR-composed like the facets).

        if (facets.length > 0) {
            whereAnd.push({ [Op.or]: facets });
        }

        return {
            attributes: BUSINESS_ATTRIBUTES,
            include: [
                {
                    model: this.UsersBusinessCharacteristics,
                    as: 'business_characteristics',
                    required: true,
                    attributes: CHARACTERISTIC_ATTRIBUTES,
                },
                {
                    model: this.UsersBusinessMedias,
                    as: 'business_medias',
                    required: true,
                    attributes: MEDIA_ATTRIBUTES,
                    where: this.buildBaseMediaWhere(),
                },
            ],
            where: { [Op.and]: whereAnd },
            raw: true,
        };
    }

    // Sequelize `raw: true` flattens included models into dotted keys
    // (business_characteristics.business_industry_belong_to). The legacy
    // endpoint returned flat snake_case rows, so strip the include prefixes
    // except for the primary keys ('id'/'uuid') which are not part of the
    // legacy SELECT contract.
    flattenSearchRows(rows) {
        return rows.map((row) => {
            const flat = {};

            for (const [key, value] of Object.entries(row)) {
                if (key.startsWith('business_characteristics.') || key.startsWith('business_medias.')) {
                    const shortKey = key.slice(key.indexOf('.') + 1);
                    if (shortKey !== 'id' && shortKey !== 'uuid') flat[shortKey] = value;
                } else {
                    flat[key] = value;
                }
            }

            return flat;
        });
    }

    async searchBusinesses(params) {
        return this.UsersBusinesses.findAll(this.buildSearchOptions(params));
    }
}

module.exports = { BusinessSearchService };
