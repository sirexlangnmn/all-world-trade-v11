const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const database = { query: null };
const modelPath = require.resolve('../app/models/visitors-of-traders.model.js');
const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
    if (request === './db.js' && parent?.filename === modelPath) {
        return database;
    }

    return originalLoad.call(this, request, parent, isMain);
};

delete require.cache[modelPath];
const Model = require(modelPath);
Module._load = originalLoad;

const CHARACTERISTICS_QUERY = require('../app/query/users_business_characteristics.query.js').BUSINESS_CHARACTERISTIC;
const DETAILS_QUERY = require('../app/query/users_business.query.js').DETAILS;
const visitorsController = require('../app/controllers/visitors-of-traders.controller.js');
const traderUuid = 'trader-uuid';
const characteristics = {
    business_major_category: 10,
    business_sub_category: 20,
    business_minor_sub_category: 30,
    business_sub_category_str: '',
    business_minor_sub_category_str: '',
    business_industry_belong_to: 'industry',
    business_scale: 'scale',
};
const traderDetails = {
    business_name: 'Trader Business',
    business_website: 'https://example.test',
    business_email: 'trader@example.test',
};

function createSession() {
    return {
        items: [{ stale: true }],
        current_trader: { stale: true },
        current_trader_business_characteristics: { stale: true },
        current_trader_date_created: 'stale',
    };
}

function startLookup(session, onComplete) {
    Model.getCurrentTrader({ session, trader_uuid: traderUuid }, onComplete);
}

function nextTurn() {
    return new Promise((resolve) => setImmediate(resolve));
}

test('waits for all category titles and details, preserving session and result shapes', async () => {
    const session = createSession();
    const titleCallbacks = new Map();
    let detailsCallback;
    const titleIds = {
        trade_categories: 10,
        sub_categories: 20,
        minor_sub_categories: 30,
    };
    let callbackCount = 0;
    let callbackResult;

    database.query = (query, parameters, callback) => {
        if (query === CHARACTERISTICS_QUERY) {
            assert.deepEqual(parameters, [traderUuid]);
            callback(null, [characteristics]);
        } else if (query === DETAILS_QUERY) {
            assert.deepEqual(parameters, [traderUuid]);
            detailsCallback = callback;
        } else {
            const table = query.match(/^SELECT title FROM ([a-z_]+) WHERE id = \?$/)?.[1];
            assert.ok(table);
            assert.deepEqual(parameters, [titleIds[table]]);
            titleCallbacks.set(table, callback);
        }
    };

    startLookup(session, (err, data) => {
        callbackCount += 1;
        callbackResult = { err, data };
    });

    await nextTurn();
    assert.deepEqual([...titleCallbacks.keys()], ['trade_categories', 'sub_categories', 'minor_sub_categories']);
    assert.equal(callbackCount, 0);

    titleCallbacks.get('minor_sub_categories')(null, [{ title: 'Minor' }]);
    titleCallbacks.get('trade_categories')(null, [{ title: 'Major' }]);
    await nextTurn();
    assert.equal(callbackCount, 0, 'must wait for the remaining subcategory title');

    titleCallbacks.get('sub_categories')(null, [{ title: 'Sub' }]);
    await nextTurn();
    assert.equal(callbackCount, 0, 'must wait for trader details');

    detailsCallback(null, [traderDetails]);
    await nextTurn();
    assert.equal(callbackCount, 1);
    assert.equal(callbackResult.err, null);
    assert.deepEqual(callbackResult.data, [traderDetails]);
    assert.deepEqual(session.items, [
        { current_trader_major_category: 'Major' },
        { current_trader_sub_category: 'Sub' },
        { current_trader_minor_sub_category: 'Minor' },
        traderDetails,
    ]);
    assert.deepEqual(session.current_trader, traderDetails);
    assert.deepEqual(session.current_trader_business_characteristics, characteristics);
    assert.ok(session.current_trader_date_created);
});

test('binds category IDs and handles optional IDs and title rows without a match', async () => {
    const session = createSession();
    const optionalCharacteristics = {
        ...characteristics,
        business_major_category: null,
        business_sub_category: undefined,
        business_minor_sub_category: 'category-id',
    };
    let callbackResult;

    database.query = (query, parameters, callback) => {
        if (query === CHARACTERISTICS_QUERY) {
            callback(null, [optionalCharacteristics]);
        } else if (query === DETAILS_QUERY) {
            callback(null, [traderDetails]);
        } else {
            assert.match(query, /^SELECT title FROM minor_sub_categories WHERE id = \?$/);
            assert.deepEqual(parameters, ['category-id']);
            callback(null, []);
        }
    };

    startLookup(session, (err, data) => {
        callbackResult = { err, data };
    });
    await nextTurn();

    assert.equal(callbackResult.err, null);
    assert.deepEqual(callbackResult.data, [traderDetails]);
    assert.deepEqual(session.items, [traderDetails]);
    assert.equal(session.current_trader_major_category, null);
    assert.equal(session.current_trader_sub_category, null);
    assert.equal(session.current_trader_minor_sub_category, null);
});

for (const failedQuery of [
    ['characteristics', CHARACTERISTICS_QUERY],
    ['major title', 'SELECT title FROM trade_categories WHERE id = ?'],
    ['subcategory title', 'SELECT title FROM sub_categories WHERE id = ?'],
    ['minor-subcategory title', 'SELECT title FROM minor_sub_categories WHERE id = ?'],
    ['trader details', DETAILS_QUERY],
]) {
    test(`propagates ${failedQuery[0]} errors exactly once`, async () => {
        const session = createSession();
        const failure = new Error(`${failedQuery[0]} lookup failed`);
        let callbackCount = 0;
        let callbackResult;

        database.query = (query, parameters, callback) => {
            if (query === failedQuery[1]) {
                callback(failure);
                callback(null, []);
            } else if (query === CHARACTERISTICS_QUERY) {
                callback(null, [characteristics]);
            } else if (query === DETAILS_QUERY) {
                callback(null, [traderDetails]);
            } else {
                callback(null, [{ title: 'Category' }]);
            }
        };

        startLookup(session, (err, data) => {
            callbackCount += 1;
            callbackResult = { err, data };
        });
        await nextTurn();

        assert.equal(callbackCount, 1);
        assert.equal(callbackResult.err, failure);
        assert.equal(callbackResult.data, null);
        assert.deepEqual(session.items, []);
        assert.equal(session.current_trader, undefined);
        assert.equal(session.current_trader_business_characteristics, undefined);
        assert.equal(session.current_trader_date_created, undefined);
    });
}

test('reports missing characteristics and details rows as errors without partial session data', async (t) => {
    await t.test('missing characteristics', async () => {
        const session = createSession();
        database.query = (_query, _parameters, callback) => callback(null, []);
        const outcome = await new Promise((resolve) => {
            startLookup(session, (err, data) => resolve({ err, data }));
        });

        assert.match(outcome.err.message, /characteristics were not found/);
        assert.equal(outcome.data, null);
        assert.deepEqual(session.items, []);
    });

    await t.test('missing trader details', async () => {
        const session = createSession();
        database.query = (query, _parameters, callback) => {
            if (query === CHARACTERISTICS_QUERY) {
                callback(null, [characteristics]);
            } else if (query === DETAILS_QUERY) {
                callback(null, []);
            } else {
                callback(null, [{ title: 'Category' }]);
            }
        };
        const outcome = await new Promise((resolve) => {
            startLookup(session, (err, data) => resolve({ err, data }));
        });

        assert.match(outcome.err.message, /details were not found/);
        assert.equal(outcome.data, null);
        assert.deepEqual(session.items, []);
        assert.equal(session.current_trader, undefined);
    });
});

test('controller preserves the error response shape without exposing database errors', (t) => {
    const originalGetCurrentTrader = Model.getCurrentTrader;
    t.after(() => {
        Model.getCurrentTrader = originalGetCurrentTrader;
    });

    Model.getCurrentTrader = (_parameters, callback) => callback(new Error('database connection details'), null);
    const response = {
        statusCode: null,
        body: null,
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        send(body) {
            this.body = body;
        },
    };

    visitorsController.findCurrentTrader({ session: {}, body: { trader_uuid: traderUuid } }, response);

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { message: 'Some error occurred while retrieving current trader.' });
});
