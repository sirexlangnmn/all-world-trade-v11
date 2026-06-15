function registrationUploadBusinessMedias(uuid) {
    let companyLogo = document.getElementById('companyLogo').files.length;
    let companyBanner = document.getElementById('companyBanner').files.length;

    if (companyLogo == 0 && companyBanner == 0) {
        let response = registrationNoUpload(uuid);
        console.log('yes registrationNoUpload');
        console.log('registrationNoUpload: ' + response);
    } else {
        console.log('no registrationNoUpload');
    }

    if (companyLogo == 1 && companyBanner == 0) {
        let response = registrationUploadCompanyLogo(uuid);
        console.log('yes registrationUploadCompanyLogo');
        console.log('registrationUploadCompanyLogo: ' + response);
    } else {
        console.log('no registrationUploadCompanyLogo');
    }

    if (companyLogo == 0 && companyBanner == 1) {
        let response = registrationUploadCompanyBanner(uuid);
        console.log('yes registrationUploadCompanyBanner');
        console.log('registrationUploadCompanyBanner: ' + response);
    } else {
        console.log('no registrationUploadCompanyBanner');
    }

    if (companyLogo == 1 && companyBanner == 1) {
        let response = registrationUploadCompanyLogoBanner(uuid);
        console.log('yes registrationUploadCompanyLogoBanner');
        console.log('registrationUploadCompanyLogoBanner: ' + response);
    } else {
        console.log('no registrationUploadCompanyLogoBanner');
    }
}

function registrationNoUpload(uuid) {
    let value;

    $.ajax({
        url: '/api/post/registration-no-upload',
        type: 'POST',
        data: {
            uuid: uuid,
        },
        success: function (data) {
            value = data;
        },
        error: function (e) {
            // some code here
        },
    });

    return value;
}

function registrationUploadCompanyLogo(uuid) {
    let value;

    // Get form
    let form = $('#traderRegistrationForm')[0];

    // Create an FormData object
    let formData = new FormData(form);
    formData.append('uuid', uuid);

    $.ajax({
        type: 'post',
        enctype: 'multipart/form-data',
        url: '/api/post/registration-upload-company-logo',
        data: formData,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        async: false,
        success: function (data) {
            value = data;
            // if (data === 'success upload files') {
            //     location.replace(host + '/email-verification');
            // }
        },
        error: function (e) {
            // some code here
        },
    });

    return value;
}

function registrationUploadCompanyBanner(uuid) {
    let value;

    // Get form
    let form = $('#traderRegistrationForm')[0];

    // Create an FormData object
    let formData = new FormData(form);
    formData.append('uuid', uuid);

    $.ajax({
        type: 'post',
        enctype: 'multipart/form-data',
        url: '/api/post/registration-upload-company-banner',
        data: formData,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        async: false,
        success: function (data) {
            value = data;
            // if (data === 'success upload files') {
            //     location.replace(host + '/email-verification');
            // }
        },
        error: function (e) {
            // some code here
        },
    });

    return value;
}

function registrationUploadCompanyLogoBanner(uuid) {
    let value;

    // Get form
    let form = $('#traderRegistrationForm')[0];

    // Create an FormData object
    let formData = new FormData(form);
    formData.append('uuid', uuid);

    $.ajax({
        type: 'post',
        enctype: 'multipart/form-data',
        url: '/api/post/registration-upload-company-logo-banner',
        data: formData,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        async: false,
        success: function (data) {
            value = data;
            // if (data === 'success upload files') {
            //     location.replace(host + '/email-verification');
            // }
        },
        error: function (e) {
            // some code here
        },
    });

    return value;
}
