let taglineValidation;
let websiteValidation;
let businessEmailAddressValidation;
let businessContactNumberValidation;
let businessSocialMediaContactNumberValidation;
let businessAddressValidation;
let editBusinessCountryLocationValidation;
let editBusinessStatesLocationValidation;
let editBusinessCityLocationValidation;
let startOperatingHourValidation;
let endOperatingHourValidation;
let editLanguagesOfCommunicationValidation;
let editTradeCategoryValidation;
// let traderSubCategoryValidation;

taglineValidation = getId('taglineValidation');
websiteValidation = getId('websiteValidation');
businessEmailAddressValidation = getId('businessEmailAddressValidation');
businessContactNumberValidation = getId('businessContactNumberValidation');
businessSocialMediaContactNumberValidation = getId('businessSocialMediaContactNumberValidation');
businessAddressValidation = getId('businessAddressValidation');
editBusinessCountryLocationValidation = getId('editBusinessCountryLocationValidation');
editBusinessStatesLocationValidation = getId('editBusinessStatesLocationValidation');
editBusinessCityLocationValidation = getId('editBusinessCityLocationValidation');
startOperatingHourValidation = getId('startOperatingHourValidation');
endOperatingHourValidation = getId('endOperatingHourValidation');
editLanguagesOfCommunicationValidation = getId('editLanguagesOfCommunicationValidation');
editTradeCategoryValidation = getId('editTradeCategoryValidation');
// traderSubCategoryValidation = getId('traderSubCategoryValidation');

function updateTradersProfileValidation() {
    let output = 'true';

    if (tagline.value.length == 0) {
        output = 'empty tagline';
        taglineValidation.innerHTML = 'Tagline is required';
    }

    if (website.value.length == 0) {
        output = 'empty company website';
        websiteValidation.innerHTML = 'Website is required';
    }

    if (businessEmailAddress.value.length == 0) {
        output = 'empty business Email Address';
        businessEmailAddressValidation.innerHTML = 'Business Email Address is required';
    }

    if (businessContactNumber.value.length == 0) {
        output = 'empty Business Contact Number';
        businessContactNumberValidation.innerHTML = 'Business Contact Number is required';
    }

    if (businessSocialMediaContactNumber.value.length == 0) {
        output = 'empty Business Social Media Contact Number';
        businessSocialMediaContactNumberValidation.innerHTML = 'Business Social Media Contact Number is required';
    }

    if (businessAddress.value.length == 0) {
        output = 'empty Business Address';
        businessAddressValidation.innerHTML = 'Business Address is required';
    }

    if (editBusinessCountryLocation.value.length == 0) {
        output = 'empty Business Country Location';
        editBusinessCountryLocationValidation.innerHTML = 'Business Country Location is required';
    }

    if (editBusinessStatesLocation.value.length == 0) {
        output = 'empty Business States Location';
        editBusinessStatesLocationValidation.innerHTML = 'Business States Location is required';
    }

    if (editBusinessCityLocation.value.length == 0) {
        output = 'empty Business City Location';
        editBusinessCityLocationValidation.innerHTML = 'Business City Location is required';
    }

    if (document.getElementById('startOperatingHour').value == '') {
        output = 'empty Start Operating Hour';
        startOperatingHourValidation.innerHTML = 'Start Operating Hour is required';
    }

    if (document.getElementById('endOperatingHour').value == '') {
        output = 'empty End Operating Hour';
        endOperatingHourValidation.innerHTML = 'End Operating Hour is required';
    }

    if (editLanguagesOfCommunication.value.length == 0) {
        output = 'empty Languages Of Communication';
        editLanguagesOfCommunicationValidation.innerHTML = 'Languages Of Communication is required';
    }

    if (editTradeCategory.value.length == 0) {
        output = 'empty Trade Category';
        editTradeCategoryValidation.innerHTML = 'Trade Category is required';
    }

    // if (traderSubCategoryToggleField1.value.length == 0 && traderSubCategoryToggleField2.value.length == 0) {
    //     output = 'empty Sub Category';
    //     traderSubCategoryValidation.innerHTML = 'Sub Category is required';
    // }

    const iOperateOnAWorldWide = document.querySelector('#iOperateOnAWorldWideLevelRadioButton');
    if (iOperateOnAWorldWide.checked) {
        document.getElementById('traderRegionOfOperationValidation').innerHTML = '';
        document.getElementById('traderCountryOfOperationValidation').innerHTML = '';
        document.getElementById('traderStatesOfOperationValidation').innerHTML = '';
    }

    const iOperateOnAGlobalRegional = document.querySelector('#iOperateOnAGlobalRegionalLevelRadioButton');
    if (iOperateOnAGlobalRegional.checked) {
        if (document.getElementById('traderRegionOfOperation').value.length == 0) {
            output = 'empty region of operation';
            document.getElementById('traderRegionOfOperationValidation').innerHTML = 'Region of Operation is required';
        }
    } else {
        document.getElementById('traderRegionOfOperationValidation').innerHTML = '';
    }

    const iOperateOnANational = document.querySelector('#iOperateOnANationalLevelRadioButton');
    if (iOperateOnANational.checked) {
        if (document.getElementById('traderCountryOfOperation').value.length == 0) {
            output = 'empty country of operation';
            document.getElementById('traderCountryOfOperationValidation').innerHTML =
                'Country of Operation is required';
        }
    } else {
        document.getElementById('traderCountryOfOperationValidation').innerHTML = '';
    }

    const iOperateOnAState = document.querySelector('#iOperateOnAStateLevelRadioButton');
    if (iOperateOnAState.checked) {
        if (document.getElementById('traderStatesOfOperation').value.length == 0) {
            output = 'empty state of operation';
            document.getElementById('traderStatesOfOperationValidation').innerHTML = 'State of Operation is required';
        }
    } else {
        document.getElementById('traderStatesOfOperationValidation').innerHTML = '';
    }

    return output;
}

tagline.onkeyup = function () {
    required(tagline, taglineValidation, 'Tagline is required');
};

website.onkeyup = function () {
    required(website, websiteValidation, 'Website is required');
};

businessEmailAddress.onkeyup = function () {
    required(businessEmailAddress, businessEmailAddressValidation, 'Business Email Address is required');
};

businessContactNumber.onkeyup = function () {
    required(businessContactNumber, businessContactNumberValidation, 'Business Contact Number is required');
};

businessSocialMediaContactNumber.onkeyup = function () {
    required(
        businessSocialMediaContactNumber,
        businessSocialMediaContactNumberValidation,
        'Business Social Media Contact Number is required',
    );
};

businessAddress.onkeyup = function () {
    required(businessAddress, businessAddressValidation, 'Business Address is required');
};

// startOperatingHour.onchange = function () {
//     required(startOperatingHour, startOperatingHourValidation, 'Start Operating Hour is required');
// };

// document.getElementById('startOperatingHour').addEventListener('change', function () {
//     required(startOperatingHour, startOperatingHourValidation, 'Start Operating Hour is required');
// });

// endOperatingHour.onchange = function () {
//     required(endOperatingHour, endOperatingHourValidation, 'End Operating Hour is required');
// };

// document.getElementById('endOperatingHour').addEventListener('change', function () {
//     required(endOperatingHour, endOperatingHourValidation, 'End Operating Hour is required');
// });

editLanguagesOfCommunication.onchange = function () {
    required(
        editLanguagesOfCommunication,
        editLanguagesOfCommunicationValidation,
        'Languages Of Communication is required',
    );
};

// traderSubCategoryToggleField1.onchange = function () {
//     required(traderSubCategoryToggleField1, traderSubCategoryValidation, 'Sub Category is required');
// };

// traderSubCategoryToggleField2.onkeyup = function () {
//     required(traderSubCategoryToggleField2, traderSubCategoryValidation, 'Sub Category is required');
// };

document.getElementById('traderRegionOfOperation').onchange = function () {
    required(traderRegionOfOperation, traderRegionOfOperationValidation, 'Region of operation is required');
};

document.getElementById('traderCountryOfOperation').onchange = function () {
    required(traderCountryOfOperation, traderCountryOfOperationValidation, 'Country of operation is required');
};

document.getElementById('traderStatesOfOperation').onchange = function () {
    required(traderStatesOfOperation, traderStatesOfOperationValidation, 'State of operation is required');
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
