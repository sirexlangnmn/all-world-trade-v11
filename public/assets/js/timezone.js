function convertTimeToInternationalStart(time, country, targetTimezone) {
    if (!time) return;

    const timeArr = time.split(':');
    if (timeArr.length !== 2) {
        throw new Error(`Invalid time format: ${time}`);
    }

    const [hours, minutes] = timeArr.map((val) => parseInt(val, 10));
    if (isNaN(hours) || isNaN(minutes)) {
        throw new Error(`Invalid time format: ${time}`);
    }

    let tzoffset = 0;

    switch (targetTimezone) {
        case 'UTC':
            tzoffset = 0;
            break;
        case 'EST':
            tzoffset = -300;
            break;
        case 'CST':
            tzoffset = -360;
            break;
        case 'MST':
            tzoffset = -420;
            break;
        case 'PST':
            tzoffset = -480;
            break;
    }

    switch (country) {
        case 'Philippines':
            tzoffset -= 480;
            break;
    }

    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes + tzoffset);

    return date.toLocaleTimeString().slice(0, 5);
}
function convertTimeToInternationalEnd(time, country, targetTimezone) {
    if (!time) return;

    const timeArr = time.split(':');
    if (timeArr.length !== 2) {
        throw new Error(`Invalid time format: ${time}`);
    }

    const [hours, minutes] = timeArr.map((val) => parseInt(val, 10));
    if (isNaN(hours) || isNaN(minutes)) {
        throw new Error(`Invalid time format: ${time}`);
    }

    let tzoffset = 0;

    switch (targetTimezone) {
        case 'UTC':
            tzoffset = 0;
            break;
        case 'EST':
            tzoffset = -300;
            break;
        case 'CST':
            tzoffset = -360;
            break;
        case 'MST':
            tzoffset = -420;
            break;
        case 'PST':
            tzoffset = -480;
            break;
    }

    switch (country) {
        case 'Philippines':
            tzoffset -= 480;
            break;
    }

    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes + tzoffset);

    return date.toLocaleTimeString().slice(0, 5);
}

//// Example usage
//   const localTime = "23:00";
//   const country = "Philippines";
//   const targetTimezone = "UTC";
//   console.log(convertTimeToInternational(localTime, country, targetTimezone));
