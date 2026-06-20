function registrationUploadBusinessMedias(uuid) {
    let companyLogo = document.getElementById('companyLogo').files.length;
    let companyBanner = document.getElementById('companyBanner').files.length;
    let thumbnailInput = document.getElementById('thumbnailInput').files.length;
    let brochureInput = document.getElementById('brochureInput').files.length;
    let webinarsThumbnailInput = document.getElementById('webinarsThumbnailInput').files.length;

    let isWantToUploadVideo = document.getElementById('inputWantToUploadCompanyVideo').value;
    let isWantToUploadBrochure = document.getElementById('inputWantToUploadCompanyBrochure').value;
    let isWantToUploadCompanyWebinar = document.getElementById('inputWantToUploadCompanyWebinar').value;

    console.log('uuid');
    console.log(uuid);
    console.log('companyLogo');
    console.log(companyLogo);
    console.log('companyBanner');
    console.log(companyBanner);
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

    const uploadUrl = {
        logoOnly: '/api/post/registration-upload-company-logo',
        bannerOnly: '/api/post/registration-upload-company-banner',
        videoOnly: '/api/post/registration-upload-company-video',
        brochureOnly: '/api/post/registration-upload-company-brochure',
        webinarOnly: '/api/post/registration-upload-company-webinar',
        all: '/api/post/registration-upload-all-users-business-medias',
        allButNoLogo: '/api/post/registration-upload-all-but-no-logo',
        allButNoBanner: '/api/post/registration-upload-all-but-no-banner',
        allButNoVideo: '/api/post/registration-upload-all-but-no-video',
        allButNoBrochure: '/api/post/registration-upload-all-but-no-brochure',
        allButNoWebinar: '/api/post/registration-upload-all-but-no-webinar',
        logoAndBanner: '/api/post/registration-upload-company-logo-banner',
        logoAndVideo: '/api/post/registration-upload-company-logo-video',
        logoAndBrochure: '/api/post/registration-upload-company-logo-brochure',
        logoAndWebinar: '/api/post/registration-upload-company-logo-webinar',
        bannerAndVideo: '/api/post/registration-upload-company-banner-video',
        bannerAndBrochure: '/api/post/registration-upload-company-banner-brochure',
        bannerAndWebinar: '/api/post/registration-upload-company-banner-webinar',
        videoAndBrochure: '/api/post/registration-upload-company-video-brochure',
        videoAndWebinar: '/api/post/registration-upload-company-video-webinar',
        brochureAndWebinar: '/api/post/registration-upload-company-brochure-webinar',
        logoBannerVideo: '/api/post/registration-upload-company-logo-banner-video',
        logoBannerBrochure: '/api/post/registration-upload-company-logo-banner-brochure',
        logoBannerWebinar: '/api/post/registration-upload-company-logo-banner-webinar',
        logoVideoBrochure: '/api/post/registration-upload-company-logo-video-brochure',
        logoVideoWebinar: '/api/post/registration-upload-company-logo-video-webinar',
        logoBrochureWebinar: '/api/post/registration-upload-company-logo-brochure-webinar',
        bannerVideoBrochure: '/api/post/registration-upload-company-banner-video-brochure',
        bannerVideoWebinar: '/api/post/registration-upload-company-banner-video-webinar',
        bannerWebinarBrochure: '/api/post/registration-upload-company-banner-brochure-webinar',
        // name: 'link',
    };

    // no upload
    if (
        companyLogo == 0 &&
        companyBanner == 0 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == ''
    ) {
        let response = registrationNoUpload(uuid);
        console.log('yes registrationNoUpload');
        console.log('registrationNoUpload: ' + response);
    } else {
        console.log('no registrationNoUpload');
    }

    // logo only
    if (
        companyLogo == 1 &&
        companyBanner == 0 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == ''
    ) {
        // let response = registrationUploadCompanyLogo(uuid);
        let response = uploadProcess(uuid, uploadUrl.logoOnly);
        console.log('yes registrationUploadCompanyLogo');
        console.log('registrationUploadCompanyLogo: ' + response);
    } else {
        console.log('no registrationUploadCompanyLogo');
    }

    // banner only
    if (
        companyLogo == 0 &&
        companyBanner == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == ''
    ) {
        // let response = registrationUploadCompanyBanner(uuid);
        let response = uploadProcess(uuid, uploadUrl.bannerOnly);
        console.log('yes registrationUploadCompanyBanner');
        console.log('registrationUploadCompanyBanner: ' + response);
    } else {
        console.log('no registrationUploadCompanyBanner');
    }

    // video only
    if (
        companyLogo == 0 &&
        companyBanner == 0 &&
        thumbnailInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == ''
    ) {
        console.log('yes registrationUploadCompanyVideo');
        //registrationUploadCompanyVideo(uuid);
        uploadProcess(uuid, uploadUrl.videoOnly);
    } else {
        console.log('no registrationUploadCompanyVideo');
    }

    // brochure only
    if (
        companyLogo == 0 &&
        companyBanner == 0 &&
        brochureInput == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == ''
    ) {
        console.log('yes registrationUploadCompanyBrochure');
        // registrationUploadCompanyBrochure(uuid);
        uploadProcess(uuid, uploadUrl.brochureOnly);
    } else {
        console.log('no registrationUploadCompanyBrochure');
    }

    // webinar only
    if (
        companyLogo == 0 &&
        companyBanner == 0 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == 1
    ) {
        console.log('yes registrationUploadCompanyWebinar');
        // registrationUploadCompanyWebinar(uuid);
        uploadProcess(uuid, uploadUrl.webinarOnly);
    } else {
        console.log('no registrationUploadCompanyWebinar');
    }

    // all
    if (
        companyLogo == 1 &&
        companyBanner == 1 &&
        thumbnailInput == 1 &&
        brochureInput == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == 1
    ) {
        // let response = registrationUploadAllUsersBusinessMedias(uuid);
        let response = uploadProcess(uuid, uploadUrl.all);
        console.log('yes registrationUploadAllUsersBusinessMedias');
        console.log('registrationUploadAllUsersBusinessMedias: ' + response);
    } else {
        console.log('no registrationUploadAllUsersBusinessMedias');
    }

    // all - no logo
    if (
        companyLogo == 0 &&
        companyBanner == 1 &&
        thumbnailInput == 1 &&
        brochureInput == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == 1
    ) {
        // let response = registrationUploadAllButNoLogo(uuid);
        let response = uploadProcess(uuid, uploadUrl.allButNoLogo);
        console.log('yes registrationUploadAllButNoLogo');
        console.log('registrationUploadAllButNoLogo: ' + response);
    } else {
        console.log('no registrationUploadAllButNoLogo');
    }

    // all - no banner
    if (
        companyLogo == 1 &&
        companyBanner == 0 &&
        thumbnailInput == 1 &&
        brochureInput == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == 1
    ) {
        // let response = registrationUploadAllButNoBanner(uuid);
        let response = uploadProcess(uuid, uploadUrl.allButNoBanner);
        console.log('yes registrationUploadAllButNoBanner');
        console.log('registrationUploadAllButNoBanner: ' + response);
    } else {
        console.log('no registrationUploadAllButNoBanner');
    }

    // all - no video
    if (
        companyLogo == 1 &&
        companyBanner == 1 &&
        brochureInput == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == 1
    ) {
        // let response = registrationUploadAllButNoVideo(uuid);
        let response = uploadProcess(uuid, uploadUrl.allButNoVideo);
        console.log('yes registrationUploadAllButNoVideo');
        console.log('registrationUploadAllButNoVideo: ' + response);
    } else {
        console.log('no registrationUploadAllButNoVideo');
    }

    // all - no brochure
    if (
        companyLogo == 1 &&
        companyBanner == 1 &&
        thumbnailInput == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == 1
    ) {
        // let response = registrationUploadAllButNoBrochure(uuid);
        let response = uploadProcess(uuid, uploadUrl.allButNoBrochure);
        console.log('yes registrationUploadAllButNoBrochure');
        console.log('registrationUploadAllButNoBrochure: ' + response);
    } else {
        console.log('no registrationUploadAllButNoBrochure');
    }

    // all - no webinar
    if (
        companyLogo == 1 &&
        companyBanner == 1 &&
        thumbnailInput == 1 &&
        brochureInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == ''
    ) {
        // let response = registrationUploadAllButNoWebinar(uuid);
        let response = uploadProcess(uuid, uploadUrl.allButNoWebinar);
        console.log('yes registrationUploadAllButNoWebinar');
        console.log('registrationUploadAllButNoWebinar: ' + response);
    } else {
        console.log('no registrationUploadAllButNoWebinar');
    }

    // logo and banner
    if (
        companyLogo == 1 &&
        companyBanner == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == ''
    ) {
        // let response = registrationUploadCompanyLogoBanner(uuid);
        let response = uploadProcess(uuid, uploadUrl.logoAndBanner);
        console.log('yes registrationUploadCompanyLogoBanner');
        console.log('registrationUploadCompanyLogoBanner: ' + response);
    } else {
        console.log('no registrationUploadCompanyLogoBanner');
    }

    // logo and video
    if (
        companyLogo == 1 &&
        companyBanner == 0 &&
        thumbnailInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == ''
    ) {
        let response = uploadProcess(uuid, uploadUrl.logoAndVideo);
        console.log('yes registrationUploadCompanyLogoVideo');
        console.log('registrationUploadCompanyLogoVideo: ' + response);
    } else {
        console.log('no registrationUploadCompanyLogoVideo');
    }

    // logo and brochure
    if (
        companyLogo == 1 &&
        companyBanner == 0 &&
        brochureInput == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == ''
    ) {
        let response = uploadProcess(uuid, uploadUrl.logoAndBrochure);
        console.log('yes registrationUploadCompanyLogoBrochure');
        console.log('registrationUploadCompanyLogoBrochure: ' + response);
    } else {
        console.log('no registrationUploadCompanyLogoBrochure');
    }

    // logo and webinar
    if (
        companyLogo == 1 &&
        companyBanner == 0 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == 1
    ) {
        let response = uploadProcess(uuid, uploadUrl.logoAndWebinar);
        console.log('yes registrationUploadCompanyLogoWebinar');
        console.log('registrationUploadCompanyLogoWebinar: ' + response);
    } else {
        console.log('no registrationUploadCompanyLogoWebinar');
    }

    // banner and video
    if (
        companyLogo == 0 &&
        companyBanner == 1 &&
        thumbnailInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == ''
    ) {
        let response = uploadProcess(uuid, uploadUrl.bannerAndVideo);
        console.log('yes registrationUploadCompanyBannerVideo');
        console.log('registrationUploadCompanyBannerVideo: ' + response);
    } else {
        console.log('no registrationUploadCompanyBannerVideo');
    }

    // banner and brochure
    if (
        companyLogo == 0 &&
        companyBanner == 1 &&
        brochureInput == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == ''
    ) {
        let response = uploadProcess(uuid, uploadUrl.bannerAndBrochure);
        console.log('yes registrationUploadCompanyBannerBrochure');
        console.log('registrationUploadCompanyBannerBrochure: ' + response);
    } else {
        console.log('no registrationUploadCompanyBannerBrochure');
    }

    // banner and webinar
    if (
        companyLogo == 0 &&
        companyBanner == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == 1
    ) {
        let response = uploadProcess(uuid, uploadUrl.bannerAndWebinar);
        console.log('yes registrationUploadCompanyBannerWebinar');
        console.log('registrationUploadCompanyBannerWebinar: ' + response);
    } else {
        console.log('no registrationUploadCompanyBannerWebinar');
    }

    // banner and logo - ekis kasi meron ng logo and banner

    // video and brochure
    if (
        companyLogo == 0 &&
        companyBanner == 0 &&
        thumbnailInput == 1 &&
        brochureInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == ''
    ) {
        let response = uploadProcess(uuid, uploadUrl.videoAndBrochure);
        console.log('yes registrationUploadCompanyVideoBrochure');
        console.log('registrationUploadCompanyVideoBrochure: ' + response);
    } else {
        console.log('no registrationUploadCompanyVideoBrochure');
    }

    // video and webinar
    if (
        companyLogo == 0 &&
        companyBanner == 0 &&
        thumbnailInput == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == 1
    ) {
        let response = uploadProcess(uuid, uploadUrl.videoAndWebinar);
        console.log('yes registrationUploadCompanyVideoWebinar');
        console.log('registrationUploadCompanyVideoWebinar: ' + response);
    } else {
        console.log('no registrationUploadCompanyVideoWebinar');
    }

    // video and banner - ekis kasi meron ng banner and video
    // video and logo - ekis kasi meron ng logo and video

    // brochure and video - ekis kasi meron ng video and brochure
    // brochure and banner - ekis kasi meron ng banner and brochure

    // brochure and webinar
    if (
        companyLogo == 0 &&
        companyBanner == 0 &&
        brochureInput == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == 1
    ) {
        let response = uploadProcess(uuid, uploadUrl.brochureAndWebinar);
        console.log('yes registrationUploadCompanyBrochureWebinar');
        console.log('registrationUploadCompanyBrochureWebinar: ' + response);
    } else {
        console.log('no registrationUploadCompanyBrochureWebinar');
    }

    // brochure and logo - ekis kasi meron ng logo and brochure

    // webinar and brochure  - ekis kasi meron ng brochure and webinar
    // webinar and video - ekis kasi meron ng video and webinar
    // webinar and banner - ekis kasi meron ng banner and webinar
    // webinar and logo - ekis kasi meron ng logo and webinar

    // logo, banner, and video (no brochure, no webinar)
    if (
        companyLogo == 1 &&
        companyBanner == 1 &&
        thumbnailInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == ''
    ) {
        // let response = registrationUploadCompanyLogoBannerVideo(uuid);
        let response = uploadProcess(uuid, uploadUrl.logoBannerVideo);
        console.log('yes registrationUploadCompanyLogoBannerVideo');
        console.log('registrationUploadCompanyLogoBannerVideo: ' + response);
    } else {
        console.log('no registrationUploadCompanyLogoBannerVideo');
    }

    // logo, banner, and brochure (no video, no webinar)
    if (
        companyLogo == 1 &&
        companyBanner == 1 &&
        brochureInput == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == ''
    ) {
        // let response = registrationUploadCompanyLogoBannerBrochure(uuid);
        let response = uploadProcess(uuid, uploadUrl.logoBannerBrochure);
        console.log('yes registrationUploadCompanyLogoBannerBrochure');
        console.log('registrationUploadCompanyLogoBannerBrochure: ' + response);
    } else {
        console.log('no registrationUploadCompanyLogoBannerBrochure');
    }

    // logo, banner, and webinar (no video, no brochure)
    if (
        companyLogo == 1 &&
        companyBanner == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == 1
    ) {
        // let response = registrationUploadCompanyLogoBannerWebinar(uuid);
        let response = uploadProcess(uuid, uploadUrl.logoBannerWebinar);
        console.log('yes registrationUploadCompanyLogoBannerWebinar');
        console.log('registrationUploadCompanyLogoBannerWebinar: ' + response);
    } else {
        console.log('no registrationUploadCompanyLogoBannerWebinar');
    }

    // logo, video, and brochure (no banner, no webinar)
    if (
        companyLogo == 1 &&
        companyBanner == 0 &&
        thumbnailInput == 1 &&
        brochureInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == ''
    ) {
        // let response = registrationUploadCompanyLogoVideoBrochure(uuid);
        let response = uploadProcess(uuid, uploadUrl.logoVideoBrochure);
        console.log('yes registrationUploadCompanyLogoVideoBrochure');
        console.log('registrationUploadCompanyLogoVideoBrochure: ' + response);
    } else {
        console.log('no registrationUploadCompanyLogoVideoBrochure');
    }

    // logo, video, and webinar (no banner, no brochure)
    if (
        companyLogo == 1 &&
        companyBanner == 0 &&
        thumbnailInput == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == 1
    ) {
        // let response = registrationUploadCompanyLogoVideoWebinar(uuid);
        let response = uploadProcess(uuid, uploadUrl.logoVideoWebinar);
        console.log('yes registrationUploadCompanyLogoVideoWebinar');
        console.log('registrationUploadCompanyLogoVideoWebinar: ' + response);
    } else {
        console.log('no registrationUploadCompanyLogoVideoWebinar');
    }

    // logo, brochure, and webinar (no banner, no video)
    if (
        companyLogo == 1 &&
        companyBanner == 0 &&
        brochureInput == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == 1
    ) {
        // let response = registrationUploadCompanyLogoBrochureWebinar(uuid);
        let response = uploadProcess(uuid, uploadUrl.logoBrochureWebinar);
        console.log('yes registrationUploadCompanyLogoBrochureWebinar');
        console.log('registrationUploadCompanyLogoBrochureWebinar: ' + response);
    } else {
        console.log('no registrationUploadCompanyLogoBrochureWebinar');
    }

    // banner, video, and brochure (no logo, no webinar)
    if (
        companyLogo == 0 &&
        companyBanner == 1 &&
        thumbnailInput == 1 &&
        brochureInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == ''
    ) {
        // let response = registrationUploadCompanyBannerVideoBrochure(uuid);
        let response = uploadProcess(uuid, uploadUrl.bannerVideoBrochure);
        console.log('yes registrationUploadCompanyBannerVideoBrochure');
        console.log('registrationUploadCompanyBannerVideoBrochure: ' + response);
    } else {
        console.log('no registrationUploadCompanyBannerVideoBrochure');
    }

    // banner, video, and webinar (no logo, no brochure)
    if (
        companyLogo == 0 &&
        companyBanner == 1 &&
        thumbnailInput == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == 1 &&
        isWantToUploadBrochure == '' &&
        isWantToUploadCompanyWebinar == 1
    ) {
        // let response = registrationUploadCompanyBannerVideoWebinar(uuid);
        let response = uploadProcess(uuid, uploadUrl.bannerVideoWebinar);
        console.log('yes registrationUploadCompanyBannerVideoWebinar');
        console.log('registrationUploadCompanyBannerVideoWebinar: ' + response);
    } else {
        console.log('no registrationUploadCompanyBannerVideoWebinar');
    }

    // banner, webinar, and brochure (no logo, no video)
    if (
        companyLogo == 0 &&
        companyBanner == 1 &&
        brochureInput == 1 &&
        webinarsThumbnailInput == 1 &&
        isWantToUploadVideo == '' &&
        isWantToUploadBrochure == 1 &&
        isWantToUploadCompanyWebinar == 1
    ) {
        // let response = registrationUploadCompanyBannerBrochureWebinar(uuid);
        let response = uploadProcess(uuid, uploadUrl.bannerWebinarBrochure);
        console.log('yes registrationUploadCompanyBannerBrochureWebinar');
        console.log('registrationUploadCompanyBannerBrochureWebinar: ' + response);
    } else {
        console.log('no registrationUploadCompanyBannerBrochureWebinar');
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
            // console.log(data);
            value = data;
        },
        error: function (e) {
            // some code here
        },
    });

    return value;
}

function uploadProcess(uuid, uploadUrl) {
    let value;

    // Get form
    let form = $('#traderRegistrationForm')[0];

    // Create an FormData object
    let formData = new FormData(form);
    formData.append('uuid', uuid);

    $.ajax({
        type: 'post',
        enctype: 'multipart/form-data',
        url: uploadUrl,
        data: formData,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        success: function (data) {
            // console.log(data);
            value = data;
        },
        error: function (e) {
            // some code here
        },
    });

    return value;
}
