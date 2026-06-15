let companyLogoPreview;
let companyBannerPreview;
let companyLogoId;
let companyBannerId;
let userImage;
let isAvatar;

companyLogoPreview = getId('companyLogoPreview');
companyBannerPreview = getId('companyBannerPreview');
companyLogoId = getId('companyLogoId');
companyBannerId = getId('companyBannerId');
userImage = getId('user-image');
isAvatar = getId('is_avatar');

$(function () {
    getUser();
    getUsersAccount();
    // getUserAddress();
    getCompanyDetails();
    getUsersLogoAndBanner();
});

function getUser() {
    $.ajax({
        url: '/api/get/user',
        type: 'POST',
        success: function (data) {
            document.getElementById('firstName').value = data[0].first_name;
            document.getElementById('lastName').value = data[0].last_name;
            document.getElementById('middleName').value = data[0].middle_name;
        },
    });
}

function getUsersAccount() {
    $.ajax({
        url: '/api/get/users-account',
        type: 'POST',
        success: function (data) {
            document.getElementById('personalSocialMediaContactNumber').value = data[0].contact_number;
            // getSocialMediaContactType(data[0].social_media_contact_type, 'personalSocialMediaContactType');
            getBusinessSocialMediaContactType(data[0].social_media_contact_type, 'personalSocialMediaContactType');
        },
    });
}

function getCompanyDetails() {
    $.ajax({
        // url: '/api/get/company-details',
        url: '/api/get/users-business',
        type: 'POST',
        success: function (data) {
            document.getElementById('displayBusinessNameH1').innerHTML = data[0].business_name;
            document.getElementById('companyName').value = data[0].business_name;
            document.getElementById('businessWebsite').value = data[0].business_website;
            document.getElementById('businessEmailAddress').value = data[0].business_email;
            document.getElementById('businessContactNumber').value = data[0].business_contact;
            // getSocialMediaContactType(data[0].business_social_media_contact_type, 'businessSocialMediaContactType');
            getBusinessSocialMediaContactType(
                data[0].business_social_media_contact_type,
                'businessSocialMediaContactType',
            );
            document.getElementById('businessSocialMediaContactNumber').value =
                data[0].business_social_media_contact_number;
            // document.getElementById('currentLanguagesOfCommunication').value =
            //     data[0].business_language_of_communication;
            business_language_of_communication(data[0].business_language_of_communication, 'language');
            getBusinessCountryLocationToBeEditAndOptions(data, 'businessCountryLocation');
            getBusinessStatesLocationToBeEditAndOptions(data, 'businessStatesLocation');
            getBusinessCityLocationToBeEditAndOptions(data, 'businessCityLocation');
        },
    });
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
                    userImage.src = host + '/uploads/users_upload_files/' + data[0].logo;
                    isAvatar.src = host + '/uploads/users_upload_files/' + data[0].logo;
                } else {
                    companyLogoPreview.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                    userImage.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                    isAvatar.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                }
                companyLogoId.value = data[0].id;
                companyBannerId.value = data[0].id;
            } else {
                companyBannerPreview.src = host + '/uploads/placeholder/banner-placeholder.png';
                companyLogoPreview.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                userImage.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                isAvatar.src = host + '/uploads/placeholder/logo-placeholder.jpg';
            }
        },
    });
}

function getBusinessSocialMediaContactType(value, elementId) {
    // const businessSocialMediaContactType = document.getElementById(elementId);
    const socialMediaContactTypeId = document.getElementById(elementId);

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
        socialMediaContactTypeId.innerHTML = `
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
        //   const businessSocialMediaContactType = document.getElementById('businessSocialMediaContactType');
        socialMediaContactTypeId.innerHTML = `
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
    $(socialMediaContactTypeId).selectpicker('refresh');
}

// function getSocialMediaContactType(value, elementId) {
//     let jsonObj =
//         '{ "companyDetails" : [' +
//         '{ "id":"1" , "title":"Viber" },' +
//         '{ "id":"2" , "title":"Wechat" },' +
//         '{ "id":"3" , "title":"Whatsapp" } ]}';

//     const parsedObj = JSON.parse(jsonObj);
//     let companyDetails = parsedObj.companyDetails;

//     let filtered = companyDetails.filter((d) => d.id == value);

//     document.getElementById(elementId).innerHTML =
//         '<option value="' + filtered[0].id + '">' + filtered[0].title + '</option>';
//     for (var i = 0; i < companyDetails.length; i++) {
//         document.getElementById(elementId).innerHTML =
//             document.getElementById(elementId).innerHTML +
//             '<option value="' +
//             companyDetails[i]['id'] +
//             '">' +
//             companyDetails[i]['title'] +
//             '</option>';
//     }
//     $('#' + elementId).selectpicker('refresh');
// }

// async function getLanguages() {
//     let response = await fetch(host + '/api/get/languages');
//     let data = await response.json();
//     return data;
// }

// // display all languages in frontend select option
// getLanguages().then((data) => {
//     document.getElementById('language').innerHTML = '<option value="" disabled>Status Quo</option>';
//     for (var i = 0; i < data.length; i++) {
//         document.getElementById('language').innerHTML =
//             document.getElementById('language').innerHTML +
//             '<option value="' +
//             data[i]['code'] +
//             '">' +
//             data[i]['name'] +
//             '</option>';
//     }
//     $('#language').selectpicker('refresh');
// });

async function business_language_of_communication(languages, elementId) {
    //const editLanguagesOfCommunication = document.getElementById('editLanguagesOfCommunication');
    const languageElementId = document.getElementById(elementId);
    // consume api to get all languages
    async function getLanguages() {
        const response = await fetch(`${host}/api/get/languages`);
        const data = await response.json();
        return data;
    }

    try {
        const data = await getLanguages();
        const arr = languages.split(',');

        // const editLanguagesOfCommunication = document.getElementById('editLanguagesOfCommunication');
        languageElementId.innerHTML = '';

        const selectedOptions = data
            .filter((d) => arr.includes(d.code))
            .map((d) => `<option value="${d.code}" selected>${d.name}</option>`);
        const unselectedOptions = data
            .filter((d) => !arr.includes(d.code))
            .map((d) => `<option value="${d.code}">${d.name}</option>`);

        languageElementId.innerHTML = selectedOptions.concat(unselectedOptions).join('');

        $(languageElementId).selectpicker('refresh');
    } catch (error) {
        console.error(error);
    }
}

companyBanner.onchange = (evt) => {
    const [file] = companyBanner.files;
    if (file) {
        companyBannerPreview.src = URL.createObjectURL(file);
        editcompanyBanner();
    }
};

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

document.getElementById('companyLogo').onchange = (evt) => {
    const [file] = companyLogo.files;
    if (file) {
        companyLogoPreview.src = URL.createObjectURL(file);
        editcompanyLogo();
    }
};

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

const $form = $('#editMediumScaleForm');

document.getElementById('btnUpdateMediumScale').addEventListener('click', (e) => {
    //stop submit the form, we will post it manually.
    e.preventDefault();

    $.ajax({
        // url: '/api/post/update-medium-scale-company',
        url: '/api/v2/post/update-medium-scale-company',
        type: 'post',
        data: $form.serialize(),
    }).done((response) => {
        if (response === 'success') {
            Swal.fire('Success', 'Update Successful.', 'success');
            setTimeout(() => {
                location.replace(host + '/profile');
            }, 1500);
        } else {
            Swal.fire('Warning', 'Something went wrong. Please call the administrator', 'warning');
        }
    });
});

function backProfile() {
    location.replace(host + '/profile');
}
