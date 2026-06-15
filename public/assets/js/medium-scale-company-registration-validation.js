let companyLogo;
let companyLogoValidation;
let companyLogoPreview;
let companyBanner;
let companyBannerValidation;
let companyBannerPreview;

let companyName;
let businessWebsite;
let businessEmailAddress;
let businessContactNumber;
let businessSocialMediaContactNumber;
let languagesOfCommunication;

let companyNameValidation;
let businessWebsiteValidation;
let businessEmailAddressValidation;
let businessContactNumberValidation;
let businessSocialMediaContactNumberValidation;
let businessCountryLocationValidation;
let businessStatesLocationValidation;
let businessCityLocationValidation;
let languagesOfCommunicationValidation;

let firstName;
let firstNameValidation;
let lastName;
let lastNameValidation;
let middleName;
let middleNameValidation;
let countryValidation;
let statesValidation;
let cityValidation;

let language;
let languageValidation;
let emailAddress;
let emailAddressValidation;
let passwordValidation;
let confirmPasswordValidation;

companyLogo = getId('companyLogo');
companyLogoValidation = getId('companyLogoValidation');
companyLogoPreview = getId('companyLogoPreview');
companyBanner = getId('companyBanner');
companyBannerValidation = getId('companyBannerValidation');
companyBannerPreview = getId('companyBannerPreview');

companyName = getId('companyName');
businessWebsite = getId('businessWebsite');
businessEmailAddress = getId('businessEmailAddress');
businessContactNumber = getId('businessContactNumber');
businessSocialMediaContactNumber = getId('businessSocialMediaContactNumber');
businessCountryLocation = getId('businessCountryLocation');
businessStatesLocation = getId('businessStatesLocation');
businessCityLocation = getId('businessCityLocation');
languagesOfCommunication = getId('languagesOfCommunication');

companyNameValidation = getId('companyNameValidation');
businessWebsiteValidation = getId('businessWebsiteValidation');
businessEmailAddressValidation = getId('businessEmailAddressValidation');
businessContactNumberValidation = getId('businessContactNumberValidation');
businessSocialMediaContactNumberValidation = getId('businessSocialMediaContactNumberValidation');
businessCountryLocationValidation = getId('businessCountryLocationValidation');
businessStatesLocationValidation = getId('businessStatesLocationValidation');
businessCityLocationValidation = getId('businessCityLocationValidation');
languagesOfCommunicationValidation = getId('languagesOfCommunicationValidation');

firstName = getId('firstName');
firstNameValidation = getId('firstNameValidation');
lastName = getId('lastName');
lastNameValidation = getId('lastNameValidation');
middleName = getId('middleName');
middleNameValidation = getId('middleNameValidation');
countryValidation = getId('countryValidation');
statesValidation = getId('statesValidation');
cityValidation = getId('cityValidation');

language = getId('language');
languageValidation = getId('languageValidation');
emailAddress = getId('emailAddress');
emailAddressValidation = getId('emailAddressValidation');
passwordValidation = getId('passwordValidation');
confirmPasswordValidation = getId('confirmPasswordValidation');

companyLogo.onchange = (evt) => {
    const [file] = companyLogo.files;
    if (file) {
        companyLogoValidation.style.display = 'none';
        companyLogoValidation.innerHTML = '';
        companyLogoPreview.src = URL.createObjectURL(file);
    }
    uploadCompanyMediaValidation('companyLogo', companyLogoValidation);
};

companyBanner.onchange = (evt) => {
    const [file] = companyBanner.files;
    if (file) {
        companyBannerValidation.style.display = 'none';
        companyBannerValidation.innerHTML = '';
        companyBannerPreview.src = URL.createObjectURL(file);
    }
    uploadCompanyMediaValidation('companyBanner', companyBannerValidation);
};

function registrationValidation() {
    let output = 'true';
    // if (companyBanner.files.length == 0) {
    //     output = 'empty1';
    //     companyBannerValidation.style.display = 'block';
    //     companyBannerValidation.innerHTML = 'Please upload banner';
    //     companyBannerPreview.src = host + '/uploads/placeholder/banner-placeholder.png';
    // }
    // if (companyLogo.files.length == 0) {
    //     output = 'empty2';
    //     companyLogoPreview.src = host + '/uploads/placeholder/logo-placeholder.jpg';
    //     companyLogoValidation.innerHTML = 'Upload logo';
    // }

    if (companyName.value.length == 0) {
        output = 'empty3';
        companyNameValidation.innerHTML = 'Company Name is required';
    }
    if (businessWebsite.value.length == 0) {
        output = 'empty3';
        businessWebsiteValidation.innerHTML = 'Business Website is required';
    }
    if (businessEmailAddress.value.length == 0) {
        output = 'empty3';
        businessEmailAddressValidation.innerHTML = 'Business Email Address is required';
    }
    if (businessContactNumber.value.length == 0) {
        output = 'empty3';
        businessContactNumberValidation.innerHTML = 'Business Contact Number is required';
    }
    if (businessSocialMediaContactNumber.value.length == 0) {
        output = 'empty3';
        businessSocialMediaContactNumberValidation.innerHTML = 'Messaging App Contact Number is required';
    }
    if (businessCountryLocation.value.length == 0) {
        output = 'empty3';
        businessCountryLocationValidation.innerHTML = 'Business Country Location is required';
    }
    if (businessStatesLocation.value.length == 0) {
        output = 'empty3';
        businessStatesLocationValidation.innerHTML = 'Business States Location is required';
    }
    if (businessCityLocation.value.length == 0) {
        output = 'empty3';
        businessCityLocationValidation.innerHTML = 'Business City Location is required';
    }

    if (firstName.value.length == 0) {
        output = 'empty3';
        firstNameValidation.innerHTML = 'Firstname is required';
    }
    if (lastName.value.length == 0) {
        output = 'empty4';
        lastNameValidation.innerHTML = 'Lastname is required';
    }
    if (country.value.length == 0) {
        output = 'empty6';
        countryValidation.innerHTML = 'Country is required';
    }
    if (states.value.length == 0) {
        output = 'empty7';
        statesValidation.innerHTML = 'States is required';
    }
    if (city.value.length == 0) {
        output = 'empty8';
        cityValidation.innerHTML = 'City is required';
    }
    if (language.value.length == 0) {
        output = 'empty9';
        languageValidation.innerHTML = 'Language is required';
    }
    if (emailAddress.value.length == 0) {
        output = 'empty10';
        emailAddressValidation.innerHTML = 'Email Address is required';
    }
    if (password.value.length == 0) {
        output = 'empty12';
        passwordValidation.innerHTML = 'Password is required';
    }
    if (confirmPassword.value.length == 0) {
        output = 'empty13';
        confirmPasswordValidation.innerHTML = 'Confirm Password is required';
    }

    return output;
}

companyName.onkeyup = function () {
    required(companyName, companyNameValidation, 'Company Name');
};
businessWebsite.onkeyup = function () {
    required(businessWebsite, businessWebsiteValidation, 'Business Website');
};
businessEmailAddress.onkeyup = function () {
    required(businessEmailAddress, businessEmailAddressValidation, 'Business Email Address');
};
businessContactNumber.onkeyup = function () {
    required(businessContactNumber, businessContactNumberValidation, 'Business Contact Number');
};
businessSocialMediaContactNumber.onkeyup = function () {
    required(
        businessSocialMediaContactNumber,
        businessSocialMediaContactNumberValidation,
        'Messaging App Contact Number',
    );
};
businessCountryLocation.onchange = function () {
    required(businessCountryLocation, businessCountryLocationValidation, 'Business Country Location');

    setTimeout(function () {
        required(businessStatesLocation, businessStatesLocationValidation, 'Business States Location');
        required(businessCityLocation, businessCityLocationValidation, 'Business City Location');
    }, 3 * 1000);
};
businessStatesLocation.onchange = function () {
    required(businessStatesLocation, businessStatesLocationValidation, 'Business States Location');

    setTimeout(function () {
        required(businessCityLocation, businessCityLocationValidation, 'Business City Location');
    }, 3 * 1000);
};
businessCityLocation.onchange = function () {
    required(businessCityLocation, businessCityLocationValidation, 'Business City Location');
};

firstName.onkeyup = function () {
    required(firstName, firstNameValidation, 'Firstname');
};
lastName.onkeyup = function () {
    required(lastName, lastNameValidation, 'Lastname');
};
middleName.onkeyup = function () {
    required(middleName, middleNameValidation, 'Middlename');
};
country.onchange = function () {
    required(country, countryValidation, 'Country');

    setTimeout(function () {
        required(states, statesValidation, 'States');
        required(city, cityValidation, 'City');
    }, 3 * 1000);
};
states.onchange = function () {
    required(states, statesValidation, 'States');

    setTimeout(function () {
        required(city, cityValidation, 'City');
    }, 3 * 1000);
};
city.onchange = function () {
    required(city, cityValidation, 'City');
};
language.onchange = function () {
    required(language, languageValidation, 'Language');
};
emailAddress.onkeyup = function () {
    required(emailAddress, emailAddressValidation, 'Email Address');
};

confirmPassword.onkeyup = function () {
    required(confirmPassword, confirmPasswordValidation, 'Confirm Password');
};

function required(elementIdInput, elementIdValidation, message) {
    if (elementIdInput.value.length == 0) {
        elementIdValidation.style.display = 'block';
        elementIdValidation.innerHTML = message + ' is required';
    } else {
        elementIdValidation.style.display = 'none';
        elementIdValidation.innerHTML = '';
    }
}

function displayServerValidation(message) {
    let filteredCompanyName = message.filter((d) => d.param == 'companyName');
    let filteredBusinessWebsite = message.filter((d) => d.param == 'businessWebsite');
    let filteredBusinessEmailAddress = message.filter((d) => d.param == 'businessEmailAddress');
    let filteredBusinessContactNumber = message.filter((d) => d.param == 'businessContactNumber');
    let filteredBusinessSocialMediaContactNumber = message.filter((d) => d.param == 'businessSocialMediaContactNumber');
    let filteredBusinessCountryLocation = message.filter((d) => d.param == 'businessCountryLocation');
    let filteredBusinessStatesLocation = message.filter((d) => d.param == 'businessStatesLocation');
    let filteredBusinessCityLocation = message.filter((d) => d.param == 'businessCityLocation');

    let filteredFirstName = message.filter((d) => d.param == 'firstName');
    let filteredLastName = message.filter((d) => d.param == 'lastName');
    let filteredCountry = message.filter((d) => d.param == 'country');
    let filteredStates = message.filter((d) => d.param == 'states');
    let filteredCity = message.filter((d) => d.param == 'city');
    let filteredLanguage = message.filter((d) => d.param == 'language');
    let filteredEmailAddress = message.filter((d) => d.param == 'emailAddress');
    let filteredPersonalSocialMediaContactNumber = message.filter((d) => d.param == 'personalSocialMediaContactNumber');
    let filteredpassword = message.filter((d) => d.param == 'password');
    let filteredConfirmPassword = message.filter((d) => d.param == 'confirmPassword');

    if (filteredCompanyName) {
        displayServerValidationToggle(companyNameValidation, filteredCompanyName);
    }
    if (filteredBusinessWebsite) {
        displayServerValidationToggle(businessWebsiteValidation, filteredBusinessWebsite);
    }
    if (filteredBusinessEmailAddress) {
        displayServerValidationToggle(businessEmailAddressValidation, filteredBusinessEmailAddress);
    }
    if (filteredBusinessContactNumber) {
        displayServerValidationToggle(businessContactNumberValidation, filteredBusinessContactNumber);
    }
    if (filteredBusinessSocialMediaContactNumber) {
        displayServerValidationToggle(
            businessSocialMediaContactNumberValidation,
            filteredBusinessSocialMediaContactNumber,
        );
    }
    if (filteredBusinessCountryLocation) {
        displayServerValidationToggle(businessCountryLocationValidation, filteredBusinessCountryLocation);
    }
    if (filteredBusinessStatesLocation) {
        displayServerValidationToggle(businessStatesLocationValidation, filteredBusinessStatesLocation);
    }
    if (filteredBusinessCityLocation) {
        displayServerValidationToggle(businessCityLocationValidation, filteredBusinessCityLocation);
    }

    if (filteredFirstName) {
        displayServerValidationToggle(firstNameValidation, filteredFirstName);
    }
    if (filteredLastName) {
        displayServerValidationToggle(lastNameValidation, filteredLastName);
    }
    if (filteredCountry) {
        displayServerValidationToggle(countryValidation, filteredCountry);
    }
    if (filteredStates) {
        displayServerValidationToggle(statesValidation, filteredStates);
    }
    if (filteredCity) {
        displayServerValidationToggle(cityValidation, filteredCity);
    }
    if (filteredLanguage) {
        displayServerValidationToggle(languageValidation, filteredLanguage);
    }
    if (filteredEmailAddress) {
        displayServerValidationToggle(emailAddressValidation, filteredEmailAddress);
    }
    if (filteredPersonalSocialMediaContactNumber) {
        displayServerValidationToggle(
            personalSocialMediaContactNumberValidation,
            filteredPersonalSocialMediaContactNumber,
        );
    }
    if (filteredpassword) {
        displayServerValidationToggle(passwordValidation, filteredpassword);
    }
    if (filteredConfirmPassword) {
        displayServerValidationToggle(confirmPasswordValidation, filteredConfirmPassword);
    }
}

function displayServerValidationToggle(elementIdValidation, message) {
    if (message.length != 0) {
        elementIdValidation.style.display = 'block';
        elementIdValidation.innerHTML = message[0].msg;
    } else {
        elementIdValidation.style.display = 'none';
        elementIdValidation.innerHTML = '';
    }
}
