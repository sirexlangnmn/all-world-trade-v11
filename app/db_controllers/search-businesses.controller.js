const { BusinessSearchService } = require('../services/business-search.service');

// Default service backed by the app's Sequelize models. The class accepts a
// db reference for dependency injection in tests.
const service = new BusinessSearchService();

// Whitelist of keys POST /api/post/selection-search-parameter may read. Any
// unknown key in req.body is intentionally dropped so it can never reach the
// query builder.
const SEARCH_PARAM_KEYS = Object.freeze([
    'regionOfOperationCode',
    'countryCode',
    'selectionState',
    'selectionCity',
    'language',
    'business_scale',
    'trade_categories',
    'sub_categories',
    'minor_sub_categories',
    'product_service_input',
    'company_name_input',
]);

// Map the raw JSON body to a plain params object containing only whitelisted
// keys. Values are passed through untouched; the service coerces them into
// parameterized Op.* values when building the query.
function mapSearchParams(body = {}) {
    const params = {};
    for (const key of SEARCH_PARAM_KEYS) {
        if (body[key] !== undefined) params[key] = body[key];
    }
    return params;
}

exports.mapSearchParams = mapSearchParams;

exports.findAllBySearchParameter = async (req, res) => {
    try {
        const rows = await service.searchBusinesses(mapSearchParams(req.body));
        res.send(service.flattenSearchRows(rows));
    } catch (err) {
        res.status(500).send({ message: err.message || 'Some error occurred while retrieving companies.' });
    }
};
