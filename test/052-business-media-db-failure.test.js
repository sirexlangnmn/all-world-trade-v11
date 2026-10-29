const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const executeBusinessMediaQuery = require('../app/utils/business-media-persistence.js');

async function createUploadFixture(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'awt-media-persistence-test-'));
    const uploadDirectory = path.join(root, 'uploads');
    await fs.mkdir(uploadDirectory);

    t.after(() => fs.rm(root, { recursive: true, force: true }));

    return {
        uploadDirectory,
        makeFile: async (filename, contents = filename) => {
            const filePath = path.join(uploadDirectory, filename);
            await fs.writeFile(filePath, contents);
            return { filename, path: filePath };
        },
    };
}

function createResponse() {
    let resolveResponse;
    const responseSent = new Promise((resolve) => {
        resolveResponse = resolve;
    });
    const state = { headersSent: false, statusCode: 200, body: undefined, sendCount: 0 };
    const response = {
        get headersSent() {
            return state.headersSent;
        },
        status(statusCode) {
            state.statusCode = statusCode;
            return this;
        },
        send(body) {
            state.body = body;
            state.headersSent = true;
            state.sendCount += 1;
            resolveResponse();
            return this;
        },
        json(body) {
            state.body = body;
            state.headersSent = true;
            state.sendCount += 1;
            resolveResponse();
            return this;
        },
    };

    return { response, responseSent, state };
}

function createLogger() {
    const entries = [];
    return {
        entries,
        error: (...args) => entries.push(args),
    };
}

test('successful persistence forwards the query and preserves the existing response and file', async (t) => {
    const fixture = await createUploadFixture(t);
    const uploadedFile = await fixture.makeFile('companyLogo-1.png');
    const req = { files: { companyLogo: [uploadedFile] } };
    const { response, state } = createResponse();
    const query = 'INSERT INTO users_business_medias (logo) VALUES (?)';
    const values = [uploadedFile.filename];
    const result = { affectedRows: 0 };
    const logger = createLogger();
    let callbackResult;

    const db = {
        query(actualQuery, actualValues, callback) {
            assert.equal(actualQuery, query);
            assert.equal(actualValues, values);
            callback(null, result);
        },
    };

    executeBusinessMediaQuery(
        db,
        req,
        response,
        query,
        values,
        (error, actualResult) => {
            callbackResult = actualResult;
            assert.equal(error, null);
            response.send('success upload files');
        },
        { uploadDirectory: fixture.uploadDirectory, logger },
    );

    assert.equal(callbackResult, result);
    assert.equal(state.statusCode, 200);
    assert.equal(state.body, 'success upload files');
    assert.equal(state.sendCount, 1);
    assert.equal(await fs.readFile(uploadedFile.path, 'utf8'), uploadedFile.filename);
    assert.deepEqual(logger.entries, []);
});

test('database failure removes all request files and preserves unrelated existing media', async (t) => {
    const fixture = await createUploadFixture(t);
    const logo = await fixture.makeFile('companyLogo-new.png');
    const banner = await fixture.makeFile('companyBanner-new.png');
    const existing = await fixture.makeFile('companyLogo-existing.png', 'old media');
    const req = { files: { companyLogo: [logo], companyBanner: [banner] } };
    const { response, responseSent, state } = createResponse();
    const databaseError = new Error('sensitive SQL and database details');
    const logger = createLogger();
    const db = { query: (_query, _values, callback) => callback(databaseError) };

    executeBusinessMediaQuery(
        db,
        req,
        response,
        'INSERT query',
        [],
        () => assert.fail('success callback must not run after a database error'),
        { uploadDirectory: fixture.uploadDirectory, logger },
    );
    await responseSent;

    assert.equal(state.statusCode, 500);
    assert.deepEqual(state.body, { status: 'error', message: 'The upload could not be saved.' });
    assert.equal(state.sendCount, 1);
    await assert.rejects(fs.access(logo.path), { code: 'ENOENT' });
    await assert.rejects(fs.access(banner.path), { code: 'ENOENT' });
    assert.equal(await fs.readFile(existing.path, 'utf8'), 'old media');
    assert.equal(logger.entries[0][1], databaseError);
    assert.equal(JSON.stringify(state.body).includes('sensitive'), false);
});

test('failed replacement removes its new file but leaves the previous media untouched', async (t) => {
    const fixture = await createUploadFixture(t);
    const replacement = await fixture.makeFile('brochure-new.pdf');
    const existing = await fixture.makeFile('brochure-old.pdf', 'previous brochure');
    const req = { files: { editBrochure: [replacement] } };
    const { response, responseSent, state } = createResponse();
    const db = { query: (_query, _values, callback) => callback(new Error('update failed')) };

    executeBusinessMediaQuery(
        db,
        req,
        response,
        'UPDATE query',
        [replacement.filename],
        () => assert.fail('success callback must not run after a failed replacement'),
        { uploadDirectory: fixture.uploadDirectory, logger: createLogger() },
    );
    await responseSent;

    assert.equal(state.statusCode, 500);
    await assert.rejects(fs.access(replacement.path), { code: 'ENOENT' });
    assert.equal(await fs.readFile(existing.path, 'utf8'), 'previous brochure');
});

test('a failed nested SELECT removes files before the route can continue to a write', async (t) => {
    const fixture = await createUploadFixture(t);
    const uploadedFile = await fixture.makeFile('companyBanner-new.png');
    const req = { files: { companyBanner: [uploadedFile] } };
    const { response, responseSent, state } = createResponse();
    const db = { query: (_query, _values, callback) => callback(new Error('select failed')) };

    executeBusinessMediaQuery(
        db,
        req,
        response,
        'SELECT_ROW',
        'business-uuid',
        () => {
            assert.fail('nested write flow must stop after a failed SELECT');
        },
        {
            uploadDirectory: fixture.uploadDirectory,
            logger: createLogger(),
        },
    );
    await responseSent;

    assert.equal(state.statusCode, 500);
    await assert.rejects(fs.access(uploadedFile.path), { code: 'ENOENT' });
});

test('synchronous database errors use the same cleanup and response path', async (t) => {
    const fixture = await createUploadFixture(t);
    const uploadedFile = await fixture.makeFile('brochure-new.pdf');
    const req = { files: { brochureInput: [uploadedFile] } };
    const { response, responseSent, state } = createResponse();
    const databaseError = new Error('synchronous database failure');
    const logger = createLogger();

    executeBusinessMediaQuery(
        {
            query: () => {
                throw databaseError;
            },
        },
        req,
        response,
        'INSERT query',
        [],
        () => assert.fail('success callback must not run after a database exception'),
        { uploadDirectory: fixture.uploadDirectory, logger },
    );
    await responseSent;

    assert.equal(state.statusCode, 500);
    await assert.rejects(fs.access(uploadedFile.path), { code: 'ENOENT' });
    assert.equal(logger.entries[0][1], databaseError);
});

test('cleanup errors are logged and still return one sanitized failure response', async (t) => {
    const fixture = await createUploadFixture(t);
    const uploadedFile = await fixture.makeFile('companyLogo-2.png');
    const req = { files: { companyLogo: [uploadedFile] } };
    const { response, responseSent, state } = createResponse();
    const databaseError = new Error('database failure');
    const cleanupError = Object.assign(new Error('permission denied at private path'), { code: 'EACCES' });
    const logger = createLogger();
    let unlinkCount = 0;
    const db = {
        query(_query, _values, callback) {
            callback(databaseError);
            callback(new Error('duplicate callback'));
        },
    };

    executeBusinessMediaQuery(db, req, response, 'INSERT query', [], () => {}, {
        uploadDirectory: fixture.uploadDirectory,
        logger,
        unlink: async () => {
            unlinkCount += 1;
            throw cleanupError;
        },
    });
    await responseSent;

    assert.equal(state.statusCode, 500);
    assert.deepEqual(state.body, { status: 'error', message: 'The upload could not be saved.' });
    assert.equal(state.sendCount, 1);
    assert.equal(unlinkCount, 1);
    assert.equal(logger.entries.length, 2);
    assert.equal(logger.entries[0][1], databaseError);
    assert.equal(logger.entries[1][1], cleanupError);
    assert.equal(JSON.stringify(state.body).includes('permission denied'), false);
});

test('cleanup ignores ENOENT without hiding the persistence failure', async (t) => {
    const fixture = await createUploadFixture(t);
    const uploadedFile = await fixture.makeFile('companyLogo-already-removed.png');
    const req = { files: { companyLogo: [uploadedFile] } };
    const { response, responseSent, state } = createResponse();
    const databaseError = new Error('database failure');
    const logger = createLogger();
    const db = { query: (_query, _values, callback) => callback(databaseError) };

    executeBusinessMediaQuery(db, req, response, 'INSERT query', [], () => {}, {
        uploadDirectory: fixture.uploadDirectory,
        logger,
        unlink: async () => {
            throw Object.assign(new Error('already removed'), { code: 'ENOENT' });
        },
    });
    await responseSent;

    assert.equal(state.statusCode, 500);
    assert.deepEqual(logger.entries, [['Business media persistence failed:', databaseError]]);
});

test('a failure after headers are sent still cleans files without a second response', async (t) => {
    const fixture = await createUploadFixture(t);
    const uploadedFile = await fixture.makeFile('companyLogo-after-response.png');
    const req = { files: { companyLogo: [uploadedFile] } };
    const { response, state } = createResponse();
    response.send('already sent');
    let resolveCleanup;
    const cleanupComplete = new Promise((resolve) => {
        resolveCleanup = resolve;
    });

    executeBusinessMediaQuery(
        { query: (_query, _values, callback) => callback(new Error('late database error')) },
        req,
        response,
        'INSERT query',
        [],
        () => {},
        {
            uploadDirectory: fixture.uploadDirectory,
            logger: createLogger(),
            unlink: async (filePath) => {
                await fs.unlink(filePath);
                resolveCleanup();
            },
        },
    );
    await cleanupComplete;

    assert.equal(state.sendCount, 1);
    assert.equal(state.body, 'already sent');
    await assert.rejects(fs.access(uploadedFile.path), { code: 'ENOENT' });
});

test('cleanup refuses paths outside the configured upload directory', async (t) => {
    const fixture = await createUploadFixture(t);
    const outsidePath = path.join(path.dirname(fixture.uploadDirectory), 'not-an-upload.txt');
    await fs.writeFile(outsidePath, 'do not delete');
    t.after(() => fs.rm(outsidePath, { force: true }));

    const req = { files: { companyLogo: [{ path: outsidePath }] } };
    const { response, responseSent, state } = createResponse();
    const logger = createLogger();
    const db = { query: (_query, _values, callback) => callback(new Error('database failure')) };

    executeBusinessMediaQuery(db, req, response, 'INSERT query', [], () => {}, {
        uploadDirectory: fixture.uploadDirectory,
        logger,
    });
    await responseSent;

    assert.equal(state.statusCode, 500);
    assert.equal(await fs.readFile(outsidePath, 'utf8'), 'do not delete');
    assert.equal(logger.entries.length, 2);
    assert.match(logger.entries[1][1].message, /outside the upload directory/);
});

test('configured media routes share handlers and retain no-upload registration', async () => {
    const routePath = path.join(__dirname, '../app/routes/upload-file.js');
    const routeSource = await fs.readFile(routePath, 'utf8');
    const {
        REGISTRATION_UPLOAD_ROUTES,
        STANDALONE_UPLOAD_ROUTES,
        UPGRADE_UPLOAD_ROUTES,
    } = require('../app/utils/business-media-upload-config.js');
    const noUploadRouteStart = routeSource.indexOf("app.post('/api/post/registration-no-upload'");
    const noUploadRouteEnd = routeSource.indexOf('const getUploadUuid', noUploadRouteStart);
    const noUploadRoute = routeSource.slice(noUploadRouteStart, noUploadRouteEnd);

    assert.notEqual(noUploadRouteStart, -1);
    assert.match(noUploadRoute, /db\.query\(query, values/);
    assert.doesNotMatch(noUploadRoute, /upload\.fields/);
    assert.match(routeSource, /for \(const \[route, groups\] of REGISTRATION_UPLOAD_ROUTES\)/);
    assert.match(routeSource, /for \(const \[route, groups\] of UPGRADE_UPLOAD_ROUTES\)/);
    assert.match(routeSource, /for \(const routeConfiguration of STANDALONE_UPLOAD_ROUTES\)/);
    assert.match(routeSource, /STANDALONE_UPLOAD_ROUTES\.find\(\(\{ operation \}\) => operation === 'upsert'\)/);
    assert.equal(REGISTRATION_UPLOAD_ROUTES.length, 30);
    assert.equal(UPGRADE_UPLOAD_ROUTES.length, 7);
    assert.equal(STANDALONE_UPLOAD_ROUTES.length, 8);
});
