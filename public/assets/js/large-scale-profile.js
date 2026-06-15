$(function () {
    getUser();
    getUsersAccount();
    getUserAddress();
    getCompanyDetails();
    getUsersBusinessCharacteristics();
});

function getUser() {
    $.ajax({
        url: '/api/get/user',
        type: 'POST',
        success: function (data) {
            document.getElementById('firstName').innerHTML = data[0].first_name;
            document.getElementById('lastName').innerHTML = data[0].last_name;
            document.getElementById('middleName').innerHTML = data[0].middle_name;
        },
    });
}

function getUsersAccount() {
    $.ajax({
        url: '/api/get/users-account',
        type: 'POST',
        success: function (data) {
            document.getElementById('emailAddress').innerHTML = data[0].email_or_social_media;
            displayBusinessSocialMediaContactType(data[0].social_media_contact_type, 'socialMediaContactType');
            document.getElementById('socialMediaContactNumber').innerHTML = data[0].contact_number;
        },
    });
}

function getUserAddress() {
    $.ajax({
        url: '/api/get/users-address',
        type: 'POST',
        success: function (data) {
            getCityNameToBeDisplayUsingCode(data[0].city, 'city');
            getStatesNameToBeDisplayUsingCode(data[0].state_or_province, 'states');
            getCountryNameUsingCode(data[0].country, 'country');
        },
    });
}

function getCompanyDetails() {
    $.ajax({
        url: '/api/get/company-details',
        type: 'POST',
        success: function (data) {
            document.getElementById('displayBusinessNameH1').innerHTML = data[0].business_name;
            document.getElementById('businessName').innerHTML = data[0].business_name;
            document.getElementById('businessTagline').innerHTML = data[0].business_tagline;
            document.getElementById('businessWebsite').innerHTML = data[0].business_website;
            document.getElementById('businessEmailAddress').innerHTML = data[0].business_email;
            document.getElementById('businessContactNumber').innerHTML = data[0].business_contact;
            displayBusinessSocialMediaContactType(
                data[0].business_social_media_contact_type,
                'businessSocialMediaContactType',
            );
            document.getElementById('businessSocialMediaContactNumber').innerHTML =
                data[0].business_social_media_contact_number;
            getLanguageName(data[0].business_language_of_communication, 'languageOfComm');
            document.getElementById('businessAddress').innerHTML = data[0].business_address;
            getCityNameToBeDisplayUsingCode(data[0].business_city, 'businessCity');
            getStatesNameToBeDisplayUsingCode(data[0].business_states, 'businessStates');
            getCountryNameUsingCode(data[0].business_country, 'businessCountry');
        },
    });
}

function getUsersBusinessCharacteristics() {
    $.ajax({
        url: '/api/get/user-business-characteristics',
        type: 'POST',
        success: function (data) {
            displayBusinessTradeCategory.innerHTML = getTradeCategoriesTitleById(data[0].business_major_category);
            displayBusinessSubCategory.innerHTML = getSubCategoriesTitleById(
                data[0].business_sub_category,
                data[0].business_sub_category_str,
            );
            displayBusinessMinorCategory.innerHTML = getMinorSubCategoriesTitleById(
                data[0].business_minor_sub_category,
                data[0].business_minor_sub_category_str,
            );
        },
    });
}

function getLanguageName(string, elementId) {
    if (string) {
        let data = string.split(',');
        for (var i = 0; i < data.length; i++) {
            document.getElementById(elementId).innerHTML =
                document.getElementById(elementId).innerHTML +
                '<a href="#" class="bg-gray-200 py-1.5 px-4 rounded-full">' +
                getLanguageNameByCode(data[i]) +
                '</a>';
        }
    } else {
        document.getElementById(elementId).innerHTML = 'N/A';
    }
}

function getCountryNameUsingCode(code, elementId) {
    if (code) {
        fetch('assets/json/countries.json')
            .then(function (resp) {
                return resp.json();
            })
            .then(function (data) {
                let filtered = data.filter((d) => d.iso2 == code);
                document.getElementById(elementId).innerHTML = filtered[0].name;
            });
    } else {
        document.getElementById(elementId).innerHTML = 'N/A';
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
    $.ajax({
        url: host + '/api/get/trade-category-title-by-id/' + id,
        async: false,
        success: function (data) {
            value = data[0].title;
        },
    });
    return value;
}

function getSubCategoriesTitleById(id, str) {
    if (id) {
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

    if (str) {
        return str;
    }
}

function getMinorSubCategoriesTitleById(id, str) {
    if (id || str) {
        if (id) {
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

        if (str) {
            return str;
        }
    } else {
        return 'N/A';
    }
}

function displayBusinessSocialMediaContactType(value, elementId) {
    let jsonObj =
        '{ "socialMediaContactType" : [' +
        '{ "id":"" , "title":"None" },' +
        '{ "id":"1" , "title":"Viber" },' +
        '{ "id":"2" , "title":"Wechat" },' +
        '{ "id":"3" , "title":"Whatsapp" } ]}';

    const parsedObj = JSON.parse(jsonObj);
    let data = parsedObj.socialMediaContactType;

    let filtered = data.filter((d) => d.id == value);

    if (filtered.length > 0) {
        document.getElementById(elementId).innerHTML = filtered[0].title;
    } else {
        document.getElementById(elementId).innerHTML = parsedObj.socialMediaContactType[0].title;
    }
}

function editProfile() {
    // location.replace(host + '/edit-traders-profile');
    location.href = '/edit-large-scale-profile';
}
