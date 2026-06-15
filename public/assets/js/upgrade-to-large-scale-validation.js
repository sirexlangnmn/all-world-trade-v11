document.getElementById('companyName').onkeyup = function () {
    required('companyName', 'companyNameValidation', 'Company Name is required');
};
document.getElementById('tagline').onkeyup = function () {
    required('tagline', 'taglineValidation', 'Tagline is required');
};
document.getElementById('businessAddress').onkeyup = function () {
    required('businessAddress', 'businessAddressValidation', 'Business Address is required');
};
document.getElementById('website').onkeyup = function () {
    required('website', 'websiteValidation', 'Business Website is required');
};
document.getElementById('businessEmailAddress').onkeyup = function () {
    required('businessEmailAddress', 'businessEmailAddressValidation', 'Business Email Address is required');
};
document.getElementById('businessContactNumber').onkeyup = function () {
    required('businessContactNumber', 'businessContactNumberValidation', 'Business Contact Number is required');
};
document.getElementById('businessSocialMediaContactNumber').onkeyup = function () {
    required(
        'businessSocialMediaContactNumber',
        'businessSocialMediaContactNumberValidation',
        'Business Social Media Contact Number is required',
    );
};
document.getElementById('businessSocialMediaContactType').onchange = function () {
    required(
        'businessSocialMediaContactType',
        'businessSocialMediaContactTypeValidation',
        'Social Media / Messaging App is required',
    );
};
document.getElementById('businessCountryLocation').onchange = function () {
    required('businessCountryLocation', 'businessCountryLocationValidation', 'Business Country Location is required');

    setInterval(function () {
        required('businessStatesLocation', 'businessStatesLocationValidation', 'Business States Location is required');
        required('businessCityLocation', 'businessCityLocationValidation', 'Business City Location is required');
    }, 1000);
};
document.getElementById('businessStatesLocation').onchange = function () {
    required('businessStatesLocation', 'businessStatesLocationValidation', 'Business States Location is required');
};
document.getElementById('personalSocialMediaContactNumber').onkeyup = function () {
    required(
        'personalSocialMediaContactNumber',
        'personalSocialMediaContactNumberValidation',
        'Optional but recommended',
    );
};
document.getElementById('personalSocialMediaContactType').onchange = function () {
    required('personalSocialMediaContactType', 'personalSocialMediaContactTypeValidation', 'Optional but recommended');
};
document.getElementById('editTradeCategory').onchange = function () {
    required('editTradeCategory', 'editTradeCategoryValidation', 'Trade Category is required');
};
document.getElementById('traderSubCategoryToggleField1').onchange = function () {
    required('traderSubCategoryToggleField1', 'traderSubCategoryValidation', 'Trade Sub Category is required');
};
document.getElementById('traderMinorSubCategoryToggleField1').onchange = function () {
    required(
        'traderMinorSubCategoryToggleField1',
        'traderMinorSubCategoryValidation',
        'Minor Sub Category is required',
    );
};

function required(elementIdInput, elementIdValidation, message) {
    if (document.getElementById(elementIdInput).value.length == 0) {
        document.getElementById(elementIdValidation).style.display = 'block';
        document.getElementById(elementIdValidation).innerHTML = message;
    } else {
        document.getElementById(elementIdValidation).style.display = 'none';
        document.getElementById(elementIdValidation).innerHTML = '';
    }
}

function upgradeToLargeScaleClientSideValidation() {
    let output = 'true';

    if (document.getElementById('companyName').value.length == 0) {
        output = 'empty_companyName';
        document.getElementById('companyNameValidation').innerHTML = 'Company Name is required';
    }
    if (document.getElementById('tagline').value.length == 0) {
        output = 'empty_tagline';
        document.getElementById('taglineValidation').innerHTML = 'Tagline is required';
    }
    if (document.getElementById('businessAddress').value.length == 0) {
        output = 'empty_businessAddress';
        document.getElementById('businessAddressValidation').innerHTML = 'Business Address is required';
    }
    if (document.getElementById('website').value.length == 0) {
        output = 'empty_website';
        document.getElementById('websiteValidation').innerHTML = 'Business Website is required';
    }
    if (document.getElementById('businessEmailAddress').value.length == 0) {
        output = 'empty_businessEmailAddress';
        document.getElementById('businessEmailAddressValidation').innerHTML = 'Business Email Address is required';
    }
    if (document.getElementById('businessContactNumber').value.length == 0) {
        output = 'empty_businessContactNumber';
        document.getElementById('businessContactNumberValidation').innerHTML = 'Business Contact Number is required';
    }
    if (document.getElementById('businessSocialMediaContactNumber').value.length == 0) {
        output = 'empty_businessSocialMediaContactNumber';
        document.getElementById('businessSocialMediaContactNumberValidation').innerHTML =
            'Business Social Media Contact Number is required';
    }
    if (document.getElementById('businessSocialMediaContactType').value.length == 0) {
        output = 'empty_businessSocialMediaContactType';
        document.getElementById('businessSocialMediaContactTypeValidation').innerHTML =
            'Social Media / Messaging App is required';
    }
    if (document.getElementById('businessCountryLocation').value.length == 0) {
        output = 'empty_businessCountryLocation';
        document.getElementById('businessCountryLocationValidation').innerHTML =
            'Business Country Location is required';
    }
    if (document.getElementById('businessStatesLocation').value.length == 0) {
        output = 'empty_businessStatesLocation';
        document.getElementById('businessStatesLocationValidation').innerHTML = 'Business States Location is required';
    }
    if (document.getElementById('businessCityLocation').value.length == 0) {
        output = 'empty_businessCityLocation';
        document.getElementById('businessCityLocationValidation').innerHTML = 'Business City Location is required';
    }
    if (document.getElementById('personalSocialMediaContactType').value.length == 0) {
        output = 'empty_personalSocialMediaContactType';
        document.getElementById('personalSocialMediaContactTypeValidation').innerHTML = 'Optional but recommended';
    }
    if (document.getElementById('personalSocialMediaContactNumber').value.length == 0) {
        output = 'empty_personalSocialMediaContactNumber';
        document.getElementById('personalSocialMediaContactNumberValidation').innerHTML = 'Company Name is required';
    }
    if (document.getElementById('editTradeCategory').value.length == 0) {
        output = 'empty_editTradeCategory';
        document.getElementById('editTradeCategoryValidation').innerHTML = 'Trade Category is required';
    }
    if (document.getElementById('traderSubCategoryToggleField1').value.length == 0) {
        output = 'empty_traderSubCategoryToggleField1';
        document.getElementById('traderSubCategoryValidation').innerHTML = 'Trade Sub Category is required';
    }
    if (document.getElementById('traderMinorSubCategoryToggleField1').value.length == 0) {
        output = 'empty_traderMinorSubCategoryToggleField1';
        document.getElementById('traderMinorSubCategoryValidation').innerHTML = 'Minor Sub Category is required';
    }

    return output;
}
