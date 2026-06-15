document.getElementById('companyName').onkeyup = function () {
    required(companyName, companyNameValidation, 'Company Name is required');
};
document.getElementById('businessWebsite').onkeyup = function () {
    required(businessWebsite, businessWebsiteValidation, 'Business Website is required');
};
document.getElementById('businessEmailAddress').onkeyup = function () {
    required(businessEmailAddress, businessEmailAddressValidation, 'Business Email Address is required');
};
document.getElementById('businessContactNumber').onkeyup = function () {
    required(businessContactNumber, businessContactNumberValidation, 'Business Contact Number is required');
};
document.getElementById('businessCountryLocation').onchange = function () {
    required(businessCountryLocation, businessCountryLocationValidation, 'Business Country Location is required');

    setInterval(function () {
        required(businessStatesLocation, businessStatesLocationValidation, 'Business States Location is required');
        required(businessCityLocation, businessCityLocationValidation, 'Business City Location is required');
    }, 1000);
};
document.getElementById('businessStatesLocation').onchange = function () {
    required(businessStatesLocation, businessStatesLocationValidation, 'Business States Location is required');
};
document.getElementById('businessCityLocation').onchange = function () {
    required(businessCityLocation, businessCityLocationValidation, 'Business City Location is required');
};
document.getElementById('personalSocialMediaContactType').onchange = function () {
    required(personalSocialMediaContactType, personalSocialMediaContactTypeValidation, 'Optional but recommended');
};
document.getElementById('personalSocialMediaContactNumber').onkeyup = function () {
    required(personalSocialMediaContactNumber, personalSocialMediaContactNumberValidation, 'Company Name is required');
};

function required(elementIdInput, elementIdValidation, message) {
    if (elementIdInput.value.length == 0) {
        elementIdValidation.style.display = 'block';
        elementIdValidation.innerHTML = message;
    } else {
        elementIdValidation.style.display = 'none';
        elementIdValidation.innerHTML = '';
    }
}

function upgradeToMediumScaleClientSideValidation() {
    let output = 'true';

    if (document.getElementById('companyName').value.length == 0) {
        output = 'empty01';
        document.getElementById('companyNameValidation').innerHTML = 'Company Name is required';
    }
    if (document.getElementById('businessWebsite').value.length == 0) {
        output = 'empty02';
        document.getElementById('businessWebsiteValidation').innerHTML = 'Business Website is required';
    }
    if (document.getElementById('businessEmailAddress').value.length == 0) {
        output = 'empty03';
        document.getElementById('businessEmailAddressValidation').innerHTML = 'Business Email Address is required';
    }
    if (document.getElementById('businessContactNumber').value.length == 0) {
        output = 'empty04';
        document.getElementById('businessContactNumberValidation').innerHTML = 'Business Contact Number is required';
    }
    if (document.getElementById('businessCountryLocation').value.length == 0) {
        output = 'empty05';
        document.getElementById('businessCountryLocationValidation').innerHTML =
            'Business Country Location is required';
    }
    if (document.getElementById('businessStatesLocation').value.length == 0) {
        output = 'empty06';
        document.getElementById('businessStatesLocationValidation').innerHTML = 'Business States Location is required';
    }
    if (document.getElementById('businessCityLocation').value.length == 0) {
        output = 'empty07';
        document.getElementById('businessCityLocationValidation').innerHTML = 'Business City Location is required';
    }
    if (document.getElementById('personalSocialMediaContactType').value.length == 0) {
        output = 'empty08';
        document.getElementById('personalSocialMediaContactTypeValidation').innerHTML = 'Optional but recommended';
    }
    if (document.getElementById('personalSocialMediaContactNumber').value.length == 0) {
        output = 'empty09';
        document.getElementById('personalSocialMediaContactNumberValidation').innerHTML = 'Company Name is required';
    }

    return output;
}
