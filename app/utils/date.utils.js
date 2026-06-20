const TIMEZONE = 'Asia/Manila';

function formatPhDate(date) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type).value;

    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}.${get('fractionalSecond')}`;
}

function readableDateTime(dateTime) {
    console.log('Converting to readable date time:', dateTime);
    const date = new Date(dateTime.replace(" ", "T"));
    const readable = `${date.toDateString()} ${date.toLocaleTimeString()}`;
    return readable;
}


function getPhTime() {
    const now = new Date();
    return formatPhDate(now);
}

function getTodayStart() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return formatPhDate(now);
}

function getTodayEnd() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    now.setDate(now.getDate() + 1);
    return formatPhDate(now);
}

function getDateRange(date = new Date()) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return {
        start: formatPhDate(start),
        end: formatPhDate(end),
    };
}

module.exports = {
    formatPhDate,
    readableDateTime,
    getPhTime,
    getTodayStart,
    getTodayEnd,
    getDateRange,
    TIMEZONE,
};
