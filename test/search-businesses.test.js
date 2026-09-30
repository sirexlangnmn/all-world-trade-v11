// Regression + security tests for POST /api/post/selection-search-parameter.
// Run: node --test test/search-businesses.test.js
//
// The search is split across two modules: BusinessSearchService builds the
// parameterized Sequelize query and performs the data access, while the
// controller whitelists the request body. Unit tests assert the query-data
// structure contract, the flat response shape, the body whitelist, and the
// value coercion; integration cases execute the query against the real DB
// (local env) to prove injection payloads are treated as data.
const { test } = require('node:test');
const assert = require('node:assert');

require('dotenv').config();

const db = require('../app/db_models');
const { BusinessSearchService } = require('../app/services/business-search.service.js');
const { mapSearchParams } = require('../app/db_controllers/search-businesses.controller.js');

const service = new BusinessSearchService(db);
const buildSearchOptions = (params) => service.buildSearchOptions(params);
const flattenSearchRows = (rows) => service.flattenSearchRows(rows);

const Op = db.Sequelize.Op;

// --- Pure: query structure ------------------------------------------------

test('buildSearchOptions keeps base isPaid + media (banner/logo) conditions', () => {
    const options = buildSearchOptions({});

    assert.deepStrictEqual(options.where, { [Op.and]: [{ isPaid: 1 }] });

    const medias = options.include.find((i) => i.as === 'business_medias');
    assert.ok(medias, 'medias include present');
    assert.strictEqual(medias.required, true, 'medias join is INNER');
    assert.deepStrictEqual(medias.where, {
        banner: { [Op.ne]: '', [Op.not]: null },
        logo: { [Op.ne]: '', [Op.not]: null },
    });

    const chars = options.include.find((i) => i.as === 'business_characteristics');
    assert.ok(chars, 'characteristics include present');
    assert.strictEqual(chars.required, true, 'characteristics join is INNER');
});

test('minor_sub_categories becomes a data-only facet inside the parent OR group', () => {
    const payload = "148' OR '1'='1";
    const options = buildSearchOptions({ minor_sub_categories: payload });

    const values = collectValues(options);
    assert.ok(values.includes(payload), 'injection string kept only as a parameter value');

    const whereAnd = options.where[Op.and];
    const orGroup = whereAnd[1];
    assert.ok(orGroup && orGroup[Op.or], 'facet OR group present');
    assert.strictEqual(orGroup[Op.or].length, 1, 'minor is the only facet');

    const chars = options.include.find((i) => i.as === 'business_characteristics');
    assert.ok(chars && !chars.where, 'characteristics join carries no standalone filter');
});

// Collect every string value reachable in a query structure (symbol-keyed
// objects such as { [Op.like]: ... } are not serializable by JSON.stringify).
function collectValues(node, out = []) {
    if (node === null || node === undefined) return out;
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) {
        for (const item of node) collectValues(item, out);
    } else if (typeof node === 'object') {
        for (const key of Reflect.ownKeys(node)) collectValues(node[key], out);
    }
    return out;
}

test('buildSearchOptions puts free-text words only inside LIKE values', () => {
    const payload = "x' UNION SELECT password FROM users_accounts -- ";
    const options = buildSearchOptions({ product_service_input: payload });

    const whereAnd = options.where[Op.and];
    const freeTextGroup = whereAnd.find((c) => c[Op.or]);
    assert.ok(freeTextGroup, 'free-text OR group present');

    const values = collectValues(options);
    // The legacy algorithm tokenizes the term into words first, so the raw
    // multi-word injection fragment is never carried into the query data.
    assert.ok(!values.some((v) => v.includes("' UNION SELECT")), 'raw SQL fragment never present');
    // Each token survives only as a LIKE pattern value inside Op.like.
    for (const word of ["x'", 'UNION', 'SELECT', 'password', 'FROM', 'users_accounts']) {
        assert.ok(values.includes(`%${word}%`), `word "${word}" kept as parameter value`);
    }
    assert.ok(!values.some((v) => v.includes('${')), 'no template interpolation');
});

test('buildSearchOptions strips # from free-text terms exactly like legacy (whole-term, then split)', () => {
    const options = buildSearchOptions({ product_service_input: '#co#ffee' });
    const termGroups = options.where[Op.and].filter((c) => c[Op.or]);

    // '#co#ffee' -> stripped '#co#ffee' -> 'coffee' (single word)
    assert.strictEqual(termGroups.length, 1);
});

test('facets are OR-composed under the base conditions (company + minor + city)', () => {
    const options = buildSearchOptions({
        company_name_input: 'coffee',
        minor_sub_categories: '148',
        selectionCity: 'Manila',
    });

    const whereAnd = options.where[Op.and];
    assert.deepStrictEqual(whereAnd[0], { isPaid: 1 }, 'base condition stays ANDed first');

    const orGroup = whereAnd[1];
    assert.ok(orGroup && orGroup[Op.or], 'a single OR group wraps all facets');
    assert.strictEqual(orGroup[Op.or].length, 3, 'company + minor + city are three facets');

    const values = collectValues(options);
    assert.ok(values.includes('%coffee%'), 'company-name word survives as a LIKE value');
    assert.ok(values.includes('148'), 'minor value survives as data');
    assert.ok(values.includes('Manila'), 'city value survives as data');
    assert.ok(!values.some((v) => v.includes('${')), 'no template interpolation');
});

// --- Pure: input whitelist and value coercion -----------------------------

test('mapSearchParams forwards only whitelisted keys', () => {
    const params = mapSearchParams({
        regionOfOperationCode: 'SouthEast Asia',
        minor_sub_categories: '148',
        product_service_input: 'coffee',
        evil: 'x',
        constructor: 'nope',
    });

    assert.deepStrictEqual(params, {
        regionOfOperationCode: 'SouthEast Asia',
        minor_sub_categories: '148',
        product_service_input: 'coffee',
    });
});

test('mapSearchParams drops unknown keys including prototype-pollution attempts', () => {
    const body = JSON.parse('{"minor_sub_categories":"148","__proto__":{"polluted":true}}');
    const params = mapSearchParams(body);

    assert.deepStrictEqual(params, { minor_sub_categories: '148' });
    assert.strictEqual({}.polluted, undefined, 'Object.prototype untouched');
});

test('buildSearchOptions coerces scalars and drops operator objects/arrays', () => {
    const numeric = buildSearchOptions({ minor_sub_categories: 148 });
    assert.strictEqual(numeric.where[Op.and].length, 2, 'number coerced to a facet');
    assert.ok(collectValues(numeric).includes('148'), 'number stringified as data');

    const objectPayload = buildSearchOptions({ minor_sub_categories: { [Op.gt]: 1 } });
    assert.deepStrictEqual(objectPayload.where, { [Op.and]: [{ isPaid: 1 }] }, 'operator objects dropped');

    const arrayPayload = buildSearchOptions({ selectionCity: ['Manila', 'Cebu'] });
    assert.strictEqual(arrayPayload.where[Op.and].length, 1, 'arrays dropped, base conditions alone');
});

// --- Pure: response flattening -------------------------------------------

test('flattenSearchRows produces flat snake_case rows (legacy contract)', () => {
    const rows = [
        {
            id: 157,
            business_name: 'EA JUICE STATION',
            uuid: 'abc',
            'business_characteristics.business_industry_belong_to': 'Coffee,Shakes',
            'business_characteristics.id': 99,
            'business_medias.banner': 'companyBanner-1.jpg',
            'business_medias.logo': 'companyLogo-1.jpg',
            'business_medias.id': 98,
        },
    ];

    const flat = flattenSearchRows(rows);
    assert.deepStrictEqual(flat, [
        {
            id: 157,
            business_name: 'EA JUICE STATION',
            uuid: 'abc',
            business_industry_belong_to: 'Coffee,Shakes',
            banner: 'companyBanner-1.jpg',
            logo: 'companyLogo-1.jpg',
        },
    ]);
});

// --- Integration: live DB (skips gracefully without connection) ----------

function runLive(payload) {
    return service.searchBusinesses(payload).then((rows) => service.flattenSearchRows(rows));
}

test('normal search: minor_sub_categories + free text returns flat array of paid businesses with media', async (t) => {
    const rows = await runLive({ minor_sub_categories: '148', product_service_input: 'coffee' }).catch((e) => {
        t.diagnostic('DB unavailable, skipping: ' + e.message);
        return null;
    });
    if (rows === null) return;

    assert.ok(Array.isArray(rows), 'bare array response');
    for (const row of rows) {
        assert.ok(typeof row.business_name === 'string', 'business_name present');
        assert.ok(row.banner, 'banner present');
        assert.ok(row.logo, 'logo present');
        assert.ok(row.uuid, 'uuid present');
        assert.ok(!('password' in row), 'no credentials leaked');
        assert.ok(!('email_or_social_media' in row), 'no email leaked');
        assert.ok(!Object.keys(row).some((k) => k.includes('.')), 'no dotted/dirty keys');
    }
});

test('base search with no filters still returns array (possibly empty)', async (t) => {
    const rows = await runLive({}).catch((e) => {
        t.diagnostic('DB unavailable, skipping: ' + e.message);
        return null;
    });
    if (rows === null) return;
    assert.ok(Array.isArray(rows));
});

test('OR semantics: company + minor search returns the union of both facet results', async (t) => {
    const byCompany = await runLive({ company_name_input: 'All World' }).catch((e) => {
        t.diagnostic('DB unavailable, skipping: ' + e.message);
        return null;
    });
    if (byCompany === null) return;

    const byMinor = await runLive({ minor_sub_categories: '148' }).catch(() => null);
    if (byMinor === null) return;

    const both = await runLive({ company_name_input: 'All World', minor_sub_categories: '148' });
    const bothIds = new Set(both.map((r) => r.id));

    for (const row of byCompany) {
        assert.ok(bothIds.has(row.id), `company match "${row.business_name}" included in union`);
    }
    for (const row of byMinor) {
        assert.ok(bothIds.has(row.id), `minor match "${row.business_name}" included in union`);
    }
});

test('security: SQL injection payloads are treated as data (no syntax error, no leak, no bulk rows)', async (t) => {
    const payloads = [
        { minor_sub_categories: "' OR '1'='1" },
        { minor_sub_categories: "' OR '1'='1' -- " },
        { product_service_input: "' UNION SELECT password FROM users_accounts -- " },
        { company_name_input: 'x"; DROP TABLE users_accounts; -- ' },
        { product_service_input: "x' OR '1'='1' UNION SELECT * FROM users_accounts -- " },
        { product_service_input: '`x` OR 1=1/*' },
        { product_service_input: "Co'ffee OR 1=1--" },
        { company_name_input: "%' OR '1'='1" },
    ];

    for (const payload of payloads) {
        let rows;
        try {
            rows = await runLive(payload);
        } catch (e) {
            assert.fail(`payload crashed the query: ${JSON.stringify(payload)} -> ${e.message}`);
        }
        assert.ok(Array.isArray(rows), `array response for ${JSON.stringify(payload)}`);
        for (const row of rows) {
            assert.ok(!('password' in row), 'no password column exposed');
            assert.ok(!('email_or_social_media' in row), 'no email exposed');
        }
        // An injected `' OR '1'='1` on minor_sub_category must NOT surface every
        // business: that value matches zero rows in the data.
        if (payload.minor_sub_categories) {
            assert.strictEqual(rows.length, 0, `injected minor_sub_categories returned ${rows.length} rows`);
        }
    }
});
