let companyLogoPreview;
let companyBannerPreview;
let companyLogoId;
let companyBannerId;

let btnUpdateCompanyDetails;

let displayBusinessNameH1;
let displayBusinessTagLineH1;
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

let isAvatar = getId('is_avatar');
companyLogoPreview = getId('companyLogoPreview');
companyBannerPreview = getId('companyBannerPreview');
companyLogoId = getId('companyLogoId');
companyBannerId = getId('companyBannerId');

btnUpdateCompanyDetails = getId('btnUpdateCompanyDetails');

displayBusinessNameH1 = getId('displayBusinessNameH1');
displayBusinessTagLineH1 = getId('displayBusinessTagLineH1');
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
});

function getCompanyDetails() {
    $.ajax({
        url: '/api/get/company-details',
        type: 'POST',
        success: function (data) {
            console.log('/api/get/company-details data', data);
            displayBusinessNameH1.innerHTML = data[0].business_name;
            displayBusinessTagLineH1.innerHTML = data[0].business_tagline;

            businessAddress.value = data[0].business_address;
            currentLanguagesOfCommunication.value = data[0].business_language_of_communication;
            tagline.value = data[0].business_tagline;
            website.value = data[0].business_website;
            businessEmailAddress.value = data[0].business_email;
            businessContactNumber.value = data[0].business_contact;
            getBusinessSocialMediaContactType(data[0].business_social_media_contact_type);
            businessSocialMediaContactNumber.value = data[0].business_social_media_contact_number;
            business_language_of_communication(data[0].business_language_of_communication);
            document.getElementById('startOperatingHour').value = data[0].start_operating_hour;
            document.getElementById('endOperatingHour').value = data[0].end_operating_hour;
            //document.getElementById("myTime").value = "22:53:05";
            const tagsData = data[0].business_industry_belong_to;
            displayTagList(tagsData);
        },
    });
}

function getBusinessSocialMediaContactType(value) {
    const jsonObj = {
        companyDetails: [
            { id: '', title: 'None' },
            { id: '1', title: 'Viber' },
            { id: '2', title: 'Wechat' },
            { id: '3', title: 'Whatsapp' },
        ],
    };
    const parsedObj = JSON.parse(JSON.stringify(jsonObj)); // create a deep copy to avoid mutation
    const companyDetails = parsedObj.companyDetails;

    if (value == '' || value == null) {
        businessSocialMediaContactType.innerHTML = `
        ${companyDetails
            .map(
                (d) => `
            <option value="${d.id}">${d.title}</option>
        `,
            )
            .join('')}
      `;
    } else {
        const filtered = companyDetails.find((d) => d.id == value);
        const businessSocialMediaContactType = document.getElementById('businessSocialMediaContactType');
        businessSocialMediaContactType.innerHTML = `
        <option value="${filtered.id}">${filtered.title}</option>
        ${companyDetails
            .filter((d) => d.id != value)
            .map(
                (d) => `
                <option value="${d.id}">${d.title}</option>
            `,
            )
            .join('')}
      `;
    }
    $('#businessSocialMediaContactType').selectpicker('refresh');
}

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
                    isAvatar.src = host + '/uploads/users_upload_files/' + data[0].logo;
                } else {
                    companyLogoPreview.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                    isAvatar.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                }
                companyLogoId.value = data[0].id;
                companyBannerId.value = data[0].id;
            } else {
                companyBannerPreview.src = host + '/uploads/placeholder/banner-placeholder.png';
                companyLogoPreview.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                isAvatar.src = host + '/uploads/placeholder/logo-placeholder.jpg';
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
    let value = data[0].business_scale;
    let x = getBusinessScaleTitle(value);
    document.getElementById('editBusinessScale').innerHTML = '<option value="' + value + '">' + x + '</option>';

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

        if (i + 1 == leng) {
            $('#editBusinessScale').selectpicker('refresh');
        }
    }
}

const $form = $('#editCompanyDetails');

btnUpdateCompanyDetails.addEventListener('click', (e) => {
    //stop submit the form, we will post it manually.
    e.preventDefault();

    let validation = updateTradersProfileValidation();
    console.log('btnUpdateCompanyDetails', validation);
    if (validation === 'true') {
        $.ajax({
            // url: '/api/post/update-company-details',
            url: '/api/v2/post/update-company-details',
            type: 'post',
            data: $form.serialize(),
        }).done((response) => {
            if (response === 'success') {
                Swal.fire('Success', 'Update Successful.', 'success');
                location.replace(host + '/profile');
                setTimeout(() => {
                    location.replace(host + '/profile');
                }, 1500);
            }
        });
    } else {
        Swal.fire('Warning', 'At least one required field is incomplete.', 'warning');
    }
});

function backProfile() {
    location.replace(host + '/profile');
}
