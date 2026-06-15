$(function () {
    getUser();
    getUsersAddress();
    getUsersAccount();
    getCompanyDetails();
    getUserBusinessCharacteristics();
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

function getUsersAddress() {
    $.ajax({
        url: '/api/get/users-address',
        type: 'POST',
        success: function (data) {
            getCountryLocation(data, 'country');
            getStatesLocation(data, 'states');
            getCityLocation(data, 'city');
        },
    });
}

function getUsersAccount() {
    $.ajax({
        url: '/api/get/users-account',
        type: 'POST',
        success: function (data) {
            document.getElementById('personalSocialMediaContactNumber').value = data[0].contact_number;
            getSocialMediaContactType(data[0].social_media_contact_type, 'personalSocialMediaContactType');

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
        url: '/api/get/company-details',
        type: 'POST',
        success: function (data) {
            document.getElementById('companyName').value = data[0].business_name;
            document.getElementById('tagline').value = data[0].business_tagline;
            document.getElementById('businessAddress').value = data[0].business_address;
            document.getElementById('website').value = data[0].business_website;
            document.getElementById('businessEmailAddress').value = data[0].business_email;
            document.getElementById('businessContactNumber').value = data[0].business_contact;
            document.getElementById('businessSocialMediaContactNumber').value =
                data[0].business_social_media_contact_number;
            document.getElementById('currentLanguagesOfCommunication').value =
                data[0].business_language_of_communication;

            // getBusinessSocialMediaContactType(data[0].business_social_media_contact_type);
            getSocialMediaContactType(data[0].business_social_media_contact_type, 'businessSocialMediaContactType');

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
            if (data[0].business_tagline == null || data[0].business_tagline == '') {
                document.getElementById('taglineValidation').innerHTML = 'Tagline is required';
            }
            if (data[0].business_address == null || data[0].business_address == '') {
                document.getElementById('businessAddressValidation').innerHTML = 'Business Address is required';
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
            if (data[0].business_website == null || data[0].business_website == '') {
                document.getElementById('websiteValidation').innerHTML = 'Business Website is required';
            }
            if (data[0].business_email == null || data[0].business_email == '') {
                document.getElementById('businessEmailAddressValidation').innerHTML =
                    'Business Email Address is required';
            }
            if (data[0].business_contact == null || data[0].business_contact == '') {
                document.getElementById('businessContactNumberValidation').innerHTML =
                    'Business Contact Number is required';
            }
            if (
                data[0].business_social_media_contact_number == null ||
                data[0].business_social_media_contact_number == ''
            ) {
                document.getElementById('businessSocialMediaContactNumberValidation').innerHTML =
                    'Business Social Media Contact Number is required';
            }
            if (
                data[0].business_social_media_contact_type == null ||
                data[0].business_social_media_contact_type == ''
            ) {
                document.getElementById('businessSocialMediaContactTypeValidation').innerHTML =
                    'Social Media / Messaging App is required';
            }
        },
    });
}

// consume api to get all languages
async function getLanguages() {
    let response = await fetch(host + '/api/get/languages');
    let data = await response.json();
    return data;
}

// display all languages in frontend select option
getLanguages().then((data) => {
    document.getElementById('editLanguagesOfCommunication').innerHTML = '<option value="" disabled>Status Quo</option>';
    for (var i = 0; i < data.length; i++) {
        document.getElementById('editLanguagesOfCommunication').innerHTML =
            document.getElementById('editLanguagesOfCommunication').innerHTML +
            '<option value="' +
            data[i]['code'] +
            '">' +
            data[i]['name'] +
            '</option>';
    }
});

function getBusinessCountryLocationToBeEditAndOptions(value, elementId) {
    fetch('assets/json/countries.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            if (value[0].business_country) {
                let filtered = data.filter((d) => d.iso2 == value[0].business_country);

                document.getElementById(elementId).innerHTML =
                    '<option value="' + filtered[0].iso2 + '" >' + filtered[0].name + '</option>';
            } else {
                document.getElementById(elementId).innerHTML = '<option value="">Select</option>';
            }

            for (var i = 0; i < data.length; i++) {
                document.getElementById(elementId).innerHTML =
                    document.getElementById(elementId).innerHTML +
                    '<option value="' +
                    data[i].iso2 +
                    '">' +
                    data[i].name +
                    '</option>';
            }

            $('#' + elementId).selectpicker('refresh');
        });
}

function getBusinessStatesLocationToBeEditAndOptions(value, elementId) {
    fetch('assets/json/states.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.country_code == value[0].business_country);
            let filtered2 = filtered.filter((x) => x.id == value[0].business_states);

            document.getElementById(elementId).innerHTML =
                '<option value="' + filtered2[0].id + '" >' + filtered2[0].name + '</option>';

            for (var i = 0; i < filtered.length; i++) {
                let option = document.createElement('option');
                option.value = filtered[i].id;
                option.innerHTML = filtered[i].name;
                document.getElementById(elementId).appendChild(option);
            }

            $('#' + elementId).selectpicker('refresh');
        });
}

function getBusinessCityLocationToBeEditAndOptions(value, elementId) {
    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.country_code == value[0].business_country);
            let filtered2 = filtered.filter((x) => x.state_id == value[0].business_states);
            let filtered3 = filtered.filter((x) => x.id == value[0].business_city);

            document.getElementById(elementId).innerHTML =
                '<option value="' + filtered3[0].id + '" >' + filtered3[0].name + '</option>';

            for (var i = 0; i < filtered2.length; i++) {
                let option = document.createElement('option');
                option.value = filtered2[i].id;
                option.innerHTML = filtered2[i].name;
                document.getElementById(elementId).appendChild(option);
            }

            $('#' + elementId).selectpicker('refresh');
        });
}

document.getElementById('businessCountryLocation').addEventListener('change', function () {
    $('#businessStatesLocation').empty();
    $('#businessCityLocation').empty();

    let traderBusinessCountryCode = this.value;

    fetch('assets/json/states.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    document.getElementById('businessStatesLocation').innerHTML =
                        document.getElementById('businessStatesLocation').innerHTML +
                        '<option value="' +
                        filtered[i].id +
                        '">' +
                        filtered[i].name +
                        '</option>';
                }
            } else {
                let option = document.createElement('option');
                option.value = 'No States Found';
                option.innerHTML = 'No States Found';
                document.getElementById('businessStatesLocation').appendChild(option);
            }

            $('#businessStatesLocation').selectpicker('refresh');
        });

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_id = document.getElementById('businessStatesLocation').value;
            let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    if (filtered[i].state_id == state_id) {
                        document.getElementById('businessCityLocation').innerHTML =
                            document.getElementById('businessCityLocation').innerHTML +
                            '<option value="' +
                            filtered[i].id +
                            '">' +
                            filtered[i].name +
                            '</option>';
                    }
                }
            } else {
                let option = document.createElement('option');
                option.value = 'No Cities Found';
                option.innerHTML = 'No Cities Found';
                document.getElementById('businessCityLocation').appendChild(option);
            }

            $('#businessCityLocation').selectpicker('refresh');
        });
});

document.getElementById('businessStatesLocation').addEventListener('change', function () {
    $('#businessCityLocation').empty();

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_id = document.getElementById('businessStatesLocation').value;
            let traderResidenceCountryCode = document.getElementById('businessCountryLocation').value;
            let filtered = data.filter((d) => d.country_code == traderResidenceCountryCode);
            let filtered2 = filtered.filter((x) => x.state_id == state_id);

            if (filtered2.length) {
                for (var i = 0; i < filtered2.length; i++) {
                    document.getElementById('businessCityLocation').innerHTML =
                        document.getElementById('businessCityLocation').innerHTML +
                        '<option value="' +
                        filtered2[i].id +
                        '">' +
                        filtered2[i].name +
                        '</option>';
                }
            } else {
                let option = document.createElement('option');
                option.value = 'No Cities Found';
                option.innerHTML = 'No Cities Found';
                document.getElementById('businessCityLocation').appendChild(option);
            }

            $('#businessCityLocation').selectpicker('refresh');
        });
});

function getUserBusinessCharacteristics() {
    $.ajax({
        url: '/api/get/user-business-characteristics',
        type: 'POST',
        success: function (value) {
            if (value.length > 0) {
                getTradeCategoriesFunction(value);
            }
            if (value.length > 0) {
                getSubCategoriesByTradeCategoryIdFunction(value);
            }
            if (value.length > 0) {
                getMinorSubCategoriesByIdFunction(value);
            }

            if (value.length === 0) {
                document.getElementById('editTradeCategoryValidation').innerHTML = 'Trade Category is required';
                document.getElementById('traderSubCategoryValidation').innerHTML = 'Trade Sub Category is required';
                document.getElementById('traderMinorSubCategoryValidation').innerHTML =
                    'Minor Sub Category is required';
            }
        },
    });
}

function getTradeCategoriesFunction(value) {
    async function getTradeCategories() {
        let response = await fetch(host + '/api/get/categories');
        let data = await response.json();
        return data;
    }

    getTradeCategories().then((data) => {
        document.getElementById('traderMinorSubCategoryToggleField1').disabled = true;

        if (value[0].business_major_category) {
            let code = value[0].business_major_category;
            let filtered = data.filter((d) => d.id == code);

            document.getElementById('editTradeCategory').innerHTML =
                '<option value="' + filtered[0].id + '">' + filtered[0].title + '</option>';
        } else {
            document.getElementById('editTradeCategory').innerHTML = '<option value="">Select</option>';
        }
        for (var i = 0; i < data.length; i++) {
            document.getElementById('editTradeCategory').innerHTML =
                document.getElementById('editTradeCategory').innerHTML +
                '<option value="' +
                data[i]['id'] +
                '">' +
                data[i]['title'] +
                '</option>';
        }

        $('#editTradeCategory').selectpicker('refresh');
    });
}

function getSubCategoriesByTradeCategoryIdFunction(value) {
    async function getSubCategoriesByTradeCategoryId() {
        let tradeCategoryId = value[0].business_major_category;
        let response = await fetch(host + '/api/get/sub-categories-by-trade-category-id/' + tradeCategoryId);
        let data = await response.json();
        return data;
    }

    getSubCategoriesByTradeCategoryId().then((data) => {
        document.getElementById('traderSubCategoryToggleField1').disabled = false;

        let code = value[0].business_sub_category;
        let filtered = data.filter((d) => d.id == code);

        document.getElementById('traderSubCategoryToggleField1').innerHTML =
            '<option value="' + filtered[0].id + '">' + filtered[0].title + '</option>';
        for (var i = 0; i < data.length; i++) {
            document.getElementById('traderSubCategoryToggleField1').innerHTML =
                document.getElementById('traderSubCategoryToggleField1').innerHTML +
                '<option value="' +
                data[i]['id'] +
                '">' +
                data[i]['title'] +
                '</option>';
        }
        document.getElementById('traderSubCategoryToggleField1').innerHTML =
            document.getElementById('traderSubCategoryToggleField1').innerHTML +
            '<option value="customOption">Other (Type a custom value)</option><input id="traderSubCategoryToggleField2" name="editSubCategory" style="display:none;" disabled="disabled" >';

        // $('#traderSubCategoryToggleField1').selectpicker('refresh');
    });
}

function getMinorSubCategoriesByIdFunction(value) {
    async function getMinorSubCategoriesById() {
        let subCategoryId = value[0].business_sub_category;
        let response = await fetch(host + '/api/get/minor-sub-categories-by-sub-category-id/' + subCategoryId);
        let data = await response.json();
        return data;
    }

    getMinorSubCategoriesById().then((data) => {
        let minorSubCategoryId = value[0].business_minor_sub_category;
        let filtered = data.filter((d) => d.id == minorSubCategoryId);
        document.getElementById('traderMinorSubCategoryToggleField1').innerHTML =
            '<option value="' + filtered[0].id + '" >' + filtered[0].title + '</option>';

        if (data.length === undefined) {
            $('#traderMinorSubCategoryToggleField1').empty();
            document.getElementById('traderMinorSubCategoryToggleField1').style.display = 'none';
            document.getElementById('traderMinorSubCategoryToggleField1').disabled = false;

            document.getElementById('traderMinorSubCategoryToggleField2').style.display = 'block';
            document.getElementById('traderMinorSubCategoryToggleField2').disabled = false;
            document.getElementById('traderMinorSubCategoryToggleField2').style.display = 'inline';
            document.getElementById('traderMinorSubCategoryToggleField2').focus();
        } else {
            document.getElementById('traderMinorSubCategoryToggleField1').disabled = false;

            for (var i = 0; i < data.length; i++) {
                document.getElementById('traderMinorSubCategoryToggleField1').innerHTML =
                    document.getElementById('traderMinorSubCategoryToggleField1').innerHTML +
                    '<option value="' +
                    data[i]['id'] +
                    '">' +
                    data[i]['title'] +
                    '</option>';
            }
            document.getElementById('traderMinorSubCategoryToggleField1').innerHTML =
                document.getElementById('traderMinorSubCategoryToggleField1').innerHTML +
                '<option value="none">None</option><option value="customOption">Other (Type a custom value)</option><input id="traderMinorSubCategoryToggleField2" name="editMinorSubCategory" style="display:none;" disabled="disabled" >';

            // $('#traderMinorSubCategoryToggleField1').selectpicker('refresh');
        }
    });
}

// consume api to get all trade categories
async function getTradeCategories() {
    let response = await fetch(host + '/api/get/categories');
    let data = await response.json();
    return data;
}

// display all trade categories in frontend select option
getTradeCategories().then((data) => {
    document.getElementById('traderMinorSubCategoryToggleField1').disabled = true;
    document.getElementById('editTradeCategory').innerHTML = '<option value="">Select</option>';
    for (var i = 0; i < data.length; i++) {
        document.getElementById('editTradeCategory').innerHTML =
            document.getElementById('editTradeCategory').innerHTML +
            '<option value="' +
            data[i]['id'] +
            '">' +
            data[i]['title'] +
            '</option>';
    }
    $('#editTradeCategory').selectpicker('refresh');
});

document.getElementById('editTradeCategory').addEventListener('change', function () {
    let tradeCategoryId = this.value;

    async function getSubCategoriesByTradeCategoryId() {
        let response = await fetch(host + '/api/get/sub-categories-by-trade-category-id/' + tradeCategoryId);
        let data = await response.json();
        return data;
    }

    getSubCategoriesByTradeCategoryId().then((data) => {
        document.getElementById('traderSubCategoryToggleField1').disabled = false;

        document.getElementById('traderSubCategoryToggleField1').innerHTML = '<option value=""> Select </option>';
        for (var i = 0; i < data.length; i++) {
            document.getElementById('traderSubCategoryToggleField1').innerHTML =
                document.getElementById('traderSubCategoryToggleField1').innerHTML +
                '<option value="' +
                data[i]['id'] +
                '">' +
                data[i]['title'] +
                '</option>';
        }
        document.getElementById('traderSubCategoryToggleField1').innerHTML =
            document.getElementById('traderSubCategoryToggleField1').innerHTML +
            '<option value="customOption">Other (Type a custom value)</option><input id="traderSubCategoryToggleField2" name="traderSubCategoryToggleField" style="display:none;" disabled="disabled" >';
    });
});

document.getElementById('traderSubCategoryToggleField1').addEventListener('change', function () {
    document.getElementById('traderMinorSubCategoryToggleField1').disabled = false;
    $('#traderMinorSubCategoryToggleField1').empty();
    let subCategoryId = this.value;

    if (this.options[this.selectedIndex].value == 'customOption') {
        toggleField(this, this.nextSibling);
        this.selectedIndex = '0';

        document.getElementById('traderMinorSubCategoryToggleField1').style.display = 'none';
        document.getElementById('traderMinorSubCategoryToggleField1').disabled = false;

        document.getElementById('traderMinorSubCategoryToggleField2').style.display = 'block';
        document.getElementById('traderMinorSubCategoryToggleField2').disabled = false;
    }

    if (this.options[this.selectedIndex].value !== 'customOption' && subCategoryId !== 'customOption') {
        async function getMinorSubCategoriesByTradeCategoryId() {
            let response = await fetch(host + '/api/get/minor-sub-categories-by-sub-category-id/' + subCategoryId);
            let data = await response.json();
            return data;
        }

        getMinorSubCategoriesByTradeCategoryId().then((data) => {
            if (data.length === undefined) {
                $('#traderMinorSubCategoryToggleField1').empty();
                document.getElementById('traderMinorSubCategoryToggleField1').style.display = 'none';
                document.getElementById('traderMinorSubCategoryToggleField1').disabled = false;

                document.getElementById('traderMinorSubCategoryToggleField2').style.display = 'block';
                document.getElementById('traderMinorSubCategoryToggleField2').disabled = false;
                document.getElementById('traderMinorSubCategoryToggleField2').style.display = 'inline';
                document.getElementById('traderMinorSubCategoryToggleField2').focus();
            } else {
                document.getElementById('traderMinorSubCategoryToggleField1').disabled = false;

                document.getElementById('traderMinorSubCategoryToggleField1').innerHTML =
                    '<option value=""> Select </option>';
                for (var i = 0; i < data.length; i++) {
                    document.getElementById('traderMinorSubCategoryToggleField1').innerHTML =
                        document.getElementById('traderMinorSubCategoryToggleField1').innerHTML +
                        '<option value="' +
                        data[i]['id'] +
                        '">' +
                        data[i]['title'] +
                        '</option>';
                }
                document.getElementById('traderMinorSubCategoryToggleField1').innerHTML =
                    document.getElementById('traderMinorSubCategoryToggleField1').innerHTML +
                    '<option value="none">None</option><option value="customOption">Other (Type a custom value)</option><input id="traderMinorSubCategoryToggleField2" name="editMinorSubCategory" style="display:none;" disabled="disabled" >';
            }
        });
    }
});

document.getElementById('traderSubCategoryToggleField2').addEventListener('blur', function () {
    if (this.value == '') {
        toggleField(this, this.previousSibling);

        document.getElementById('traderMinorSubCategoryToggleField2').style.display = 'none';
        document.getElementById('traderMinorSubCategoryToggleField2').disabled = false;
        document.getElementById('traderMinorSubCategoryToggleField2').value = '';

        document.getElementById('traderMinorSubCategoryToggleField1').style.display = 'block';
        document.getElementById('traderMinorSubCategoryToggleField1').disabled = false;
    }
});

document.getElementById('traderMinorSubCategoryToggleField1').addEventListener('change', function () {
    if (this.options[this.selectedIndex].value == 'customOption') {
        toggleField(this, this.nextSibling);
        this.selectedIndex = '0';
    }
});

document.getElementById('traderMinorSubCategoryToggleField2').addEventListener('blur', function () {
    if (this.value == '') {
        toggleField(this, this.previousSibling);
    }
});

function toggleField(hideObj, showObj) {
    hideObj.disabled = true;
    hideObj.style.display = 'none';
    showObj.disabled = false;
    showObj.style.display = 'inline';
    showObj.focus();
}

function getCountryLocation(value, elementId) {
    fetch('assets/json/countries.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.iso2 == value[0].country);

            document.getElementById(elementId).innerHTML =
                '<option value="' + filtered[0].iso2 + '" >' + filtered[0].name + '</option>';

            for (var i = 0; i < data.length; i++) {
                document.getElementById(elementId).innerHTML =
                    document.getElementById(elementId).innerHTML +
                    '<option value="' +
                    data[i].iso2 +
                    '">' +
                    data[i].name +
                    '</option>';
            }
            $('#' + elementId).selectpicker('refresh');
        });
}

function getStatesLocation(value, elementId) {
    fetch('assets/json/states.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.country_code == value[0].country);
            let filtered2 = filtered.filter((x) => x.id == value[0].state_or_province);

            document.getElementById(elementId).innerHTML =
                '<option value="' + filtered2[0].id + '" >' + filtered2[0].name + '</option>';

            for (var i = 0; i < filtered.length; i++) {
                let option = document.createElement('option');
                option.value = filtered[i].id;
                option.innerHTML = filtered[i].name;
                document.getElementById(elementId).appendChild(option);
            }

            $('#' + elementId).selectpicker('refresh');
        });
}

function getCityLocation(value, elementId) {
    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.country_code == value[0].country);
            let filtered2 = filtered.filter((x) => x.state_id == value[0].state_or_province);
            let filtered3 = filtered.filter((x) => x.id == value[0].city);

            document.getElementById(elementId).innerHTML =
                '<option value="' + filtered3[0].id + '" >' + filtered3[0].name + '</option>';

            for (var i = 0; i < filtered2.length; i++) {
                let option = document.createElement('option');
                option.value = filtered2[i].id;
                option.innerHTML = filtered2[i].name;
                document.getElementById(elementId).appendChild(option);
            }

            $('#' + elementId).selectpicker('refresh');
        });
}

document.getElementById('country').addEventListener('change', function () {
    $('#states').empty();
    $('#city').empty();

    let traderBusinessCountryCode = this.value;

    fetch('assets/json/states.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    document.getElementById('states').innerHTML =
                        document.getElementById('states').innerHTML +
                        '<option value="' +
                        filtered[i].id +
                        '">' +
                        filtered[i].name +
                        '</option>';
                }
            } else {
                let option = document.createElement('option');
                option.value = 'No States Found';
                option.innerHTML = 'No States Found';
                document.getElementById('states').appendChild(option);
            }

            $('#states').selectpicker('refresh');
        });

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_id = document.getElementById('states').value;
            let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    if (filtered[i].state_id == state_id) {
                        document.getElementById('city').innerHTML =
                            document.getElementById('city').innerHTML +
                            '<option value="' +
                            filtered[i].id +
                            '">' +
                            filtered[i].name +
                            '</option>';
                    }
                }
            } else {
                let option = document.createElement('option');
                option.value = 'No Cities Found';
                option.innerHTML = 'No Cities Found';
                document.getElementById('city').appendChild(option);
            }

            $('#city').selectpicker('refresh');
        });
});

document.getElementById('country').addEventListener('change', function () {
    $('#states').empty();
    $('#city').empty();

    let traderBusinessCountryCode = this.value;

    fetch('assets/json/states.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    document.getElementById('states').innerHTML =
                        document.getElementById('states').innerHTML +
                        '<option value="' +
                        filtered[i].id +
                        '">' +
                        filtered[i].name +
                        '</option>';
                }
            } else {
                let option = document.createElement('option');
                option.value = 'No States Found';
                option.innerHTML = 'No States Found';
                document.getElementById('states').appendChild(option);
            }

            $('#states').selectpicker('refresh');
        });

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_id = document.getElementById('states').value;
            let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    if (filtered[i].state_id == state_id) {
                        document.getElementById('city').innerHTML =
                            document.getElementById('city').innerHTML +
                            '<option value="' +
                            filtered[i].id +
                            '">' +
                            filtered[i].name +
                            '</option>';
                    }
                }
            } else {
                let option = document.createElement('option');
                option.value = 'No Cities Found';
                option.innerHTML = 'No Cities Found';
                document.getElementById('city').appendChild(option);
            }

            $('#city').selectpicker('refresh');
        });
});

document.getElementById('states').addEventListener('change', function () {
    $('#city').empty();

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_id = document.getElementById('states').value;
            let traderResidenceCountryCode = document.getElementById('country').value;
            let filtered = data.filter((d) => d.country_code == traderResidenceCountryCode);
            let filtered2 = filtered.filter((x) => x.state_id == state_id);

            if (filtered2.length) {
                for (var i = 0; i < filtered2.length; i++) {
                    document.getElementById('city').innerHTML =
                        document.getElementById('city').innerHTML +
                        '<option value="' +
                        filtered2[i].id +
                        '">' +
                        filtered2[i].name +
                        '</option>';
                }
            } else {
                let option = document.createElement('option');
                option.value = 'No Cities Found';
                option.innerHTML = 'No Cities Found';
                document.getElementById('city').appendChild(option);
            }

            $('#city').selectpicker('refresh');
        });
});

document.getElementById('businessCountryLocation').addEventListener('change', function () {
    $('#businessStatesLocation').empty();
    $('#businessCityLocation').empty();

    let traderBusinessCountryCode = this.value;

    fetch('assets/json/states.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    document.getElementById('businessStatesLocation').innerHTML =
                        document.getElementById('businessStatesLocation').innerHTML +
                        '<option value="' +
                        filtered[i].id +
                        '">' +
                        filtered[i].name +
                        '</option>';
                }
            } else {
                let option = document.createElement('option');
                option.value = 'No States Found';
                option.innerHTML = 'No States Found';
                document.getElementById('businessStatesLocation').appendChild(option);
            }

            $('#businessStatesLocation').selectpicker('refresh');
        });

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_id = document.getElementById('businessStatesLocation').value;
            let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    if (filtered[i].state_id == state_id) {
                        document.getElementById('businessCityLocation').innerHTML =
                            document.getElementById('businessCityLocation').innerHTML +
                            '<option value="' +
                            filtered[i].id +
                            '">' +
                            filtered[i].name +
                            '</option>';
                    }
                }
            } else {
                let option = document.createElement('option');
                option.value = 'No Cities Found';
                option.innerHTML = 'No Cities Found';
                document.getElementById('businessCityLocation').appendChild(option);
            }

            $('#businessCityLocation').selectpicker('refresh');
        });
});

document.getElementById('businessStatesLocation').addEventListener('change', function () {
    $('#businessCityLocation').empty();

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_id = document.getElementById('businessStatesLocation').value;
            let traderResidenceCountryCode = document.getElementById('businessCountryLocation').value;
            let filtered = data.filter((d) => d.country_code == traderResidenceCountryCode);
            let filtered2 = filtered.filter((x) => x.state_id == state_id);

            if (filtered2.length) {
                for (var i = 0; i < filtered2.length; i++) {
                    document.getElementById('businessCityLocation').innerHTML =
                        document.getElementById('businessCityLocation').innerHTML +
                        '<option value="' +
                        filtered2[i].id +
                        '">' +
                        filtered2[i].name +
                        '</option>';
                }
            } else {
                let option = document.createElement('option');
                option.value = 'No Cities Found';
                option.innerHTML = 'No Cities Found';
                document.getElementById('businessCityLocation').appendChild(option);
            }

            $('#businessCityLocation').selectpicker('refresh');
        });
});

function getBusinessSocialMediaContactType(value) {
    let jsonObj =
        '{ "companyDetails" : [' +
        '{ "id":"1" , "title":"Viber" },' +
        '{ "id":"2" , "title":"Wechat" },' +
        '{ "id":"3" , "title":"Whatsapp" } ]}';

    const parsedObj = JSON.parse(jsonObj);
    let companyDetails = parsedObj.companyDetails;

    let filtered = companyDetails.filter((d) => d.id == value);

    document.getElementById('businessSocialMediaContactType').innerHTML =
        '<option value="' + filtered[0].id + '">' + filtered[0].title + '</option>';
    for (var i = 0; i < companyDetails.length; i++) {
        document.getElementById('businessSocialMediaContactType').innerHTML =
            document.getElementById('businessSocialMediaContactType').innerHTML +
            '<option value="' +
            companyDetails[i]['id'] +
            '">' +
            companyDetails[i]['title'] +
            '</option>';
    }
}

function getSocialMediaContactType(value, elementId) {
    let jsonObj =
        '{ "companyDetails" : [' +
        '{ "id":"1" , "title":"Viber" },' +
        '{ "id":"2" , "title":"Wechat" },' +
        '{ "id":"3" , "title":"Whatsapp" } ]}';

    const parsedObj = JSON.parse(jsonObj);
    let companyDetails = parsedObj.companyDetails;

    if (value == null || value == '') {
        document.getElementById(elementId).innerHTML = '<option value="">Select</option>';
    } else {
        let filtered = companyDetails.filter((d) => d.id == value);

        document.getElementById(elementId).innerHTML =
            '<option value="' + filtered[0].id + '">' + filtered[0].title + '</option>';
    }

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

const $form = $('#editLargeScaleForm');

document.getElementById('btnUpdateLargeScale').addEventListener('click', (e) => {
    //stop submit the form, we will post it manually.
    e.preventDefault();

    let validation = upgradeToLargeScaleClientSideValidation();

    if (validation === 'true') {
        $.ajax({
            url: '/api/post/upgrade-plan-to-large-scale-company',
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
