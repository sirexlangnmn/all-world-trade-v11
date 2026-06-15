const { getTodayStart, getTodayEnd, readableDateTime } = require('../utils/date.utils');

class AnalyticsService {
    constructor(db) {
        this.db = db;
        this.UserSessions = db.user_sessions;
        this.Users = db.users;
        this.Sequelize = db.Sequelize;
        this.Op = db.Sequelize.Op;
    }

    async getUniqueLoggedInUsers(dateRange) {
        const { start, end } = dateRange;

        const results = await this.db.sequelize.query(
            `SELECT DISTINCT user_id FROM user_sessions WHERE login_at >= :start AND login_at < :end`,
            {
                type: this.db.Sequelize.QueryTypes.SELECT,
                replacements: { start, end },
            },
        );

        return results.map((row) => row.user_id);
    }

    async getVisitorsByUserIds(userIds) {
        if (!userIds || userIds.length === 0) {
            return [];
        }

        // return this.Users.findAll({
        //     attributes: ['first_name', 'last_name'],
        //     where: {
        //         uuid: {
        //             [this.Op.in]: userIds,
        //         },
        //     },
        //     raw: true,
        // });


        return this.Users.findAll({
            attributes: [
                'first_name',
                'last_name',
                // manually select from Users_accounts using a literal / subquery
                [this.db.Sequelize.literal(`(
                    SELECT email_or_social_media
                    FROM users_accounts
                    WHERE users_accounts.uuid = users.uuid
                    LIMIT 1
                )`), 'email_or_social_media'],
                [this.db.Sequelize.literal(`(
                    SELECT contact_number
                    FROM users_accounts
                    WHERE users_accounts.uuid = users.uuid
                    LIMIT 1
                )`), 'contact_number']
            ],
            where: {
                uuid: {
                    [this.Op.in]: userIds,
                },
            },
            raw: true,
        });
    }

    async getDailyLoginCount(dateRange) {
        const { start, end } = dateRange;

        const result = await this.db.sequelize.query(
            `SELECT COUNT(*) as count FROM user_sessions WHERE login_at >= :start AND login_at < :end`,
            {
                type: this.db.Sequelize.QueryTypes.SELECT,
                replacements: { start, end },
            },
        );

        return result[0]?.count || 0;
    }

    async getTradersVisitorsCount(dateRange) {
        const { start, end } = dateRange;

        const result = await this.db.sequelize.query(
            `SELECT COUNT(*) as count FROM traders_visitors WHERE date_created >= :start AND date_created < :end`,
            {
                type: this.db.Sequelize.QueryTypes.SELECT,
                replacements: { start, end },
            },
        );

        return result[0]?.count || 0;
    }

    async getNumberOfDownloadsOnCompanyDetailsCount(dateRange) {
        const { start, end } = dateRange;

        const result = await this.db.sequelize.query(
            `SELECT COUNT(*) as count FROM user_download_histories WHERE download_at >= :start AND download_at < :end`,
            {
                type: this.db.Sequelize.QueryTypes.SELECT,
                replacements: { start, end },
            },
        );

        return result[0]?.count || 0;
    }

    async getDailyMetrics(dateRange = null) {
        const range = dateRange || { start: getTodayStart(), end: getTodayEnd() };
        console.log('Calculating daily metrics for range:', range);

        const [userIds, visitors, loginCount, tradersVisitorsCount, downloadsCountOnCompanyDetails] = await Promise.all([
            this.getUniqueLoggedInUsers(range),
            this.getVisitorsByUserIds([]),
            this.getDailyLoginCount(range),
            this.getTradersVisitorsCount(range),
            this.getNumberOfDownloadsOnCompanyDetailsCount(range),
        ]);

        const actualVisitors = await this.getVisitorsByUserIds(userIds);

        return {
            dateRange: range,
            startDateTime: readableDateTime(range.start),
            endDateTime: readableDateTime(range.end),
            numberOfLogins: loginCount,
            numberOfUniqueUsers: userIds.length,
            numberOfClicksOnCompanyImage: tradersVisitorsCount,
            numberOfDownloadsOnCompanyDetails: downloadsCountOnCompanyDetails,
            visitors: actualVisitors,
        };
    }
}

module.exports = AnalyticsService;
