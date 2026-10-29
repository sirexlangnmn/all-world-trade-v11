const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const USERS_BUSINESS_MEDIAS = require('../app/query/users_business_medias.query.js');
const {
    MEDIA_GROUPS,
    REGISTRATION_UPLOAD_ROUTES,
    STANDALONE_UPLOAD_ROUTES,
    UPGRADE_UPLOAD_ROUTES,
    createMediaUploadHandler,
    getUploadFields,
    mapBusinessMedia,
} = require('../app/utils/business-media-upload-config.js');

function combinations(items, size, offset = 0, current = [], result = []) {
    if (current.length === size) {
        result.push([...current]);
        return result;
    }

    for (let index = offset; index < items.length; index += 1) {
        combinations(items, size, index + 1, [...current, items[index]], result);
    }
    return result;
}

test('registration routes cover each currently exposed media-group combination exactly once', () => {
    const groups = Object.keys(MEDIA_GROUPS);
    const expected = groups.flatMap((_, index) =>
        combinations(groups, index + 1).map((combination) => combination.slice().sort().join(',')),
    );
    // The existing browser client has no video+brochure+webinar-only registration endpoint.
    const combinationWithoutEndpoint = expected.indexOf('brochure,video,webinar');
    assert.notEqual(combinationWithoutEndpoint, -1);
    expected.splice(combinationWithoutEndpoint, 1);
    const actual = REGISTRATION_UPLOAD_ROUTES.map(([, routeGroups]) => routeGroups.slice().sort().join(','));

    assert.equal(new Set(REGISTRATION_UPLOAD_ROUTES.map(([route]) => route)).size, REGISTRATION_UPLOAD_ROUTES.length);
    assert.deepEqual(actual.sort(), expected.sort());
});

test('all registration upload URLs used by the browser remain registered', () => {
    const clientPath = path.join(__dirname, '../public/assets/js/traders-registration-upload-medias.js');
    const clientSource = fs.readFileSync(clientPath, 'utf8');
    const clientRoutes = [...clientSource.matchAll(/['"](\/api\/post\/registration-upload[^'"]+)['"]/g)].map(
        ([, route]) => route,
    );
    const configuredRoutes = REGISTRATION_UPLOAD_ROUTES.map(([route]) => route);

    assert.deepEqual([...new Set(configuredRoutes)].sort(), [...new Set(clientRoutes)].sort());
});

test('all upgrade upload URLs used by the browser remain registered', () => {
    const clientPath = path.join(__dirname, '../public/assets/js/upgrade-to-traders-upload-medias.js');
    const clientSource = fs.readFileSync(clientPath, 'utf8');
    const clientRoutes = [...clientSource.matchAll(/['"](\/api\/post\/upgrade-upload[^'"]+)['"]/g)].map(
        ([, route]) => route,
    );
    const configuredRoutes = UPGRADE_UPLOAD_ROUTES.map(([route]) => route);

    assert.deepEqual([...new Set(configuredRoutes)].sort(), [...new Set(clientRoutes)].sort());
});

test('all tier-specific registration upload URLs remain configured', () => {
    const scriptsPath = path.join(__dirname, '../public/assets/js');
    const clientRoutes = fs
        .readdirSync(scriptsPath)
        .filter((fileName) => fileName.endsWith('.js'))
        .flatMap((fileName) => {
            const source = fs.readFileSync(path.join(scriptsPath, fileName), 'utf8');
            return [...source.matchAll(/['"](\/api\/post\/registration-upload[^'"]+)['"]/g)].map(([, route]) => route);
        });
    const configuredRoutes = REGISTRATION_UPLOAD_ROUTES.map(([route]) => route);

    assert.ok(clientRoutes.length > 0);
    assert.deepEqual([...new Set(configuredRoutes)].sort(), [...new Set(clientRoutes)].sort());
});

test('standalone upload routes retain their field policies and persistence semantics', () => {
    const expected = [
        [
            '/api/post/upload-users-business-medias',
            ['companyLogo', 'companyBanner', 'videoInput', 'thumbnailInput', 'brochureInput', 'webinarsThumbnailInput'],
            'insert',
            'body',
        ],
        [
            '/api/post/upload-users-business-medias2',
            ['videoInput', 'thumbnailInput', 'brochureInput', 'webinarsThumbnailInput'],
            'update',
            'body',
        ],
        ['/api/post/upload-video2', ['videoInput', 'thumbnailInput'], 'insert', 'sessionRaw'],
        ['/api/post/upload-brochure', ['brochure'], 'insert', 'sessionRaw'],
        ['/api/post/update-upload-brochure', ['editBrochure'], 'update', 'session'],
        ['/api/post/update-trader-company-logo', ['companyLogo'], 'update', 'session'],
        ['/api/post/update-trader-company-banner', ['companyBanner'], 'upsert', 'session'],
        ['/api/post/users-medias-process', ['companyLogo', 'companyBanner'], 'insert', 'body'],
    ];
    const actual = STANDALONE_UPLOAD_ROUTES.map(({ route, groups, operation, uuidSource }) => [
        route,
        getUploadFields(groups).map(({ name }) => name),
        operation,
        uuidSource,
    ]);

    assert.deepEqual(actual, expected);
    assert.equal(new Set(actual.map(([route]) => route)).size, actual.length);
});

test('each configured route allows only its configured multipart fields', () => {
    for (const [, groups] of [...REGISTRATION_UPLOAD_ROUTES, ...UPGRADE_UPLOAD_ROUTES]) {
        const fields = getUploadFields(groups);
        assert.deepEqual(
            fields,
            groups.map((group) => ({ name: MEDIA_GROUPS[group].field, maxCount: 1 })),
        );
    }

    assert.throws(() => getUploadFields(['videoInput']), /Unknown business media group/);
});

test('standalone field mappings preserve uploaded filenames and endpoint-specific metadata', () => {
    const req = {
        files: {
            videoInput: [{ filename: 'videoInput-test.mp4' }],
            thumbnailInput: [{ filename: 'thumbnail-test.png' }],
            editBrochure: [{ filename: 'editBrochure-test.pdf' }],
        },
        body: {
            videoTitle: 'Video title',
            videoDescription: 'Video description',
            editBrochureTitle: 'Updated brochure',
        },
    };

    assert.deepEqual(
        Object.fromEntries(
            Object.entries(mapBusinessMedia(req, ['videoFile', 'video'])).filter(([key]) => key !== 'date_created'),
        ),
        {
            video: 'videoInput-test.mp4',
            video_thumbnail: 'thumbnail-test.png',
            video_link: undefined,
            video_title: 'Video title',
            video_description: 'Video description',
            uuid: undefined,
        },
    );

    const brochure = mapBusinessMedia(req, ['editBrochureFile'], 'business-uuid');
    assert.equal(brochure.brochure, 'editBrochure-test.pdf');
    assert.equal(brochure.brochure_title, 'Updated brochure');
    assert.equal(brochure.uuid, 'business-uuid');
});

test('media mapping binds generated filenames and request metadata to fixed columns', () => {
    const req = {
        files: {
            companyLogo: [{ filename: 'companyLogo-test.png' }],
            thumbnailInput: [{ filename: 'thumbnail-test.png' }],
        },
        body: {
            videoLink: 'https://example.test/video',
            videoTitle: 'Product overview',
            videoDescription: 'Business video',
            uuid: 'business-uuid',
        },
    };

    const media = mapBusinessMedia(req, ['logo', 'video']);
    assert.deepEqual(Object.keys(media), [
        'logo',
        'video_thumbnail',
        'video_link',
        'video_title',
        'video_description',
        'uuid',
        'date_created',
    ]);
    assert.equal(media.logo, 'companyLogo-test.png');
    assert.equal(media.video_thumbnail, 'thumbnail-test.png');
    assert.equal(media.video_link, 'https://example.test/video');
    assert.equal(media.uuid, 'business-uuid');
    assert.match(media.date_created, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
});

test('insert and update builders bind values and reject request-controlled columns', () => {
    const create = USERS_BUSINESS_MEDIAS.buildInsert({
        logo: 'logo.png',
        brochure_title: 'Catalog',
        uuid: 'business-uuid',
        date_created: '2026-10-29 12:00:00',
    });
    assert.equal(
        create.query,
        'INSERT INTO users_business_medias (logo, brochure_title, uuid, date_created) VALUES (?, ?, ?, ?)',
    );
    assert.deepEqual(create.values, ['logo.png', 'Catalog', 'business-uuid', '2026-10-29 12:00:00']);

    const update = USERS_BUSINESS_MEDIAS.buildUpdate(
        { banner: 'banner.png', date_created: 'updated' },
        'business-uuid',
    );
    assert.equal(update.query, 'UPDATE users_business_medias SET banner = ?, date_created = ? WHERE uuid = ?');
    assert.deepEqual(update.values, ['banner.png', 'updated', 'business-uuid']);
    assert.doesNotMatch(update.query, /logo/);

    assert.throws(
        () => USERS_BUSINESS_MEDIAS.buildInsert({ 'logo, status': 'unsafe' }),
        /Invalid business media columns/,
    );
    assert.throws(() => USERS_BUSINESS_MEDIAS.buildUpdate({}, 'business-uuid'), /Invalid business media columns/);
});

test('shared upload handler preserves the success response and update UUID predicate', () => {
    const calls = [];
    const response = {
        send: (body) => calls.push(['response', body]),
    };
    const req = {
        files: {
            companyLogo: [{ filename: 'companyLogo-test.png' }],
        },
        body: { uuid: 'business-uuid' },
    };
    const handler = createMediaUploadHandler({
        buildQuery: (values, request) => USERS_BUSINESS_MEDIAS.buildUpdate(values, request.body.uuid),
        runBusinessMediaQuery: (request, res, query, values, callback) => {
            calls.push(['query', query, values]);
            callback(null, {});
        },
        logger: { log: (message) => calls.push(['log', message]) },
    });

    handler(['logo'])(req, response);

    assert.equal(calls[0][0], 'query');
    assert.match(calls[0][1], /UPDATE users_business_medias SET logo = \?, date_created = \? WHERE uuid = \?/);
    assert.equal(calls[0][2][0], 'companyLogo-test.png');
    assert.equal(calls[0][2][2], 'business-uuid');
    assert.match(calls[0][2][1], /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    assert.deepEqual(calls[1], ['response', 'success upload files']);
});

test('shared upload handler runs route hooks and preserves endpoint-specific success text', () => {
    const calls = [];
    const handler = createMediaUploadHandler({
        buildQuery: (values) => USERS_BUSINESS_MEDIAS.buildInsert(values),
        runBusinessMediaQuery: (req, res, query, values, callback) => callback(null, {}),
        successResponse: 'success',
        beforeUpload: () => calls.push('before-upload'),
        logger: { log: (message) => calls.push(message) },
    });
    const response = { send: (body) => calls.push(body) };
    const req = {
        files: { brochure: [{ filename: 'brochure-test.pdf' }] },
        body: { uuid: 'business-uuid', brochureTitle: 'Brochure' },
    };

    handler(['brochureFile'])(req, response);

    assert.deepEqual(calls, ['before-upload', 'success', 'success upload files']);
});
