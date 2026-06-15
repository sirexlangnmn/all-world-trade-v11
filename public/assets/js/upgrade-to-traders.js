// 'use strict';

let companyLogoPreview;
let companyBannerPreview;
let companyLogoId;
let companyBannerId;

let btnUpgradeToTraders;

let tagline;
let website;
let businessEmailAddress;
let businessContactNumber;
let businessSocialMediaContactType;
let businessSocialMediaContactNumber;
let businessAddress;
let businessCountryLocation;
let businessCityLocation;
let startOperatingHour;
let endOperatingHour;
let languagesOfCommunication;
let currentLanguagesOfCommunication;
let tradeCategory;
let traderSubCategoryToggleField;
let traderMinorSubCategoryToggleField;
let businessScale;

companyLogoPreview = getId('companyLogoPreview');
companyBannerPreview = getId('companyBannerPreview');
companyLogoId = getId('companyLogoId');
companyBannerId = getId('companyBannerId');

btnUpgradeToTraders = getId('btnUpgradeToTraders');

tagline = getId('tagline');
website = getId('website');
businessEmailAddress = getId('businessEmailAddress');
businessContactNumber = getId('businessContactNumber');
businessSocialMediaContactType = getId('businessSocialMediaContactType');
businessSocialMediaContactNumber = getId('businessSocialMediaContactNumber');
businessAddress = getId('businessAddress');
currentLanguagesOfCommunication = getId('currentLanguagesOfCommunication');

$(function () {
    getUsersLogoAndBanner();
    getUser();
    getUsersAccount();
    getCompanyDetails();
    requiredFieldForUpgradeToTraders();
});

function getCompanyDetails() {
    $.ajax({
        url: '/api/get/company-details',
        type: 'POST',
        success: function (data) {
            document.getElementById('traderCompanyName').value = data[0].business_name;
            businessAddress.value = data[0].business_address;
            currentLanguagesOfCommunication.value = data[0].business_language_of_communication;
            tagline.value = data[0].business_tagline;
            website.value = data[0].business_website;
            businessEmailAddress.value = data[0].business_email;
            businessContactNumber.value = data[0].business_contact;
            getBusinessSocialMediaContactType(data[0].business_social_media_contact_type);
            businessSocialMediaContactNumber.value = data[0].business_social_media_contact_number;

            if (data[0].business_name == null || data[0].business_name == '') {
                document.getElementById('traderCompanyNameValidation').innerHTML = 'Company Name is required';
            }
            if (data[0].business_address == null || data[0].business_address == '') {
                document.getElementById('businessAddressValidation').innerHTML = 'Business Address is required';
            }
            if (data[0].business_tagline == null || data[0].business_tagline == '') {
                document.getElementById('taglineValidation').innerHTML = 'Tagline is required';
            }
            if (data[0].business_website == null || data[0].business_website == '') {
                document.getElementById('websiteValidation').innerHTML = 'Business Website is required';
            }
            if (data[0].business_email == null || data[0].business_email == '') {
                document.getElementById('businessEmailAddressValidation').innerHTML =
                    'Business Email Address is required';
            }
            if (data[0].business_contact == null || data[0].business_contact == '') {
                document.getElementById('businessContactNumberValidation').innerHTML =
                    'business Contact Number is required';
            }
            if (
                data[0].business_social_media_contact_type == null ||
                data[0].business_social_media_contact_type == ''
            ) {
                document.getElementById('businessSocialMediaContactTypeValidation').innerHTML =
                    'Business Social Media Contact Type is required';
            }
            if (
                data[0].business_social_media_contact_number == null ||
                data[0].business_social_media_contact_number == ''
            ) {
                document.getElementById('businessSocialMediaContactNumberValidation').innerHTML =
                    'Business Social Media Contact Number is required';
            }
            // if (data[0].start_operating_hour == null || data[0].start_operating_hour == "") {
            //     document.getElementById('startOperatingHourValidation').innerHTML = 'Start of Operating Hour is required';
            // }
            // if (data[0].end_operating_hour == null || data[0].end_operating_hour == "") {
            //     document.getElementById('endOperatingHourValidation').innerHTML = 'End of Operating Hour is required';
            // }
            // if (data[0].business_ == null || data[0].business == "") {
            //     document.getElementById('Validation').innerHTML = ' is required';
            // }
        },
    });
}

function getBusinessSocialMediaContactType(value) {
    let jsonObj =
        '{ "companyDetails" : [' +
        '{ "id":"1" , "title":"Viber" },' +
        '{ "id":"2" , "title":"Wechat" },' +
        '{ "id":"3" , "title":"Whatsapp" } ]}';

    const parsedObj = JSON.parse(jsonObj);
    let companyDetails = parsedObj.companyDetails;
    if (value) {
        let filtered = companyDetails.filter((d) => d.id == value);
        businessSocialMediaContactType.innerHTML =
            '<option value="' + filtered[0].id + '">' + filtered[0].title + '</option>';
    } else {
        businessSocialMediaContactType.innerHTML = '<option value="">Select</option>';
    }

    for (var i = 0; i < companyDetails.length; i++) {
        businessSocialMediaContactType.innerHTML =
            businessSocialMediaContactType.innerHTML +
            '<option value="' +
            companyDetails[i]['id'] +
            '">' +
            companyDetails[i]['title'] +
            '</option>';
    }

    $('#businessSocialMediaContactType').selectpicker('refresh');
}

// display all users logo and banners in frontend profiles
// function getUsersLogoAndBanner() {
//     $.ajax({
//         url: '/api/get/users-logo-and-banners',
//         type: 'GET',
//         success: function (data) {
//             if (data.length > 0) {
//                 let companyBannerImage = data[0].banner ?  '/uploads/users_upload_files/' + data[0].banner : '/uploads/placeholder/banner-placeholder2.jpg';
//                 companyBannerPreview.src = host + companyBannerImage;
//                 companyLogoPreview.src = host + '/uploads/users_upload_files/' + data[0].logo;
//                 companyLogoId.value = data[0].id;
//                 companyBannerId.value = data[0].id;
//             }
//         },
//     });
// }

function getUsersLogoAndBanner() {
    $.ajax({
        url: '/api/get/users-logo-and-banners',
        type: 'GET',
        success: function (data) {
            if (data.length > 0) {
                if (data[0].banner) {
                    companyBannerPreview.src = host + '/uploads/users_upload_files/' + data[0].banner;
                } else {
                    companyBannerPreview.src = host + '/uploads/placeholder/banner-placeholder.png';
                }
                if (data[0].logo) {
                    companyLogoPreview.src = host + '/uploads/users_upload_files/' + data[0].logo;
                } else {
                    companyLogoPreview.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                }
                companyLogoId.value = data[0].id;
                companyBannerId.value = data[0].id;
            } else {
                companyBannerPreview.src = host + '/uploads/placeholder/banner-placeholder.png';
                companyLogoPreview.src = host + '/uploads/placeholder/logo-placeholder.jpg';
            }
        },
    });
}

companyLogo.onchange = (evt) => {
    const [file] = companyLogo.files;
    if (file) {
        companyLogoPreview.src = URL.createObjectURL(file);
        editcompanyLogo();
    }
};

companyBanner.onchange = (evt) => {
    const [file] = companyBanner.files;
    if (file) {
        companyBannerPreview.src = URL.createObjectURL(file);
        editcompanyBanner();
    }
};

function getLanguageName(string) {
    if (string) {
        let data = string.split(',');
        for (var i = 0; i < data.length; i++) {
            displayLanguageOfComm.innerHTML =
                displayLanguageOfComm.innerHTML +
                '<a href="#" class="bg-gray-200 py-1.5 px-4 rounded-full">' +
                getLanguageNameByCode(data[i]) +
                '</a>';
        }
    } else {
        displayLanguageOfComm.innerHTML = 'N/A';
    }
}

function getLanguageNameByCode(code) {
    let value;
    $.ajax({
        url: host + '/api/get/language-name-by-code/' + code,
        async: false,
        success: function (data) {
            value = data[0].name;
        },
    });
    return value;
}

function getTradeCategoriesTitleById(id) {
    let value;

    if (id) {
        $.ajax({
            url: host + '/api/get/trade-category-title-by-id/' + id,
            async: false,
            success: function (data) {
                value = data[0].title;
            },
        });
        return value;
    } else {
        return 'N/A';
    }
}

function getSubCategoriesTitleById(id) {
    let value;
    $.ajax({
        url: host + '/api/get/sub-category-title-by-id/' + id,
        async: false,
        success: function (data) {
            value = data[0].title;
        },
    });
    return value;
}

function getMinorSubCategoriesTitleById(id) {
    let value;
    $.ajax({
        url: host + '/api/get/minor-sub-category-title-by-id/' + id,
        async: false,
        success: function (data) {
            value = data[0].title;
        },
    });
    return value;
}

function getBusinessScaleTitle(id) {
    let value;

    switch (id) {
        case 1:
            value = 'Small Scale';
            break;
        case 2:
            value = 'Medium Scale';
            break;
        case 3:
            value = 'Large Scale';
            break;
        default:
            value = 'N/A';
    }

    return value;
}

function getUser() {
    $.ajax({
        url: '/api/get/user',
        type: 'POST',
        success: function (data) {
            document.getElementById('displayReprestativeFullname').innerHTML =
                data[0].first_name + ' ' + data[0].last_name;
        },
    });
}

function getUsersAccount() {
    $.ajax({
        url: '/api/get/users-account',
        type: 'POST',
        success: function (data) {
            document.getElementById('displayReprestativeEmailAddress').innerHTML = data[0].email_or_social_media;
            document.getElementById('displayReprestativeContactNumber').innerHTML = data[0].contact_number;
        },
    });
}

function editcompanyLogo() {
    // Get form
    let form = $('#editcompanyLogo')[0];

    // Create an FormData object
    let data = new FormData(form);

    $.ajax({
        type: 'POST',
        enctype: 'multipart/form-data',
        url: '/api/post/update-trader-company-logo',
        data: data,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        success: function (data) {
            // some code here
        },
        error: function (jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 413) {
                console.error('Request Entity Too Large');
                console.log('Request Entity Too Large');
                Swal.fire('Warning', 'Try to upload file image lower than 1mb', 'warning');
                // Handle error response
            }
        },
    });
}

function editcompanyBanner() {
    // Get form
    let form = $('#editcompanyBanner')[0];

    // Create an FormData object
    let data = new FormData(form);

    $.ajax({
        type: 'POST',
        enctype: 'multipart/form-data',
        url: '/api/post/update-trader-company-banner',
        data: data,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        success: function (data) {
            // some code here
        },
        error: function (jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 413) {
                console.error('Request Entity Too Large');
                console.log('Request Entity Too Large');
                Swal.fire('Warning', 'Try to upload file image lower than 1mb', 'warning');
                // Handle error response
            }
        },
    });
}

function getUsersBusinessScale(data) {
    if (data.length > 0) {
        if (data[0].business_scale) {
            let value = data[0].business_scale;
            let x = getBusinessScaleTitle(value);
            document.getElementById('editBusinessScale').innerHTML = '<option value="' + value + '">' + x + '</option>';
        } else {
            document.getElementById('editBusinessScale').innerHTML = '<option value="">Select</option>';
        }
    } else {
        document.getElementById('editBusinessScale').innerHTML = '<option value="">Select</option>';
    }

    let jsonObj =
        '{ "companyDetails" : [' +
        '{ "id":"1" , "title":"Small Scale" },' +
        '{ "id":"2" , "title":"Medium Scale" },' +
        '{ "id":"3" , "title":"Large Scale" } ]}';

    const parsedObj = JSON.parse(jsonObj);
    let companyDetails = parsedObj.companyDetails;
    let leng = companyDetails.length;

    for (let i = 0; i < leng; i++) {
        document.getElementById('editBusinessScale').innerHTML =
            document.getElementById('editBusinessScale').innerHTML +
            '<option value="' +
            companyDetails[i]['id'] +
            '">' +
            companyDetails[i]['title'] +
            '</option>';
    }
    $('#editBusinessScale').selectpicker('refresh');
}

const $form = $('#upgradeToTradersForm');

btnUpgradeToTraders.addEventListener('click', (e) => {
    //stop submit the form, we will post it manually.
    e.preventDefault();

    let validation = upgradeToTradersClientSideValidation();

    if (validation === 'true') {
        $.ajax({
            url: '/api/post/upgrade-to-traders',
            type: 'post',
            data: $form.serialize(),
        }).done((response) => {
            if (response.id) {
                upgradeUploadBusinessMedias(response.uuid);
                Swal.fire('Success', 'Upgrade Success.', 'success');
            } else {
                Swal.fire('Info', 'Something went wrong. Please contact the administrator.', 'info');
                setTimeout(function () {
                    location.replace(host + '/profile');
                }, 3 * 1000);
            }

            setTimeout(function () {
                location.replace(host + '/profile');
            }, 3 * 1000);
        });
    } else {
        Swal.fire('Warning', 'At least one required field is incomplete.', 'warning');
    }
});

thumbnailInput.addEventListener('change', inputThumbnailFileName);
webinarsThumbnailInput.addEventListener('change', webinarsThumbnailFileName);
brochureInput.addEventListener('change', brochureFileName);

function inputThumbnailFileName() {
    let fileName = thumbnailInput.value;
    thumbnailName.innerHTML = fileName;
    traderVideoThumbnailValidation.style.display = 'none';
}

function brochureFileName() {
    let fileName = brochureInput.value;
    brochureName.innerHTML = fileName;
    traderBrochureValidation.style.display = 'none';
}

function webinarsThumbnailFileName() {
    let fileName = webinarsThumbnailInput.value;
    webinarsThumbnailName.innerHTML = fileName;
    traderWebinarThumbnailValidation.style.display = 'none';
}

function requiredFieldForUpgradeToTraders() {
    required('startOperatingHour', 'startOperatingHourValidation', 'Start of Operating Hour is required');
    required('endOperatingHour', 'endOperatingHourValidation', 'End of Operating Hour is required');
}

function backProfile() {
    location.replace(host + '/profile');
}
