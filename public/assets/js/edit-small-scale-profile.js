$(function () {
    getUser();
    getUserAddress();
    getUsersAccount();
    getCompanyDetails();
});

function editProfile() {
    // location.replace(host + '/edit-traders-profile');
    location.href = '/edit-small-scale-profile';
}

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

function getUserAddress() {
    $.ajax({
        url: '/api/get/users-address',
        type: 'POST',
        success: function (data) {},
    });
}

function getCompanyDetails() {
    $.ajax({
        // url: '/api/get/company-details',
        url: '/api/get/users-business',
        type: 'POST',
        success: function (data) {
            document.getElementById('currentLanguagesOfCommunication').value =
                data[0].business_language_of_communication;
        },
    });
}

function getUsersAccount() {
    $.ajax({
        url: '/api/get/users-account',
        type: 'POST',
        success: function (data) {
            getBusinessSocialMediaContactType(data[0].social_media_contact_type);
            document.getElementById('socialMediaContactNumber').value = data[0].contact_number;
        },
    });
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
    $('#language').selectpicker('refresh');
});

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

        document.getElementById('socialMediaContactType').innerHTML =
            '<option value="' + filtered[0].id + '">' + filtered[0].title + '</option>';
    } else {
        document.getElementById('socialMediaContactType').innerHTML = '<option value="" disabled>Select</option>';
    }

    for (var i = 0; i < companyDetails.length; i++) {
        document.getElementById('socialMediaContactType').innerHTML =
            document.getElementById('socialMediaContactType').innerHTML +
            '<option value="' +
            companyDetails[i]['id'] +
            '">' +
            companyDetails[i]['title'] +
            '</option>';
    }
}

const $form = $('#editSmallScaleForm');

document.getElementById('btnUpdateSmallScale').addEventListener('click', (e) => {
    //stop submit the form, we will post it manually.
    e.preventDefault();

    $.ajax({
        url: '/api/post/update-small-scale-company',
        type: 'post',
        data: $form.serialize(),
    }).done((response) => {
        if (response === 'success') {
            location.replace(host + '/profile');
        }
    });
});

function backProfile() {
    location.replace(host + '/profile');
}
