// Regression + performance tests for docs/tasks/021-ORDER-BY-RAND-Performance.md
// (CODE_REVIEW Finding 21 -- ORDER BY RAND() full-sort in getRandomCompanies).
//
// Run: node --test test/021-ORDER-BY-RAND-Performance.test.js
//
// The model stays on the frozen legacy mysql2 stack (Finding 34); the actual
// pool is replaced in require.cache so the suite is offline by default. A live
// integration case only runs when the configured database accepts a query.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config();

const dbModulePath = require.resolve('../app/models/db.js');
const fakeDb = {
    query: null,
    end: (callback) => {
        if (callback) callback();
    },
};
require.cache[dbModulePath] = {
    id: dbModulePath,
    filename: dbModulePath,
    loaded: true,
    exports: fakeDb,
};

const Model = require('../app/models/selection.model.js');

const MODEL_PATH = path.join(__dirname, '..', 'app', 'models', 'selection.model.js');
const LEGACY_KEYS = [
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
    'business_industry_belong_to',
    'business_major_category',
    'business_sub_category',
    'business_minor_sub_category',
    'business_scale',
    'banner',
    'logo',
];

// --- Pure helper: computeRandomOffset -------------------------------------

function assertInRange(offset, total, limit) {
    assert.ok(Number.isInteger(offset), `offset is an integer (got ${offset})`);
    assert.ok(offset >= 0, `offset is not negative (got ${offset})`);
    assert.ok(offset <= Math.max(total - limit, 0), `offset stays inside [0, ${Math.max(total - limit, 0)}]`);
}

test('computeRandomOffset returns 0 when there is no room to shuffle', () => {
    for (const total of [0, 1, 4, 5]) {
        assert.strictEqual(Model.computeRandomOffset(total, 5), 0, `total=${total}`);
    }
});

test('computeRandomOffset stays inside the padded window for every random seed', () => {
    const totals = [0, 1, 4, 5, 6, 1000];
    const seeds = [0, 0.5, 0.999999999999, Number.NaN, -1, 2];

    for (const total of totals) {
        for (const seed of seeds) {
            const offset = Model.computeRandomOffset(total, 5, seed);
            assertInRange(offset, total, 5);
        }
    }
});

test('computeRandomOffset maps the extremes to the first and last valid windows', () => {
    assert.strictEqual(Model.computeRandomOffset(6, 5, 0), 0);
    assert.strictEqual(Model.computeRandomOffset(6, 5, 0.999999999999), 1);
    assert.strictEqual(Model.computeRandomOffset(1000, 5, 0), 0);
    assert.strictEqual(Model.computeRandomOffset(1000, 5, 0.999999999999), 995);
});

test('computeRandomOffset tolerates invalid input without throwing', () => {
    assert.strictEqual(Model.computeRandomOffset(undefined, 5, 0.5), 0);
    assert.strictEqual(Model.computeRandomOffset(10, 0, 0.5), 0);
    assert.strictEqual(Model.computeRandomOffset(-3, 5, 0.5), 0);
});

test('computeRandomOffset default path actually samples Math.random', () => {
    const original = Math.random;
    try {
        Math.random = () => 0.999999999;
        assert.strictEqual(
            Model.computeRandomOffset(1000, 5),
            995,
            'default uses Math.random(), not the function object',
        );
        Math.random = () => 0;
        assert.strictEqual(Model.computeRandomOffset(1000, 5), 0);
    } finally {
        Math.random = original;
    }
});

test('computeRandomOffset accepts a function seed as well as a number', () => {
    assert.strictEqual(
        Model.computeRandomOffset(1000, 5, () => 0.999999999),
        995,
    );
    assert.strictEqual(
        Model.computeRandomOffset(1000, 5, () => 0),
        0,
    );
});

// --- Query shape: no full random sort, bounded window ---------------------

test('active getRandomCompanies sql no longer uses ORDER BY RAND()', () => {
    const source = fs.readFileSync(MODEL_PATH, 'utf8');
    assert.ok(!/ORDER\s+BY\s+RAND\s*\(/i.test(source), 'no active ORDER BY RAND() remains');
    assert.match(source, /ORDER BY users_businesses\.id ASC/);
    assert.match(source, /LIMIT \? OFFSET \?/);
});

test('count and data queries keep the same eligibility filters and inner joins', () => {
    const source = fs.readFileSync(MODEL_PATH, 'utf8');
    const start = source.indexOf('Model.getRandomCompanies');
    const active = source.slice(start);

    assert.match(active, /SELECT COUNT\(\*\) AS total/);
    assert.match(active, /users_business_medias\.banner != ''/);
    assert.match(active, /users_business_medias\.logo != ''/);
    assert.match(active, /users_businesses\.isPaid = 1/);
    assert.match(active, /JOIN users_business_characteristics/);
    assert.match(active, /JOIN users_business_medias/);
    assert.match(active, /FROM users_businesses/);
});

test('the selected column list matches the legacy response contract', () => {
    const source = fs.readFileSync(MODEL_PATH, 'utf8');
    const start = source.indexOf('Model.getRandomCompanies');
    const selectStart = source.indexOf('const selectColumns', start);
    const selectEnd = source.indexOf('const fromClause', selectStart);
    const selectSql = source.slice(selectStart, selectEnd);

    for (const key of LEGACY_KEYS) {
        assert.match(selectSql, new RegExp(`\\b${key}\\b`), `select keeps ${key}`);
    }
});

test('route and client keep the POST /api/get/get-random-companies contract', () => {
    const routeSource = fs.readFileSync(path.join(__dirname, '..', 'app', 'routes', 'index.js'), 'utf8');
    assert.match(
        routeSource,
        /app\.post\(\['\/api\/get\/get-random-companies'\], selection\.findRandomCompanies\)/,
        'route registration is unchanged',
    );

    const clientSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'js', 'selection.js'), 'utf8');
    assert.match(clientSource, /url: '\/api\/get\/get-random-companies'/, 'client still calls the same URL');
    assert.match(clientSource, /type: 'POST'/, 'client still uses POST');
});

test('application code contains no active ORDER BY RAND()', () => {
    const appDir = path.join(__dirname, '..', 'app');
    const offenders = [];

    function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.isFile() && entry.name.endsWith('.js')) {
                if (/ORDER\s+BY\s+RAND\s*\(/i.test(fs.readFileSync(full, 'utf8'))) offenders.push(full);
            }
        }
    }

    walk(appDir);
    assert.deepStrictEqual(offenders, [], 'no active ORDER BY RAND() under app/');
});

// --- Behavior with a stubbed pool ----------------------------------------

function withFakeQuery(handler, action) {
    return new Promise((resolve, reject) => {
        fakeDb.query = handler;
        try {
            action((err, data) => {
                try {
                    resolve({ err, data });
                } catch (e) {
                    reject(e);
                }
            });
        } catch (e) {
            reject(e);
        }
    });
}

test('happy path runs COUNT then a bounded LIMIT/OFFSET window', async () => {
    const calls = [];
    const rows = [{ id: 7, business_name: 'Window Co', banner: 'b.jpg', logo: 'l.jpg' }];

    const { err, data } = await withFakeQuery(
        (query, paramsOrCallback, maybeCallback) => {
            const params = typeof paramsOrCallback === 'function' ? [] : paramsOrCallback;
            const callback = typeof paramsOrCallback === 'function' ? paramsOrCallback : maybeCallback;
            calls.push({ query, params });

            if (/SELECT COUNT\(\*\) AS total/.test(query)) {
                callback(null, [{ total: 12 }]);
            } else {
                callback(null, rows);
            }
        },
        (done) => Model.getRandomCompanies(done),
    );

    assert.strictEqual(err, null);
    assert.deepStrictEqual(data, rows);
    assert.strictEqual(calls.length, 2);

    const [countCall, pageCall] = calls;
    assert.match(countCall.query, /WHERE users_business_medias\.banner != ''/);
    assert.match(pageCall.query, /ORDER BY users_businesses\.id ASC LIMIT \? OFFSET \?/);
    assert.deepStrictEqual(pageCall.params.slice(0, 1), [5]);
    assertInRange(pageCall.params[1], 12, 5);
});

test('an empty eligible set returns [] without running the window query', async () => {
    const calls = [];

    const { err, data } = await withFakeQuery(
        (query, paramsOrCallback, maybeCallback) => {
            const callback = typeof paramsOrCallback === 'function' ? paramsOrCallback : maybeCallback;
            calls.push(query);
            callback(null, [{ total: 0 }]);
        },
        (done) => Model.getRandomCompanies(done),
    );

    assert.strictEqual(err, null);
    assert.deepStrictEqual(data, []);
    assert.strictEqual(calls.length, 1);
});

test('a small eligible set reads from offset 0 and returns every row', async () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    let pageParams;

    const { err, data } = await withFakeQuery(
        (query, paramsOrCallback, maybeCallback) => {
            const params = typeof paramsOrCallback === 'function' ? [] : paramsOrCallback;
            const callback = typeof paramsOrCallback === 'function' ? paramsOrCallback : maybeCallback;
            if (/SELECT COUNT\(\*\) AS total/.test(query)) {
                callback(null, [{ total: 3 }]);
            } else {
                pageParams = params;
                callback(null, rows);
            }
        },
        (done) => Model.getRandomCompanies(done),
    );

    assert.strictEqual(err, null);
    assert.deepStrictEqual(data, rows);
    assert.deepStrictEqual(pageParams, [5, 0]);
});

test('media-join duplicates keep the legacy multiplicity (no DISTINCT added)', async () => {
    const duplicateRows = [
        { id: 3, business_name: 'Dup Co', banner: 'b1.jpg', logo: 'l1.jpg' },
        { id: 3, business_name: 'Dup Co', banner: 'b2.jpg', logo: 'l2.jpg' },
    ];
    const calls = [];

    const { err, data } = await withFakeQuery(
        (query, paramsOrCallback, maybeCallback) => {
            const params = typeof paramsOrCallback === 'function' ? [] : paramsOrCallback;
            const callback = typeof paramsOrCallback === 'function' ? paramsOrCallback : maybeCallback;
            calls.push({ query, params });

            if (/SELECT COUNT\(\*\) AS total/.test(query)) {
                callback(null, [{ total: 2 }]);
            } else {
                callback(null, duplicateRows);
            }
        },
        (done) => Model.getRandomCompanies(done),
    );

    assert.strictEqual(err, null);
    assert.deepStrictEqual(data, duplicateRows, 'model returns rows unchanged');
    assert.strictEqual(calls.length, 2);
    assert.ok(!/\bDISTINCT\b/i.test(calls[0].query), 'count keeps legacy multiplicity');
    assert.ok(!/\bDISTINCT\b/i.test(calls[1].query), 'page keeps legacy multiplicity');
});

test('count-query errors keep the legacy result(null, err) convention', async () => {
    const failure = new Error('count failed');

    const { err, data } = await withFakeQuery(
        (query, paramsOrCallback, maybeCallback) => {
            const callback = typeof paramsOrCallback === 'function' ? paramsOrCallback : maybeCallback;
            callback(failure);
        },
        (done) => Model.getRandomCompanies(done),
    );

    assert.strictEqual(err, null);
    assert.strictEqual(data, failure);
});

test('window-query errors keep the legacy result(null, err) convention', async () => {
    const failure = new Error('window failed');

    const { err, data } = await withFakeQuery(
        (query, paramsOrCallback, maybeCallback) => {
            const callback = typeof paramsOrCallback === 'function' ? paramsOrCallback : maybeCallback;
            if (/SELECT COUNT\(\*\) AS total/.test(query)) {
                callback(null, [{ total: 10 }]);
            } else {
                callback(failure);
            }
        },
        (done) => Model.getRandomCompanies(done),
    );

    assert.strictEqual(err, null);
    assert.strictEqual(data, failure);
});

test('controller ignores request bodies (no request input reaches the query)', () => {
    const controllerSource = fs.readFileSync(
        path.join(__dirname, '..', 'app', 'controllers', 'selection.controller.js'),
        'utf8',
    );
    const start = controllerSource.lastIndexOf('exports.findRandomCompanies');
    const active = controllerSource.slice(start);

    assert.ok(!/req\.body/.test(active), 'findRandomCompanies does not read req.body');
    assert.match(active, /Model\.getRandomCompanies/);
});

// --- Integration: live DB (skips gracefully without connection) ----------

test('live getRandomCompanies returns a bare array of legacy-shaped rows (<=5)', async (t) => {
    const mysql = require('mysql2');
    const dbConfig = require('../app/config/db.config.js');

    const pool = mysql.createPool({
        host: dbConfig.HOST,
        user: dbConfig.USER,
        password: dbConfig.PASSWORD,
        database: dbConfig.DB,
        connectTimeout: 3000,
        connectionLimit: 1,
    });

    try {
        try {
            await pool.promise().query('SELECT 1');
        } catch (e) {
            t.diagnostic('DB unavailable, skipping: ' + e.message);
            return;
        }

        fakeDb.query = (query, paramsOrCallback, maybeCallback) => {
            const params = typeof paramsOrCallback === 'function' ? undefined : paramsOrCallback;
            const callback = typeof paramsOrCallback === 'function' ? paramsOrCallback : maybeCallback;
            if (params === undefined) return pool.query(query, callback);
            return pool.query(query, params, callback);
        };

        for (let attempt = 0; attempt < 3; attempt += 1) {
            const data = await new Promise((resolve, reject) => {
                Model.getRandomCompanies((err, rows) => (err ? reject(err) : resolve(rows)));
            });

            assert.ok(Array.isArray(data), 'bare array response');
            assert.ok(data.length <= 5, 'at most 5 rows');
            for (const row of data) {
                for (const key of LEGACY_KEYS) {
                    assert.ok(key in row, `row keeps ${key}`);
                }
            }
        }
    } finally {
        await pool.promise().end();
    }
});
