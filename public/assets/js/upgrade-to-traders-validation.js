document.getElementById('traderCompanyName').onkeyup = function () {
    required('traderCompanyName', 'traderCompanyNameValidation', 'Company Name is required');
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
document.getElementById('editBusinessCountryLocation').onchange = function () {
    required(
        'editBusinessCountryLocation',
        'editBusinessCountryLocationValidation',
        'Business Country Location is required',
    );

    setInterval(function () {
        required(
            'editBusinessStatesLocation',
            'editBusinessStatesLocationValidation',
            'Business States Location is required',
        );
        required(
            'editBusinessCityLocation',
            'editBusinessCityLocationValidation',
            'Business City Location is required',
        );
    }, 1000);
};
document.getElementById('editBusinessStatesLocation').onchange = function () {
    required(
        'editBusinessStatesLocation',
        'editBusinessStatesLocationValidation',
        'Business States Location is required',
    );
};

document.getElementById('editTradeCategory').onchange = function () {
    required('editTradeCategory', 'editTradeCategoryValidation', 'Trade Category is required');
};
document.getElementById('traderSubCategoryToggleField1').onchange = function () {
    required('traderSubCategoryToggleField1', 'traderSubCategoryValidation', 'Trade Sub Category is required');
};
document.getElementById('traderSubCategoryToggleField2').onkeyup = function () {
    required('traderSubCategoryToggleField2', 'traderSubCategoryValidation', 'Trade Sub Category is required');
};
document.getElementById('editBusinessScale').onchange = function () {
    required('editBusinessScale', 'editBusinessScaleValidation', 'Business Scale is required');
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

function upgradeToTradersClientSideValidation() {
    let output = 'true';

    if (document.getElementById('traderCompanyName').value.length == 0) {
        output = 'empty_companyName';
        document.getElementById('traderCompanyNameValidation').innerHTML = 'Company Name is required';
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

    if (document.getElementById('startOperatingHour').value.length == 0) {
        output = 'empty_startOperatingHoure';
        document.getElementById('startOperatingHourValidation').innerHTML = 'Start of Operating Hour is required1';
    } else {
        document.getElementById('startOperatingHourValidation').innerHTML = '';
    }

    if (document.getElementById('endOperatingHour').value.length == 0) {
        output = 'empty_endOperatingHour';
        document.getElementById('endOperatingHourValidation').innerHTML = 'End of Operating Hour is required1';
    } else {
        document.getElementById('endOperatingHourValidation').innerHTML = '';
    }

    if (document.getElementById('editBusinessCountryLocation').value.length == 0) {
        output = 'empty_editBusinessCountryLocation';
        document.getElementById('editBusinessCountryLocationValidation').innerHTML =
            'Business Country Location is required';
    }
    if (document.getElementById('editBusinessStatesLocation').value.length == 0) {
        output = 'empty_editBusinessStatesLocation';
        document.getElementById('editBusinessStatesLocationValidation').innerHTML =
            'Business States Location is required';
    }
    if (document.getElementById('editBusinessCityLocation').value.length == 0) {
        output = 'empty_editBusinessCityLocation';
        document.getElementById('editBusinessCityLocationValidation').innerHTML = 'Business City Location is required';
    }

    if (document.getElementById('editTradeCategory').value.length == 0) {
        output = 'empty_editTradeCategory';
        document.getElementById('editTradeCategoryValidation').innerHTML = 'Trade Category is required';
    }
    if (
        document.getElementById('traderSubCategoryToggleField1').value.length == 0 &&
        document.getElementById('traderSubCategoryToggleField2').value.length == 0
    ) {
        output = 'empty_traderSubCategoryToggleField1';
        document.getElementById('traderSubCategoryValidation').innerHTML = 'Trade Sub Category is required';
    }

    if (document.getElementById('editBusinessScale').value.length == 0) {
        output = 'empty_editBusinessScale';
        document.getElementById('editBusinessScaleValidation').innerHTML = 'Business Scale is required';
    }

    let isWantToUploadVideo = document.getElementById('inputWantToUploadCompanyVideo').value;
    let isWantToUploadBrochure = document.getElementById('inputWantToUploadCompanyBrochure').value;
    let isWantToUploadCompanyWebinar = document.getElementById('inputWantToUploadCompanyWebinar').value;

    if (isWantToUploadVideo == 1) {
        if (document.getElementById('thumbnailInput').files.length == 0) {
            output = 'empty video thumbnail';
            document.getElementById('traderVideoThumbnailValidation').style.display = 'block';
            document.getElementById('traderVideoThumbnailValidation').innerHTML = 'Please upload video thumbnail.';
        }
        if (document.getElementById('videoLink').value.length == 0) {
            output = 'empty Video title';
            document.getElementById('videoLinkValidation').innerHTML = 'Video link required';
        }
        if (document.getElementById('videoTitle').value.length == 0) {
            output = 'empty Video title';
            document.getElementById('videoTitleValidation').innerHTML = 'Video title required';
        }
        if (document.getElementById('videoDescription').value.length == 0) {
            output = 'empty Video description';
            document.getElementById('videoDescriptionValidation').innerHTML = 'Video description required';
        }
    } else {
        document.getElementById('traderVideoThumbnailValidation').innerHTML = '';
        document.getElementById('videoLinkValidation').innerHTML = '';
        document.getElementById('videoTitleValidation').innerHTML = '';
        document.getElementById('videoDescriptionValidation').innerHTML = '';
    }

    if (isWantToUploadBrochure == 1) {
        if (document.getElementById('brochureInput').files.length == 0) {
            output = 'empty brochure';
            document.getElementById('traderBrochureValidation').style.display = 'block';
            document.getElementById('traderBrochureValidation').innerHTML =
                'Please upload brochure related to your company.';
        }
        if (document.getElementById('brochureTitle').value.length == 0) {
            output = 'empty Brouchure title';
            document.getElementById('brochureTitleValidation').innerHTML = 'Brouchure title required';
        }
    } else {
        document.getElementById('traderBrochureValidation').innerHTML = '';
        document.getElementById('brochureTitleValidation').innerHTML = '';
    }

    if (isWantToUploadCompanyWebinar == 1) {
        if (document.getElementById('webinarsThumbnailInput').files.length == 0) {
            output = 'empty webinars thumbnail';
            document.getElementById('traderWebinarThumbnailValidation').style.display = 'block';
            document.getElementById('traderWebinarThumbnailValidation').innerHTML =
                'Please upload thumbnail image related to your webinars.';
        }
        if (document.getElementById('webinarsTitle').value.length == 0) {
            output = 'empty Webinars title';
            document.getElementById('webinarsTitleValidation').innerHTML = 'Webinars title required';
        }
        if (document.getElementById('webinarsDescription').value.length == 0) {
            output = 'empty Webinars description';
            document.getElementById('webinarsDescriptionValidation').innerHTML = 'Webinars description required';
        }
        if (document.getElementById('webinarsLink').value.length == 0) {
            output = 'empty Webinars link';
            document.getElementById('webinarsLinkValidation').innerHTML = 'Webinars link required';
        }
        if (document.getElementById('webinarsSchedule').value.length == 0) {
            output = 'empty Webinars schedules';
            document.getElementById('webinarsScheduleValidation').innerHTML = 'Webinars schedules required';
        }
    } else {
        document.getElementById('traderWebinarThumbnailValidation').innerHTML = '';
        document.getElementById('webinarsTitleValidation').innerHTML = '';
        document.getElementById('webinarsDescriptionValidation').innerHTML = '';
        document.getElementById('webinarsLinkValidation').innerHTML = '';
        document.getElementById('webinarsScheduleValidation').innerHTML = '';
    }

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

traderRegionOfOperation.onchange = function () {
    required(traderRegionOfOperation, traderRegionOfOperationValidation, 'Region of Operation is required');
};

traderCountryOfOperation.onchange = function () {
    required(traderCountryOfOperation, traderCountryOfOperationValidation, 'State of Operation is required');
};
