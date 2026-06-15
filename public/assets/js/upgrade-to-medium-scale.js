$(function () {
    getUser();
    getUsersAccount();
    getCompanyDetails();
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
            if (data[0].social_media_contact_type) {
                getSocialMediaContactType(data[0].social_media_contact_type, 'personalSocialMediaContactType');
            }

            if (data[0].contact_number == null || data[0].contact_number == '') {
                document.getElementById('personalSocialMediaContactNumberValidation').innerHTML =
                    'Optional but recommended';
            }
            if (data[0].social_media_contact_type == null || data[0].social_media_contact_type == '') {
                document.getElementById('personalSocialMediaContactTypeValidation').innerHTML =
                    'Optional but recommended';
            }
        },
    });
}

function getCompanyDetails() {
    $.ajax({
        // url: '/api/get/company-details',
        url: '/api/get/users-business',
        type: 'POST',
        success: function (data) {
            if (data[0].business_social_media_contact_type) {
                getSocialMediaContactType(data[0].business_social_media_contact_type, 'businessSocialMediaContactType');
            }
            document.getElementById('displayBusinessNameH1').innerHTML = data[0].business_name;
            document.getElementById('companyName').value = data[0].business_name;
            document.getElementById('businessWebsite').value = data[0].business_website;
            document.getElementById('businessEmailAddress').value = data[0].business_email;
            document.getElementById('businessContactNumber').value = data[0].business_contact;
            document.getElementById('businessSocialMediaContactNumber').value =
                data[0].business_social_media_contact_number;
            document.getElementById('currentLanguagesOfCommunication').value =
                data[0].business_language_of_communication;

            getBusinessCountryLocationToBeEditAndOptions(data, 'businessCountryLocation');

            if (data[0].business_country && data[0].business_states) {
                getBusinessStatesLocationToBeEditAndOptions(data, 'businessStatesLocation');
            }
            if (data[0].business_country && data[0].business_states && data[0].business_city) {
                getBusinessCityLocationToBeEditAndOptions(data, 'businessCityLocation');
            }

            if (data[0].business_name == null || data[0].business_name == '') {
                document.getElementById('companyNameValidation').innerHTML = 'Company Name is required';
            }
            if (data[0].business_website == null || data[0].business_website == '') {
                document.getElementById('businessWebsiteValidation').innerHTML = 'Business Website is required';
            }
            if (data[0].business_email == null || data[0].business_email == '') {
                document.getElementById('businessEmailAddressValidation').innerHTML =
                    'Business Email Address is required';
            }
            if (data[0].business_contact == null || data[0].business_contact == '') {
                document.getElementById('businessContactNumberValidation').innerHTML =
                    'Business Contact Number is required';
            }
            if (data[0].business_country == null || data[0].business_country == '') {
                document.getElementById('businessCountryLocationValidation').innerHTML =
                    'Business Country Location is required';
            }
            if (data[0].business_states == null || data[0].business_states == '') {
                document.getElementById('businessStatesLocationValidation').innerHTML =
                    'Business States Location is required';
            }
            if (data[0].business_city == null || data[0].business_city == '') {
                document.getElementById('businessCityLocationValidation').innerHTML =
                    'Business City Location is required';
            }
        },
    });
}

function getSocialMediaContactType(value, elementId) {
    let jsonObj =
        '{ "companyDetails" : [' +
        '{ "id":"1" , "title":"Viber" },' +
        '{ "id":"2" , "title":"Wechat" },' +
        '{ "id":"3" , "title":"Whatsapp" } ]}';

    const parsedObj = JSON.parse(jsonObj);
    let companyDetails = parsedObj.companyDetails;

    let filtered = companyDetails.filter((d) => d.id == value);

    document.getElementById(elementId).innerHTML =
        '<option value="' + filtered[0].id + '">' + filtered[0].title + '</option>';
    for (var i = 0; i < companyDetails.length; i++) {
        document.getElementById(elementId).innerHTML =
            document.getElementById(elementId).innerHTML +
            '<option value="' +
            companyDetails[i]['id'] +
            '">' +
            companyDetails[i]['title'] +
            '</option>';
    }
    $('#' + elementId).selectpicker('refresh');
}

async function getLanguages() {
    let response = await fetch(host + '/api/get/languages');
    let data = await response.json();
    return data;
}

// display all languages in frontend select option
getLanguages().then((data) => {
    document.getElementById('language').innerHTML = '<option value="" disabled>Status Quo</option>';
    for (var i = 0; i < data.length; i++) {
        document.getElementById('language').innerHTML =
            document.getElementById('language').innerHTML +
            '<option value="' +
            data[i]['code'] +
            '">' +
            data[i]['name'] +
            '</option>';
    }
});

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

const $form = $('#editMediumScaleForm');

document.getElementById('btnUpdateMediumScale').addEventListener('click', (e) => {
    //stop submit the form, we will post it manually.
    e.preventDefault();

    let validation = upgradeToMediumScaleClientSideValidation();

    if (validation === 'true') {
        $.ajax({
            url: '/api/post/upgrade-plan-to-medium-scale-company',
            type: 'post',
            data: $form.serialize(),
        }).done((response) => {
            if (response === 'success') {
                location.replace(host + '/profile');
            }
        });
    }
});

function backProfile() {
    location.replace(host + '/profile');
}
