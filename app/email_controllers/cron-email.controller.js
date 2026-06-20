const cron = require('node-cron');
const db = require('../db_models');
const { getTodayStart, getTodayEnd, getPhTime } = require('../utils/date.utils');
const AnalyticsService = require('../services/analytics.service');
const emailService = require('../services/email.service');
const Logger = require('../src/Logger');
const logger = new Logger('cron-email');

const Users_accounts = db.users_accounts;
const analyticsService = new AnalyticsService(db);

async function sendMidnightEmail() {
    try {
        logger.debug('Starting midnight email job');

        const dateRange = {
            start: getTodayStart(),
            end: getTodayEnd(),
        };

        logger.debug('Date range:', dateRange);

        const metrics = await analyticsService.getDailyMetrics(dateRange);

        logger.debug('Daily metrics:', {
            ...metrics,
            visitors: `${metrics.visitors.length} users`,
        });

        const reportResult = await emailService.sendMidnightReportToClients(metrics);

        logger.debug('Midnight email job completed', {
            recipients: reportResult.total,
            successful: reportResult.successful,
            failed: reportResult.failed,
            timestamp: getPhTime(),
        });

        return reportResult;
    } catch (error) {
        logger.error('Midnight email job failed:', error);
        throw error;
    }
}

function autoLogout() {
    Users_accounts.update({ login_status: null }, { where: {} })
        .then(() => {
            logger.debug('Auto logout job completed', {
                timestamp: getPhTime(),
            });
        })
        .catch((error) => {
            logger.error('Auto logout job failed:', error);
        });
}

function scheduleJobs() {
    cron.schedule('0 0 * * *', () => {
        sendMidnightEmail();
    });

    cron.schedule('1 0 * * *', () => {
        autoLogout();
    });

    logger.debug('Production cron jobs scheduled');
}

function scheduleTestJobs() {
    cron.schedule('*/1 * * * *', () => {
        autoLogout();
    });

    cron.schedule('*/2 * * * *', () => {
        sendMidnightEmail();
    });

    logger.debug('Test cron jobs scheduled (runs every 1 and 2 minutes)');
}

module.exports = (app) => {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
        // scheduleJobs();
    } else {
        // scheduleTestJobs();
    }
};
