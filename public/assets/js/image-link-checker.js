function testImage(url, callback, timeout) {
    timeout = timeout || 5000;
    var timedOut = false,
        timer;
    var img = new Image();
    img.onerror = img.onabort = function () {
        if (!timedOut) {
            clearTimeout(timer);
            callback(url, 'error');
        }
    };
    img.onload = function () {
        if (!timedOut) {
            clearTimeout(timer);
            callback(url, 'success');
        }
    };
    img.src = url;
    timer = setTimeout(function () {
        timedOut = true;
        callback(url, 'timeout');
    }, timeout);
}

function testArrayOfImage(url, callback, num, timeout) {
    timeout = timeout || 5000;
    var timedOut = false,
        timer;
    var img = new Image();
    img.onerror = img.onabort = function () {
        if (!timedOut) {
            clearTimeout(timer);
            callback(url, 'error', num);
        }
    };
    img.onload = function () {
        if (!timedOut) {
            clearTimeout(timer);
            callback(url, 'success', num);
        }
    };
    img.src = url;
    timer = setTimeout(function () {
        timedOut = true;
        callback(url, 'timeout', num);
    }, timeout);
}

function isValidBanner(url, result) {
    // document.body.innerHTML += "<span class='" + result + "'>" +
    //     result + ": " + url + "</span><br>";
    if (result === 'error') {
        document.getElementById('companyBannerPreview').src =
            host + '/' + 'uploads/placeholder/banner-placeholder2.jpg';
    }
}

function isValidLogo(url, result) {
    // document.body.innerHTML += "<span class='" + result + "'>" +
    //     result + ": " + url + "</span><br>";
    if (result === 'error') {
        document.getElementById('companyLogoPreview').src = host + '/' + 'uploads/placeholder/logo-placeholder2.jpg';
    }
}

function isValidBannerToSelection(url, result, num) {
    document.body.innerHTML += "<span class='" + result + "'>" + result + ': ' + url + num + '</span><br>';
    if (result === 'error') {
        document.getElementById('companyBannerPreview' + num).src =
            host + '/' + 'uploads/placeholder/banner-placeholder2.jpg';
    }
}
