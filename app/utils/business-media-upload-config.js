const MEDIA_GROUPS = Object.freeze({
    logo: {
        field: 'companyLogo',
        attributes: { logo: (req) => req.files.companyLogo[0].filename },
    },
    banner: {
        field: 'companyBanner',
        attributes: { banner: (req) => req.files.companyBanner[0].filename },
    },
    video: {
        field: 'thumbnailInput',
        attributes: {
            video_thumbnail: (req) => req.files.thumbnailInput[0].filename,
            video_link: (req) => req.body.videoLink,
            video_title: (req) => req.body.videoTitle,
            video_description: (req) => req.body.videoDescription,
        },
    },
    brochure: {
        field: 'brochureInput',
        attributes: {
            brochure: (req) => req.files.brochureInput[0].filename,
            brochure_title: (req) => req.body.brochureTitle,
        },
    },
    webinar: {
        field: 'webinarsThumbnailInput',
        attributes: {
            webinars_thumbnail: (req) => req.files.webinarsThumbnailInput[0].filename,
            webinars_title: (req) => req.body.webinarsTitle,
            webinars_description: (req) => req.body.webinarsDescription,
            webinars_link: (req) => req.body.webinarsLink,
            webinars_schedule: (req) => req.body.webinarsSchedule,
        },
    },
});

const STANDALONE_MEDIA_GROUPS = Object.freeze({
    videoFile: {
        field: 'videoInput',
        attributes: { video: (req) => req.files.videoInput[0].filename },
    },
    brochureFile: {
        field: 'brochure',
        attributes: {
            brochure: (req) => req.files.brochure[0].filename,
            brochure_title: (req) => req.body.brochureTitle,
        },
    },
    editBrochureFile: {
        field: 'editBrochure',
        attributes: {
            brochure: (req) => req.files.editBrochure[0].filename,
            brochure_title: (req) => req.body.editBrochureTitle,
        },
    },
});

const REGISTRATION_UPLOAD_ROUTES = Object.freeze([
    ['/api/post/registration-upload-all-users-business-medias', ['logo', 'banner', 'video', 'brochure', 'webinar']],
    ['/api/post/registration-upload-all-but-no-logo', ['banner', 'video', 'brochure', 'webinar']],
    ['/api/post/registration-upload-all-but-no-banner', ['logo', 'video', 'brochure', 'webinar']],
    ['/api/post/registration-upload-all-but-no-video', ['logo', 'banner', 'brochure', 'webinar']],
    ['/api/post/registration-upload-all-but-no-brochure', ['logo', 'banner', 'video', 'webinar']],
    ['/api/post/registration-upload-all-but-no-webinar', ['logo', 'banner', 'video', 'brochure']],
    ['/api/post/registration-upload-company-logo-banner-video', ['logo', 'banner', 'video']],
    ['/api/post/registration-upload-company-logo-banner-brochure', ['logo', 'banner', 'brochure']],
    ['/api/post/registration-upload-company-logo-banner-webinar', ['logo', 'banner', 'webinar']],
    ['/api/post/registration-upload-company-logo-video-brochure', ['logo', 'video', 'brochure']],
    ['/api/post/registration-upload-company-logo-video-webinar', ['logo', 'video', 'webinar']],
    ['/api/post/registration-upload-company-logo-brochure-webinar', ['logo', 'brochure', 'webinar']],
    ['/api/post/registration-upload-company-banner-video-brochure', ['banner', 'video', 'brochure']],
    ['/api/post/registration-upload-company-banner-video-webinar', ['banner', 'video', 'webinar']],
    ['/api/post/registration-upload-company-banner-brochure-webinar', ['banner', 'brochure', 'webinar']],
    ['/api/post/registration-upload-company-logo-banner', ['logo', 'banner']],
    ['/api/post/registration-upload-company-logo-video', ['logo', 'video']],
    ['/api/post/registration-upload-company-logo-brochure', ['logo', 'brochure']],
    ['/api/post/registration-upload-company-logo-webinar', ['logo', 'webinar']],
    ['/api/post/registration-upload-company-banner-video', ['banner', 'video']],
    ['/api/post/registration-upload-company-banner-brochure', ['banner', 'brochure']],
    ['/api/post/registration-upload-company-banner-webinar', ['banner', 'webinar']],
    ['/api/post/registration-upload-company-video-brochure', ['video', 'brochure']],
    ['/api/post/registration-upload-company-video-webinar', ['video', 'webinar']],
    ['/api/post/registration-upload-company-brochure-webinar', ['brochure', 'webinar']],
    ['/api/post/registration-upload-company-logo', ['logo']],
    ['/api/post/registration-upload-company-banner', ['banner']],
    ['/api/post/registration-upload-company-video', ['video']],
    ['/api/post/registration-upload-company-brochure', ['brochure']],
    ['/api/post/registration-upload-company-webinar', ['webinar']],
]);

const UPGRADE_UPLOAD_ROUTES = Object.freeze([
    ['/api/post/upgrade-upload-all-users-business-medias', ['video', 'brochure', 'webinar']],
    ['/api/post/upgrade-upload-company-brochure-only', ['brochure']],
    ['/api/post/upgrade-upload-company-video-only', ['video']],
    ['/api/post/upgrade-upload-company-webinar-only', ['webinar']],
    ['/api/post/upgrade-upload-company-video-webinar', ['video', 'webinar']],
    ['/api/post/upgrade-upload-company-brochure-webinar', ['brochure', 'webinar']],
    ['/api/post/upgrade-upload-company-video-brochure', ['video', 'brochure']],
]);

const STANDALONE_UPLOAD_ROUTES = Object.freeze([
    {
        route: '/api/post/upload-users-business-medias',
        groups: ['logo', 'banner', 'videoFile', 'video', 'brochure', 'webinar'],
        operation: 'insert',
        uuidSource: 'body',
        successResponse: 'success upload files',
    },
    {
        route: '/api/post/upload-users-business-medias2',
        groups: ['videoFile', 'video', 'brochure', 'webinar'],
        operation: 'update',
        uuidSource: 'body',
        successResponse: 'success upload files',
    },
    {
        route: '/api/post/upload-video2',
        groups: ['videoFile', 'video'],
        operation: 'insert',
        uuidSource: 'sessionRaw',
        successResponse: 'success',
    },
    {
        route: '/api/post/upload-brochure',
        groups: ['brochureFile'],
        operation: 'insert',
        uuidSource: 'sessionRaw',
        successResponse: 'success',
    },
    {
        route: '/api/post/update-upload-brochure',
        groups: ['editBrochureFile'],
        operation: 'update',
        uuidSource: 'session',
        successResponse: 'success',
    },
    {
        route: '/api/post/update-trader-company-logo',
        groups: ['logo'],
        operation: 'update',
        uuidSource: 'session',
        successResponse: 'success',
    },
    {
        route: '/api/post/update-trader-company-banner',
        groups: ['banner'],
        operation: 'upsert',
        uuidSource: 'session',
    },
    {
        route: '/api/post/users-medias-process',
        groups: ['logo', 'banner'],
        operation: 'insert',
        uuidSource: 'body',
        successResponse: 'success upload files',
        beforeUpload: 'registrationEmailVerification',
    },
]);

function getMediaGroup(group) {
    return MEDIA_GROUPS[group] || STANDALONE_MEDIA_GROUPS[group];
}

function getUploadFields(groups) {
    return groups.map((group) => {
        const definition = getMediaGroup(group);
        if (!definition) {
            throw new Error(`Unknown business media group: ${group}`);
        }
        return { name: definition.field, maxCount: 1 };
    });
}

function mapBusinessMedia(req, groups, uuid = req.body.uuid) {
    const values = {};
    for (const group of groups) {
        const definition = getMediaGroup(group);
        if (!definition) {
            throw new Error(`Unknown business media group: ${group}`);
        }
        for (const [attribute, getValue] of Object.entries(definition.attributes)) {
            values[attribute] = getValue(req);
        }
    }

    values.uuid = uuid;
    values.date_created = new Date().toISOString().replace('T', ' ').substr(0, 19);
    return values;
}

function createMediaUploadHandler({
    buildQuery,
    runBusinessMediaQuery,
    mapValues = mapBusinessMedia,
    successResponse = 'success upload files',
    beforeUpload,
    logger = console,
}) {
    return (groups) => (req, res) => {
        beforeUpload?.(req, res);
        if (!req.files) {
            logger.log('No file upload');
            return;
        }

        const { query, values } = buildQuery(mapValues(req, groups), req);
        runBusinessMediaQuery(req, res, query, values, (err) => {
            if (err) {
                logger.log(err);
                return;
            }
            res.send(successResponse);
            logger.log('success upload files');
        });
    };
}

module.exports = {
    MEDIA_GROUPS,
    REGISTRATION_UPLOAD_ROUTES,
    STANDALONE_UPLOAD_ROUTES,
    UPGRADE_UPLOAD_ROUTES,
    createMediaUploadHandler,
    getUploadFields,
    mapBusinessMedia,
};
