let companyLogo;
let companyLogoValidation;
let companyLogoPreview;
let companyBanner;
let companyBannerValidation;
let companyBannerPreview;

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
let socialMediaContactNumber;
let socialMediaContactNumberValidation;
let passwordValidation;
let confirmPasswordValidation;

companyLogo = getId('companyLogo');
companyLogoValidation = getId('companyLogoValidation');
companyLogoPreview = getId('companyLogoPreview');
companyBanner = getId('companyBanner');
companyBannerValidation = getId('companyBannerValidation');
companyBannerPreview = getId('companyBannerPreview');

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
socialMediaContactNumber = getId('socialMediaContactNumber');
socialMediaContactNumberValidation = getId('socialMediaContactNumberValidation');
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

function registrationClientValidation() {
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
        output = 'empty States';
        statesValidation.innerHTML = 'States is required';
    }
    if (city.value.length == 0) {
        output = 'empty City';
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
    if (socialMediaContactNumber.value.length == 0) {
        output = 'empty11';
        socialMediaContactNumberValidation.innerHTML = 'Social Media Contact Number is required';
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

firstName.onkeyup = function () {
    required(firstName, firstNameValidation, 'Firstname');
};
lastName.onkeyup = function () {
    required(lastName, lastNameValidation, 'Lastname');
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
socialMediaContactNumber.onkeyup = function () {
    required(socialMediaContactNumber, socialMediaContactNumberValidation, 'Social Media Contact Number');
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
    let filteredFirstName = message.filter((d) => d.param == 'firstName');
    let filteredLastName = message.filter((d) => d.param == 'lastName');
    let filteredCountry = message.filter((d) => d.param == 'country');
    let filteredStates = message.filter((d) => d.param == 'states');
    let filteredCity = message.filter((d) => d.param == 'city');
    let filteredLanguage = message.filter((d) => d.param == 'language');
    let filteredEmailAddress = message.filter((d) => d.param == 'emailAddress');
    let filteredsocialMediaContactNumber = message.filter((d) => d.param == 'socialMediaContactNumber');
    let filteredpassword = message.filter((d) => d.param == 'password');
    let filteredConfirmPassword = message.filter((d) => d.param == 'confirmPassword');

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
    if (filteredsocialMediaContactNumber) {
        displayServerValidationToggle(socialMediaContactNumberValidation, filteredsocialMediaContactNumber);
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
