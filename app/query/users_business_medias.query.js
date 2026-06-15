const QUERY = {
    SELECT_LOGO: 'SELECT id, logo, uuid FROM users_business_medias WHERE status = 1',

    SELECT_BANNER: 'SELECT id, banner FROM users_business_medias',

    SELECT_ROW: 'SELECT * FROM users_business_medias WHERE uuid = ?',

    CREATE_NO: 'INSERT INTO users_business_medias (' + 'uuid, ' + 'date_created) VALUES' + '(?, ?)',

    CREATE_ALL:
        'INSERT INTO users_business_medias (' +
        'logo, ' +
        'banner, ' +
        'video_thumbnail, ' +
        'video_link, ' +
        'video_title, ' +
        'video_description, ' +
        'brochure, ' +
        'brochure_title, ' +
        'webinars_thumbnail, ' +
        'webinars_title, ' +
        'webinars_description, ' +
        'webinars_link, ' +
        'webinars_schedule, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_ALL_BUT_NO_LOGO:
        'INSERT INTO users_business_medias (' +
        'banner, ' +
        'video_thumbnail, ' +
        'video_link, ' +
        'video_title, ' +
        'video_description, ' +
        'brochure, ' +
        'brochure_title, ' +
        'webinars_thumbnail, ' +
        'webinars_title, ' +
        'webinars_description, ' +
        'webinars_link, ' +
        'webinars_schedule, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_ALL_BUT_NO_BANNER:
        'INSERT INTO users_business_medias (' +
        'logo, ' +
        'video_thumbnail, ' +
        'video_link, ' +
        'video_title, ' +
        'video_description, ' +
        'brochure, ' +
        'brochure_title, ' +
        'webinars_thumbnail, ' +
        'webinars_title, ' +
        'webinars_description, ' +
        'webinars_link, ' +
        'webinars_schedule, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_ALL_BUT_NO_VIDEO:
        'INSERT INTO users_business_medias (' +
        'logo, ' +
        'banner, ' +
        'brochure, ' +
        'brochure_title, ' +
        'webinars_thumbnail, ' +
        'webinars_title, ' +
        'webinars_description, ' +
        'webinars_link, ' +
        'webinars_schedule, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_ALL_BUT_NO_BROCHURE:
        'INSERT INTO users_business_medias (' +
        'logo, ' +
        'banner, ' +
        'video_thumbnail, ' +
        'video_link, ' +
        'video_title, ' +
        'video_description, ' +
        'webinars_thumbnail, ' +
        'webinars_title, ' +
        'webinars_description, ' +
        'webinars_link, ' +
        'webinars_schedule, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_ALL_BUT_NO_WEBINAR:
        'INSERT INTO users_business_medias (' +
        'logo, ' +
        'banner, ' +
        'video_thumbnail, ' +
        'video_link, ' +
        'video_title, ' +
        'video_description, ' +
        'brochure, ' +
        'brochure_title, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_LOGO: 'INSERT INTO users_business_medias (' + 'logo, ' + 'uuid, ' + 'date_created) VALUES' + '(?, ?, ?)',

    CREATE_BANNER: 'INSERT INTO users_business_medias (' + 'banner, ' + 'uuid, ' + 'date_created) VALUES' + '(?, ?, ?)',

    CREATE_VIDEO:
        'INSERT INTO users_business_medias (' +
        'video_thumbnail, ' +
        'video_link, ' +
        'video_title, ' +
        'video_description, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?)',

    CREATE_BROCHURE:
        'INSERT INTO users_business_medias (' +
        'brochure, ' +
        'brochure_title, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?)',

    CREATE_WEBINAR:
        'INSERT INTO users_business_medias (' +
        'webinars_thumbnail, ' +
        'webinars_title, ' +
        'webinars_description, ' +
        'webinars_link, ' +
        'webinars_schedule, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?)',

    CREATE_LOGO_BANNER:
        'INSERT INTO users_business_medias (' +
        'logo, ' +
        'banner, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?)',

    CREATE_LOGO_VIDEO:
        'INSERT INTO users_business_medias (' +
        'logo, ' +
        'video_thumbnail, ' +
        'video_link, ' +
        'video_title, ' +
        'video_description, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?)',

    CREATE_LOGO_BROCHURE:
        'INSERT INTO users_business_medias (' +
        'logo, ' +
        'brochure, ' +
        'brochure_title, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?)',

    CREATE_LOGO_WEBINAR:
        'INSERT INTO users_business_medias (' +
        'logo, ' +
        'webinars_thumbnail, ' +
        'webinars_title, ' +
        'webinars_description, ' +
        'webinars_link, ' +
        'webinars_schedule, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_BANNER_VIDEO:
        'INSERT INTO users_business_medias (' +
        'banner, ' +
        'video_thumbnail, ' +
        'video_link, ' +
        'video_title, ' +
        'video_description, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?)',

    CREATE_BANNER_BROCHURE:
        'INSERT INTO users_business_medias (' +
        'banner, ' +
        'brochure, ' +
        'brochure_title, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?)',

    CREATE_BANNER_WEBINAR:
        'INSERT INTO users_business_medias (' +
        'banner, ' +
        'webinars_thumbnail, ' +
        'webinars_title, ' +
        'webinars_description, ' +
        'webinars_link, ' +
        'webinars_schedule, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_VIDEO_BROCHURE:
        'INSERT INTO users_business_medias (' +
        'video_thumbnail, ' +
        'video_link, ' +
        'video_title, ' +
        'video_description, ' +
        'brochure, ' +
        'brochure_title, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_VIDEO_WEBINAR:
        'INSERT INTO users_business_medias (' +
        'video_thumbnail, ' +
        'video_link, ' +
        'video_title, ' +
        'video_description, ' +
        'webinars_thumbnail, ' +
        'webinars_title, ' +
        'webinars_description, ' +
        'webinars_link, ' +
        'webinars_schedule, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_BROCHURE_WEBINAR:
        'INSERT INTO users_business_medias (' +
        'brochure, ' +
        'brochure_title, ' +
        'webinars_thumbnail, ' +
        'webinars_title, ' +
        'webinars_description, ' +
        'webinars_link, ' +
        'webinars_schedule, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_LOGO_BANNER_VIDEO:
        'INSERT INTO users_business_medias (' +
        'logo, ' +
        'banner, ' +
        'video_thumbnail, ' +
        'video_link, ' +
        'video_title, ' +
        'video_description, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_LOGO_BANNER_BROCHURE:
        'INSERT INTO users_business_medias (' +
        'logo, ' +
        'banner, ' +
        'brochure, ' +
        'brochure_title, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?)',

    CREATE_LOGO_BANNER_WEBINAR:
        'INSERT INTO users_business_medias (' +
        'logo, ' +
        'banner, ' +
        'webinars_thumbnail, ' +
        'webinars_title, ' +
        'webinars_description, ' +
        'webinars_link, ' +
        'webinars_schedule, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_LOGO_VIDEO_BROCHURE:
        'INSERT INTO users_business_medias (' +
        'logo, ' +
        'video_thumbnail, ' +
        'video_link, ' +
        'video_title, ' +
        'video_description, ' +
        'brochure, ' +
        'brochure_title, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_LOGO_VIDEO_WEBINAR:
        'INSERT INTO users_business_medias (' +
        'logo, ' +
        'video_thumbnail, ' +
        'video_link, ' +
        'video_title, ' +
        'video_description, ' +
        'webinars_thumbnail, ' +
        'webinars_title, ' +
        'webinars_description, ' +
        'webinars_link, ' +
        'webinars_schedule, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_LOGO_BROCHURE_WEBINAR:
        'INSERT INTO users_business_medias (' +
        'logo, ' +
        'brochure, ' +
        'brochure_title, ' +
        'webinars_thumbnail, ' +
        'webinars_title, ' +
        'webinars_description, ' +
        'webinars_link, ' +
        'webinars_schedule, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_BANNER_VIDEO_BROCHURE:
        'INSERT INTO users_business_medias (' +
        'banner, ' +
        'video_thumbnail, ' +
        'video_link, ' +
        'video_title, ' +
        'video_description, ' +
        'brochure, ' +
        'brochure_title, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_BANNER_VIDEO_WEBINAR:
        'INSERT INTO users_business_medias (' +
        'banner, ' +
        'video_thumbnail, ' +
        'video_link, ' +
        'video_title, ' +
        'video_description, ' +
        'webinars_thumbnail, ' +
        'webinars_title, ' +
        'webinars_description, ' +
        'webinars_link, ' +
        'webinars_schedule, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',

    CREATE_BANNER_BROCHURE_WEBINAR:
        'INSERT INTO users_business_medias (' +
        'banner, ' +
        'brochure, ' +
        'brochure_title, ' +
        'webinars_thumbnail, ' +
        'webinars_title, ' +
        'webinars_description, ' +
        'webinars_link, ' +
        'webinars_schedule, ' +
        'uuid, ' +
        'date_created) VALUES' +
        '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',

    UPDATE_BANNER: `UPDATE users_business_medias SET banner = ?, date_created = ? WHERE uuid = ?`,

    // ======================================================
    // upgrade to traders upload media files [START]
    // ======================================================

    UPDATE_VIDEO_BROCHURE_WEBINAR: `UPDATE users_business_medias SET 
            video_thumbnail = ?, 
            video_link = ?, 
            video_title = ?, 
            video_description = ?, 
            brochure = ?, 
            brochure_title = ?, 
            webinars_thumbnail = ?, 
            webinars_title = ?, 
            webinars_description = ?, 
            webinars_link = ?, 
            webinars_schedule = ?,
            date_created = ?
            WHERE uuid = ?`,

    UPDATE_BROCHURE_ONLY: `UPDATE users_business_medias SET 
			brochure = ?, 
			brochure_title = ?, 
			date_created = ?
			WHERE uuid = ?`,

    UPDATE_VIDEO_ONLY: `UPDATE users_business_medias SET 
			video_thumbnail = ?, 
			video_link = ?, 
			video_title = ?, 
			video_description = ?, 
			date_created = ?
			WHERE uuid = ?`,

    UPDATE_WEBINAR_ONLY: `UPDATE users_business_medias SET 
            webinars_thumbnail = ?, 
            webinars_title = ?, 
            webinars_description = ?, 
            webinars_link = ?, 
            webinars_schedule = ?,
            date_created = ?
            WHERE uuid = ?`,

    UPDATE_VIDEO_WEBINAR: `UPDATE users_business_medias SET 
			video_thumbnail = ?, 
			video_link = ?, 
			video_title = ?, 
			video_description = ?, 
			webinars_thumbnail = ?, 
			webinars_title = ?, 
			webinars_description = ?, 
			webinars_link = ?, 
			webinars_schedule = ?,
			date_created = ?
			WHERE uuid = ?`,

    UPDATE_BROCHURE_WEBINAR: `UPDATE users_business_medias SET 
            brochure = ?, 
            brochure_title = ?, 
            webinars_thumbnail = ?, 
            webinars_title = ?, 
            webinars_description = ?, 
            webinars_link = ?, 
            webinars_schedule = ?,
            date_created = ?
            WHERE uuid = ?`,

    UPDATE_VIDEO_BROCHURE: `UPDATE users_business_medias SET 
            video_thumbnail = ?, 
            video_link = ?, 
            video_title = ?, 
            video_description = ?, 
            brochure = ?, 
            brochure_title = ?, 
            date_created = ?
            WHERE uuid = ?`,
    // ======================================================
    // upgrade to traders upload media files [END]
    // ======================================================
};

// export default QUERY;
module.exports = QUERY;
