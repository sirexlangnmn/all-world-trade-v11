let companyBanner;
let companyBannerValidation;
let companyLogo;
let companyLogoPreview;
let companyLogoValidation;

let traderCompanyName;
let traderCompanyNameValidation;
let traderCompanyTagline;
let traderCompanyTaglineValidation;
let traderWebsite;
let traderWebsiteValidation;
let traderBusinessEmailAddress;
let traderBusinessEmailAddressValidation;
let traderBusinessContactNumber;
let traderBusinessContactNumberValidation;
let traderBusinessSocialMediaContactNumber;
let traderBusinessSocialMediaContactNumberValidation;
let traderBusinessAddress;
let traderBusinessAddressValidation;
let traderBusinessCountryLocationValidation;
let traderBusinessCityLocationValidation;
let traderBusinessCityLocationsValidation;
let traderLanguagesOfCommunicationValidation;
let traderTradeCategory;
let traderTradeCategoryValidation;
let traderSubCategoryValidation;
let traderMinorSubCategoryValidation;
let traderTagsValidation;

let traderSurnameOfRepresentative;
let traderSurnameOfRepresentativeValidation;
let traderGivenNameOfRepresentative;
let traderGivenNameOfRepresentativeValidation;
let traderCountryofResidenceValidation;
let traderCityOfResidenceValidation;
let traderCellphone;
let traderCellphoneValidation;
let emailAddress;
let emailAddressValidation;
let traderPasswordValidation;
let traderConfirmPasswordValidation;

companyBanner = getId('companyBanner');
companyBannerValidation = getId('companyBannerValidation');
companyLogo = getId('companyLogo');
companyLogoPreview = getId('companyLogoPreview');
companyLogoValidation = getId('companyLogoValidation');

traderCompanyName = getId('traderCompanyName');
traderCompanyNameValidation = getId('traderCompanyNameValidation');
traderCompanyTagline = getId('traderCompanyTagline');
traderCompanyTaglineValidation = getId('traderCompanyTaglineValidation');
traderWebsite = getId('traderWebsite');
traderWebsiteValidation = getId('traderWebsiteValidation');
traderBusinessEmailAddress = getId('traderBusinessEmailAddress');
traderBusinessEmailAddressValidation = getId('traderBusinessEmailAddressValidation');
traderBusinessContactNumber = getId('traderBusinessContactNumber');
traderBusinessContactNumberValidation = getId('traderBusinessContactNumberValidation');
traderBusinessSocialMediaContactNumber = getId('traderBusinessSocialMediaContactNumber');
traderBusinessSocialMediaContactNumberValidation = getId('traderBusinessSocialMediaContactNumberValidation');
traderBusinessAddress = getId('traderBusinessAddress');
traderBusinessAddressValidation = getId('traderBusinessAddressValidation');
traderBusinessCountryLocationValidation = getId('traderBusinessCountryLocationValidation');
traderBusinessCityLocationValidation = getId('traderBusinessCityLocationValidation');
traderBusinessCityLocationsValidation = getId('traderBusinessCityLocationsValidation');
traderLanguagesOfCommunication = getId('traderLanguagesOfCommunication');
traderLanguagesOfCommunicationValidation = getId('traderLanguagesOfCommunicationValidation');
traderTradeCategory = getId('traderTradeCategory');
traderTradeCategoryValidation = getId('traderTradeCategoryValidation');
traderSubCategoryValidation = getId('traderSubCategoryValidation');
traderMinorSubCategoryValidation = getId('traderMinorSubCategoryValidation');
traderTagsValidation = getId('traderTagsValidation');

traderSurnameOfRepresentative = getId('traderSurnameOfRepresentative');
traderSurnameOfRepresentativeValidation = getId('traderSurnameOfRepresentativeValidation');
traderGivenNameOfRepresentative = getId('traderGivenNameOfRepresentative');
traderGivenNameOfRepresentativeValidation = getId('traderGivenNameOfRepresentativeValidation');
traderCountryofResidenceValidation = getId('traderCountryofResidenceValidation');
traderCityOfResidenceValidation = getId('traderCityOfResidenceValidation');
traderCellphone = getId('traderCellphone');
traderCellphoneValidation = getId('traderCellphoneValidation');
emailAddress = getId('emailAddress');
emailAddressValidation = getId('emailAddressValidation');
traderPasswordValidation = getId('traderPasswordValidation');
traderConfirmPasswordValidation = getId('traderConfirmPasswordValidation');

function tradersRegistrationValidation() {
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
    if (traderCompanyName.value.length == 0) {
        output = 'empty7';
        traderCompanyNameValidation.innerHTML = 'Company Name must not be empty';
    }
    if (traderCompanyTagline.value.length == 0) {
        output = 'empty8';
        traderCompanyTaglineValidation.innerHTML = 'Company tagline must not be empty';
    }
    if (traderWebsite.value.length == 0) {
        output = 'empty9';
        traderWebsiteValidation.innerHTML = 'Company website is required';
    }
    if (traderBusinessEmailAddress.value.length == 0) {
        output = 'empty10';
        traderBusinessEmailAddressValidation.innerHTML = 'Business Email Address is required';
    }
    if (traderBusinessContactNumber.value.length == 0) {
        output = 'empty11';
        traderBusinessContactNumberValidation.innerHTML = 'Business Contact Number is required';
    }
    if (traderBusinessSocialMediaContactNumber.value.length == 0) {
        output = 'empty12';
        traderBusinessSocialMediaContactNumberValidation.innerHTML = 'Social Media Contact Number is required';
    }
    if (traderBusinessAddress.value.length == 0) {
        output = 'empty13';
        traderBusinessAddressValidation.innerHTML = 'Business Address is required';
    }
    if (traderBusinessCountryLocation.value.length == 0) {
        output = 'empty14';
        traderBusinessCountryLocationValidation.innerHTML = 'Business Country Location is required';
    }
    if (traderBusinessCityLocation.value.length == 0) {
        output = 'empty15';
        traderBusinessCityLocationValidation.innerHTML = 'Business State Location is required';
    }
    if (traderBusinessCityLocations.value.length == 0) {
        output = 'empty15';
        traderBusinessCityLocationsValidation.innerHTML = 'Business City Location is required';
    }
    if (traderLanguagesOfCommunication.value.length == 0) {
        output = 'empty19';
        traderLanguagesOfCommunicationValidation.innerHTML = 'Language of communication is required';
    }
    if (traderTradeCategory.value.length == 0) {
        output = 'empty20';
        traderTradeCategoryValidation.innerHTML = 'Trade Category is required';
    }
    if (traderSubCategoryToggleField1.value.length == 0) {
        output = 'empty21';
        traderSubCategoryValidation.innerHTML = 'Sub Category is required';
    }
    // if (traderMinorSubCategoryToggleField1.value.length == 0) {
    //     output = 'empty22';
    //     traderMinorSubCategoryValidation.innerHTML = 'Minor Sub Category is required';
    // }
    if (traderSurnameOfRepresentative.value.length == 0) {
        output = 'empty25';
        traderSurnameOfRepresentativeValidation.innerHTML = 'Surname is required';
    }
    if (traderGivenNameOfRepresentative.value.length == 0) {
        output = 'empty26';
        traderGivenNameOfRepresentativeValidation.innerHTML = 'Given name is required';
    }
    if (traderCountryofResidence.value.length == 0) {
        output = 'empty28';
        traderCountryofResidenceValidation.innerHTML = 'Country of residence is required';
    }
    if (traderCityOfResidence.value.length == 0) {
        output = 'empty29';
        traderCityOfResidenceValidation.innerHTML = 'State of residence is required';
    }
    if (traderCityOfResidences.value.length == 0) {
        output = 'empty29';
        traderCityOfResidencesValidation.innerHTML = 'City of residence is required';
    }
    if (emailAddress.value.length == 0) {
        output = 'empty31';
        emailAddressValidation.innerHTML = 'Email address is required';
    }
    if (traderPassword.value.length == 0) {
        output = 'empty32';
        traderPasswordValidation.innerHTML = 'Password required';
    }
    if (traderConfirmPassword.value.length == 0) {
        output = 'empty33';
        traderConfirmPasswordValidation.innerHTML = 'Confirm Password required';
    }

    return output;
}

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

traderCompanyName.onkeyup = function () {
    required(traderCompanyName, traderCompanyNameValidation, 'Company Name is required');
};

traderCompanyTagline.onkeyup = function () {
    required(traderCompanyTagline, traderCompanyTaglineValidation, 'Company tagline is required');
};

traderWebsite.onkeyup = function () {
    required(traderWebsite, traderWebsiteValidation, 'Company website is required');
};

traderBusinessEmailAddress.onkeyup = function () {
    required(traderBusinessEmailAddress, traderBusinessEmailAddressValidation, 'Business Email Address is required');
};

traderBusinessContactNumber.onkeyup = function () {
    required(traderBusinessContactNumber, traderBusinessContactNumberValidation, 'Business Contact Number is required');
};

traderBusinessSocialMediaContactNumber.onkeyup = function () {
    required(
        traderBusinessSocialMediaContactNumber,
        traderBusinessSocialMediaContactNumberValidation,
        'Social Media Contact Number is required',
    );
};

traderBusinessAddress.onkeyup = function () {
    required(traderBusinessAddress, traderBusinessAddressValidation, 'Business Address is required');
};

traderBusinessCountryLocation.onchange = function () {
    required(
        traderBusinessCountryLocation,
        traderBusinessCountryLocationValidation,
        'Business Country Location is required',
    );

    setTimeout(function () {
        required(
            traderBusinessCityLocation,
            traderBusinessCityLocationValidation,
            'Business States Location is required',
        );
        required(
            traderBusinessCityLocations,
            traderBusinessCityLocationsValidation,
            'Business City Location is required',
        );
    }, 3 * 1000);
};

traderBusinessCityLocation.onchange = function () {
    required(traderBusinessCityLocation, traderBusinessCityLocationValidation, 'Business City Location is required');

    setTimeout(function () {
        required(
            traderBusinessCityLocations,
            traderBusinessCityLocationsValidation,
            'Business City Location is required',
        );
    }, 3 * 1000);
};

traderBusinessCityLocations.onchange = function () {
    required(traderBusinessCityLocations, traderBusinessCityLocationsValidation, 'Business City Location is required');
};

traderLanguagesOfCommunication.onchange = function () {
    required(
        traderLanguagesOfCommunication,
        traderLanguagesOfCommunicationValidation,
        'Language of communication is required',
    );
};

traderTradeCategory.onchange = function () {
    required(traderTradeCategory, traderTradeCategoryValidation, 'Trade category is required');
};

traderSubCategoryToggleField1.onchange = function () {
    required(traderSubCategoryToggleField1, traderSubCategoryValidation, 'Sub category is required');
};

// traderMinorSubCategoryToggleField1.onchange = function () {
//     required(traderMinorSubCategoryToggleField1, traderMinorSubCategoryValidation, 'Minor Sub Category is required');
// };

traderSurnameOfRepresentative.onkeyup = function () {
    required(traderSurnameOfRepresentative, traderSurnameOfRepresentativeValidation, 'Surname is required');
};

traderGivenNameOfRepresentative.onkeyup = function () {
    required(traderGivenNameOfRepresentative, traderGivenNameOfRepresentativeValidation, 'Given Name is required');
};

traderCountryofResidence.onchange = function () {
    required(traderCountryofResidence, traderCountryofResidenceValidation, 'Country of residence is required');

    setTimeout(function () {
        required(traderCityOfResidence, traderCityOfResidenceValidation, 'State of residence is required');
        required(traderCityOfResidences, traderCityOfResidencesValidation, 'City of residence is required');
    }, 3 * 1000);
};

traderCityOfResidence.onchange = function () {
    required(traderCityOfResidence, traderCityOfResidenceValidation, 'State of residence is required');

    setTimeout(function () {
        required(traderCityOfResidences, traderCityOfResidencesValidation, 'City of residence is required');
    }, 3 * 1000);
};

traderCityOfResidences.onchange = function () {
    required(traderCityOfResidences, traderCityOfResidencesValidation, 'City of residence is required');
};

emailAddress.onchange = function () {
    required(emailAddress, emailAddressValidation, 'Email Address is required');
};

traderConfirmPassword.onkeyup = function () {
    required(traderConfirmPassword, traderConfirmPasswordValidation, 'Confirm Password is required');
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

function required2(elementIdValidation, message) {
    if (message.length != 0) {
        elementIdValidation.style.display = 'block';
        elementIdValidation.innerHTML = message[0].msg;
    } else {
        elementIdValidation.style.display = 'none';
        elementIdValidation.innerHTML = '';
    }
}

function tradersRegistrationServerValidation(message) {
    let filteredTraderCompanyName = message.filter((d) => d.param == 'traderCompanyName');
    if (filteredTraderCompanyName) {
        required2(traderCompanyNameValidation, filteredTraderCompanyName);
    }

    let filteredTraderWebsite = message.filter((d) => d.param == 'traderWebsite');
    if (filteredTraderWebsite) {
        required2(traderWebsiteValidation, filteredTraderWebsite);
    }

    let filteredTraderBusinessEmailAddress = message.filter((d) => d.param == 'traderBusinessEmailAddress');
    if (filteredTraderBusinessEmailAddress) {
        required2(traderBusinessEmailAddressValidation, filteredTraderBusinessEmailAddress);
    }

    let filteredTraderBusinessContactNumber = message.filter((d) => d.param == 'traderBusinessContactNumber');
    if (filteredTraderBusinessContactNumber) {
        required2(traderBusinessContactNumberValidation, filteredTraderBusinessContactNumber);
    }

    let filteredTraderBusinessSocialMediaContactNumber = message.filter(
        (d) => d.param == 'traderBusinessSocialMediaContactNumber',
    );
    if (filteredTraderBusinessSocialMediaContactNumber) {
        required2(traderBusinessSocialMediaContactNumberValidation, filteredTraderBusinessSocialMediaContactNumber);
    }

    let filteredTraderSurnameOfRepresentative = message.filter((d) => d.param == 'traderSurnameOfRepresentative');
    if (filteredTraderSurnameOfRepresentative) {
        required2(traderSurnameOfRepresentativeValidation, filteredTraderSurnameOfRepresentative);
    }

    let filteredTraderGivenNameOfRepresentative = message.filter((d) => d.param == 'traderGivenNameOfRepresentative');
    if (filteredTraderGivenNameOfRepresentative) {
        required2(traderGivenNameOfRepresentativeValidation, filteredTraderGivenNameOfRepresentative);
    }

    let filteredTraderEmailAddress = message.filter((d) => d.param == 'emailAddress');
    if (filteredTraderEmailAddress) {
        required2(emailAddressValidation, filteredTraderEmailAddress);
    }

    let filteredcompanyBanner = message.filter((d) => d.param == 'companyBanner');
    if (filteredcompanyBanner) {
        required2(companyBannerValidation, filteredcompanyBanner);
    }

    let filteredcompanyLogo = message.filter((d) => d.param == 'companyLogo');
    if (filteredcompanyLogo) {
        required2(companyLogoValidation, filteredcompanyLogo);
    }

    // let filteredT = message.filter((d) => d.param == 'trader');
    // if (filteredT) {
    //     required2(Validation, filteredT);
    // }
}

function displayServerValidation(message) {
    let traderCompanyNameFiltered = message.filter((d) => d.param == 'traderCompanyName');
    let traderWebsiteFiltered = message.filter((d) => d.param == 'traderWebsite');
    let traderBusinessEmailAddressFiltered = message.filter((d) => d.param == 'traderBusinessEmailAddress');
    let traderBusinessContactNumberFiltered = message.filter((d) => d.param == 'traderBusinessContactNumber');
    let traderBusinessSocialMediaContactNumberFiltered = message.filter(
        (d) => d.param == 'traderBusinessSocialMediaContactNumber',
    );
    let traderBusinessAddressFiltered = message.filter((d) => d.param == 'traderBusinessAddress');
    let traderBusinessCountryLocationFiltered = message.filter((d) => d.param == 'traderBusinessCountryLocation');
    let traderBusinessCityLocationFiltered = message.filter((d) => d.param == 'traderBusinessCityLocation');
    let traderBusinessCityLocationsFiltered = message.filter((d) => d.param == 'traderBusinessCityLocations');
    let traderLanguagesOfCommunicationFiltered = message.filter((d) => d.param == 'traderLanguagesOfCommunication');
    let traderTradeCategoryFiltered = message.filter((d) => d.param == 'traderTradeCategory');
    let traderSubCategoryFiltered = message.filter((d) => d.param == 'traderSubCategoryToggleField');

    let traderGivenNameOfRepresentativeFiltered = message.filter((d) => d.param == 'traderGivenNameOfRepresentative');
    let traderSurnameOfRepresentativeFiltered = message.filter((d) => d.param == 'traderSurnameOfRepresentative');
    let traderCountryofResidenceFiltered = message.filter((d) => d.param == 'traderCountryofResidence');
    let traderCityOfResidenceFiltered = message.filter((d) => d.param == 'traderCityOfResidence');
    let traderCityOfResidencesFiltered = message.filter((d) => d.param == 'traderCityOfResidences');
    let emailAddressFiltered = message.filter((d) => d.param == 'emailAddress');
    let traderPasswordFiltered = message.filter((d) => d.param == 'traderPassword');
    let traderConfirmPasswordFiltered = message.filter((d) => d.param == 'traderConfirmPassword');

    if (traderCompanyNameFiltered) {
        displayServerValidationToggle(traderCompanyNameValidation, traderCompanyNameFiltered);
    }
    if (traderWebsiteFiltered) {
        displayServerValidationToggle(traderWebsiteValidation, traderWebsiteFiltered);
    }
    if (traderBusinessEmailAddressFiltered) {
        displayServerValidationToggle(traderBusinessEmailAddressValidation, traderBusinessEmailAddressFiltered);
    }
    if (traderBusinessContactNumberFiltered) {
        displayServerValidationToggle(traderBusinessContactNumberValidation, traderBusinessContactNumberFiltered);
    }
    if (traderBusinessSocialMediaContactNumberFiltered) {
        displayServerValidationToggle(
            traderBusinessSocialMediaContactNumberValidation,
            traderBusinessSocialMediaContactNumberFiltered,
        );
    }
    if (traderBusinessAddressFiltered) {
        displayServerValidationToggle(traderBusinessAddressValidation, traderBusinessAddressFiltered);
    }
    if (traderBusinessCountryLocationFiltered) {
        displayServerValidationToggle(traderBusinessCountryLocationValidation, traderBusinessCountryLocationFiltered);
    }
    if (traderBusinessCityLocationFiltered) {
        displayServerValidationToggle(traderBusinessCityLocationValidation, traderBusinessCityLocationFiltered);
    }
    if (traderBusinessCityLocationsFiltered) {
        displayServerValidationToggle(traderBusinessCityLocationsValidation, traderBusinessCityLocationsFiltered);
    }
    if (traderLanguagesOfCommunicationFiltered) {
        displayServerValidationToggle(traderLanguagesOfCommunicationValidation, traderLanguagesOfCommunicationFiltered);
    }
    if (traderTradeCategoryFiltered) {
        displayServerValidationToggle(traderTradeCategoryValidation, traderTradeCategoryFiltered);
    }
    if (traderSubCategoryFiltered) {
        displayServerValidationToggle(traderSubCategoryValidation, traderSubCategoryFiltered);
    }

    if (traderGivenNameOfRepresentativeFiltered) {
        displayServerValidationToggle(
            traderGivenNameOfRepresentativeValidation,
            traderGivenNameOfRepresentativeFiltered,
        );
    }
    if (traderSurnameOfRepresentativeFiltered) {
        displayServerValidationToggle(traderSurnameOfRepresentativeValidation, traderSurnameOfRepresentativeFiltered);
    }
    if (traderCountryofResidenceFiltered) {
        displayServerValidationToggle(traderCountryofResidenceValidation, traderCountryofResidenceFiltered);
    }
    if (traderCityOfResidenceFiltered) {
        displayServerValidationToggle(traderCityOfResidenceValidation, traderCityOfResidenceFiltered);
    }
    if (traderCityOfResidencesFiltered) {
        displayServerValidationToggle(traderCityOfResidencesValidation, traderCityOfResidencesFiltered);
    }
    if (emailAddressFiltered) {
        displayServerValidationToggle(emailAddressValidation, emailAddressFiltered);
    }
    if (traderPasswordFiltered) {
        displayServerValidationToggle(traderPasswordValidation, traderPasswordFiltered);
    }
    if (traderConfirmPasswordFiltered) {
        displayServerValidationToggle(traderConfirmPasswordValidation, traderConfirmPasswordFiltered);
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
