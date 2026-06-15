function upgradeUploadBusinessMedias(uuid) {
    let thumbnailInput = document.getElementById('thumbnailInput').files.length;
    let brochureInput = document.getElementById('brochureInput').files.length;
    let webinarsThumbnailInput = document.getElementById('webinarsThumbnailInput').files.length;

    let isWantToUploadVideo = document.getElementById('inputWantToUploadCompanyVideo').value;
    let isWantToUploadBrochure = document.getElementById('inputWantToUploadCompanyBrochure').value;
    let isWantToUploadCompanyWebinar = document.getElementById('inputWantToUploadCompanyWebinar').value;

    console.log('uuid');
    console.log(uuid);
    console.log('thumbnailInput');
    console.log(thumbnailInput);
    console.log('brochureInput');
    console.log(brochureInput);
    console.log('webinarsThumbnailInput');
    console.log(webinarsThumbnailInput);
    console.log('isWantToUploadVideo');
    console.log(isWantToUploadVideo);
    console.log('isWantToUploadBrochure');
    console.log(isWantToUploadBrochure);
    console.log('isWantToUploadCompanyWebinar');
    console.log(isWantToUploadCompanyWebinar);

    // all
    if (
        thumbnailInput == 1 &&
        brochureInput == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == 1
    ) {
        let response = upgradeUploadAllUsersBusinessMedias(uuid);
        console.log('yes upgradeUploadAllUsersBusinessMedias');
        console.log('upgradeUploadAllUsersBusinessMedias: ' + response);
    } else {
        console.log('no upgradeUploadAllUsersBusinessMedias');
    }

    // brochure only
    if (
        brochureInput == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == ''
    ) {
        console.log('yes upgradeUploadCompanyBrochure');
        upgradeUploadCompanyBrochure(uuid);
    } else {
        console.log('no upgradeUploadCompanyBrochure');
    }

    // video only
    if (
        thumbnailInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == ''
    ) {
        console.log('yes upgradeUploadCompanyVideo');
        upgradeUploadCompanyVideo(uuid);
    } else {
        console.log('no upgradeUploadCompanyVideo');
    }

    // webinar only
    if (
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == 1
    ) {
        console.log('yes upgradeUploadCompanyWebinar');
        upgradeUploadCompanyWebinar(uuid);
    } else {
        console.log('no upgradeUploadCompanyWebinar');
    }

    // no brochure - video & webinar
    if (
        thumbnailInput == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == 1
    ) {
        upgradeUploadCompanyVideoWebinar(uuid);
        console.log('yes upgradeUploadCompanyVideoWebinar');
    } else {
        console.log('no upgradeUploadCompanyVideoWebinar');
    }

    // no video - brochure & webinar
    if (
        brochureInput == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == 1
    ) {
        upgradeUploadCompanyBrochureWebinar(uuid);
        console.log('yes upgradeUploadCompanyBrochureWebinar');
    } else {
        console.log('no upgradeUploadCompanyBrochureWebinar');
    }

    // no webinar - video & brochure
    if (
        thumbnailInput == 1 &&
        brochureInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == ''
    ) {
        upgradeUploadCompanyVideoBrochure(uuid);
        console.log('yes upgradeUploadCompanyVideoBrochure');
    } else {
        console.log('no upgradeUploadCompanyVideoBrochure');
    }
}

function upgradeUploadAllUsersBusinessMedias(uuid) {
    let value;

    // Get form
    let form = $('#upgradeToTradersForm')[0];

    // Create an FormData object
    let formData = new FormData(form);
    formData.append('uuid', uuid);

    $.ajax({
        type: 'post',
        enctype: 'multipart/form-data',
        url: '/api/post/upgrade-upload-all-users-business-medias',
        data: formData,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        success: function (data) {
            console.log(data);
            value = data;

            if (data === 'success upload files') {
                location.replace(host + '/profile');
            }
        },
        error: function (e) {
            // some code here
        },
    });

    return value;
}

function upgradeUploadCompanyBrochure(uuid) {
    // Get form
    let form = $('#upgradeToTradersForm')[0];

    // Create an FormData object
    let formData = new FormData(form);
    formData.append('uuid', uuid);

    $.ajax({
        type: 'post',
        enctype: 'multipart/form-data',
        url: '/api/post/upgrade-upload-company-brochure-only',
        data: formData,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        success: function (data) {
            console.log(data);

            if (data === 'success upload files') {
                location.replace(host + '/profile');
            }
        },
        error: function (e) {
            // some code here
        },
    });
}

function upgradeUploadCompanyVideo(uuid) {
    // Get form
    let form = $('#upgradeToTradersForm')[0];

    // Create an FormData object
    let formData = new FormData(form);
    formData.append('uuid', uuid);

    $.ajax({
        type: 'post',
        enctype: 'multipart/form-data',
        url: '/api/post/upgrade-upload-company-video-only',
        data: formData,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        success: function (data) {
            console.log(data);

            if (data === 'success upload files') {
                location.replace(host + '/profile');
            }
        },
        error: function (e) {
            // some code here
        },
    });
}

function upgradeUploadCompanyWebinar(uuid) {
    // Get form
    let form = $('#upgradeToTradersForm')[0];

    // Create an FormData object
    let formData = new FormData(form);
    formData.append('uuid', uuid);

    $.ajax({
        type: 'post',
        enctype: 'multipart/form-data',
        url: '/api/post/upgrade-upload-company-webinar-only',
        data: formData,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        success: function (data) {
            console.log(data);

            if (data === 'success upload files') {
                location.replace(host + '/profile');
            }
        },
        error: function (e) {
            // some code here
        },
    });
}

function upgradeUploadCompanyVideoWebinar(uuid) {
    // Get form
    let form = $('#upgradeToTradersForm')[0];

    // Create an FormData object
    let formData = new FormData(form);
    formData.append('uuid', uuid);

    $.ajax({
        type: 'post',
        enctype: 'multipart/form-data',
        url: '/api/post/upgrade-upload-company-video-webinar',
        data: formData,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        success: function (data) {
            console.log(data);

            if (data === 'success upload files') {
                location.replace(host + '/profile');
            }
        },
        error: function (e) {
            // some code here
        },
    });
}

function upgradeUploadCompanyBrochureWebinar(uuid) {
    // Get form
    let form = $('#upgradeToTradersForm')[0];

    // Create an FormData object
    let formData = new FormData(form);
    formData.append('uuid', uuid);

    $.ajax({
        type: 'post',
        enctype: 'multipart/form-data',
        url: '/api/post/upgrade-upload-company-brochure-webinar',
        data: formData,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        success: function (data) {
            console.log(data);

            if (data === 'success upload files') {
                location.replace(host + '/profile');
            }
        },
        error: function (e) {
            // some code here
        },
    });
}

function upgradeUploadCompanyVideoBrochure(uuid) {
    // Get form
    let form = $('#upgradeToTradersForm')[0];

    // Create an FormData object
    let formData = new FormData(form);
    formData.append('uuid', uuid);

    $.ajax({
        type: 'post',
        enctype: 'multipart/form-data',
        url: '/api/post/upgrade-upload-company-video-brochure',
        data: formData,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        success: function (data) {
            console.log(data);

            if (data === 'success upload files') {
                location.replace(host + '/profile');
            }
        },
        error: function (e) {
            // some code here
        },
    });
}
