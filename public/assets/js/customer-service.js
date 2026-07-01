// HEAD PROFILE
const displayBusinessNameH1 = getId('displayBusinessNameH1');
const displayBusinessTagLineH1 = getId('displayBusinessTagLineH1');
const companyBanner = getId('companyBanner');
const companyBannerPreview = getId('companyBannerPreview');
const companyBannerId = getId('companyBannerId');
const companyLogo = getId('companyLogo');
const companyLogoPreview = getId('companyLogoPreview');
const companyLogoId = getId('companyLogoId');
const userImage = getId('user-image');
const isAvatar = getId('is_avatar');

// DISPLAY COMPANY DETAILS
const displayCompanyName = getId('displayCompanyName');
const displayCompanyTagline = getId('displayCompanyTagline');
const displayBusinessEmail = getId('displayBusinessEmail');
const displayBusinessContact = getId('displayBusinessContact');
const displayBusinessWebsite = getId('displayBusinessWebsite');
const displayBusinessSocialMediaContact = getId('displayBusinessSocialMediaContact');
const displayBusinessAddress = getId('displayBusinessAddress');
const localOperatingTimeId = getId('local-operating-time');
const uctOperatingTimeId = getId('uct-operating-time');
const displayBusinessTradeCategory = getId('displayBusinessTradeCategory');
const displayBusinessSubCategory = getId('displayBusinessSubCategory');
const displayBusinessMinorCategory = getId('displayBusinessMinorCategory');
const displayBusinessScale = getId('displayBusinessScale');
const displayBusinessTags = getId('displayBusinessTags');

const displayReprestativeFullname = getId('displayReprestativeFullname');
const displayReprestativeEmailAddress = getId('displayReprestativeEmailAddress');
const displayReprestativeContactNumber = getId('displayReprestativeContactNumber');
const displayReprestativeAddress = getId('displayReprestativeAddress');

const divCompanyDetails = getId('divCompanyDetails');
const divUpdateCompanyDetails = getId('divUpdateCompanyDetails');
const btnCompanyDetailsEdit = getId('btnCompanyDetailsEdit');
const btnCompanyDetailsCancelEdit = getId('btnCompanyDetailsCancelEdit');

// EDIT COMPANY DETAILS
const companyName = getId('companyName');
const tagline = getId('tagline');
const businessEmailAddress = getId('businessEmailAddress');
const businessContactNumber = getId('businessContactNumber');
const website = getId('website');
const businessSocialMediaContactType = getId('businessSocialMediaContactType');
const businessSocialMediaContactNumber = getId('businessSocialMediaContactNumber');
const businessAddress = getId('businessAddress');
const editBusinessCountryLocation = getId('editBusinessCountryLocation');
const editBusinessStatesLocation = getId('editBusinessStatesLocation');
const editBusinessCityLocation = getId('editBusinessCityLocation');
const startOperatingHour = getId('startOperatingHour');
const endOperatingHour = getId('endOperatingHour');
const editTradeCategory = getId('editTradeCategory');
const editBusinessScale = getId('editBusinessScale');
const editLanguagesOfCommunication = getId('editLanguagesOfCommunication');
const btnUpdateCompanyDetails = getId('btnUpdateCompanyDetails');

// NOTE: declared on file dropdown-select-option-with-input-other.js
// const subCategorySelect = getId('sub-category-select');
// const subCategoryManual = getId('sub-category-manual');
// const minorSubCategorySelect = getId('minor-sub-category-select');
// const minorSubCategoryManual = getId('minor-sub-category-manual');

// NOTE: declared on file tags.js
// const tagInput = getId('tag-input');

// DISPLAY REGION OF OPERATION
const displayBusinessRegionOfOperation = getId('displayBusinessRegionOfOperation');
const displayBusinessCountryOfOperation = getId('displayBusinessCountryOfOperation');
const displayBusinessStatesOfOperation = getId('displayBusinessStatesOfOperation');
const displayBusinessCityOfOperation = getId('displayBusinessCityOfOperation');

// UPDATE REGION OF OPERATION
const btnRegionOfOperationEdit = getId('btnRegionOfOperationEdit');
const btnRegionOfOperationCancelUpdate = getId('btnRegionOfOperationCancelUpdate');
const btnRegionOfOperationUpdate = getId('btnRegionOfOperationUpdate');
const divDisplayRegionOfOperation = getId('divDisplayRegionOfOperation');
const divUpdateRegionOfOperation = getId('divUpdateRegionOfOperation');

const iOperateOnAWorldWideLevelRadioButton = getId('iOperateOnAWorldWideLevelRadioButton');
const iOperateOnAGlobalRegionalLevelRadioButton = getId('iOperateOnAGlobalRegionalLevelRadioButton');
const iOperateOnANationalLevelRadioButton = getId('iOperateOnANationalLevelRadioButton');
const iOperateOnAStateLevelRadioButton = getId('iOperateOnAStateLevelRadioButton');
const iOperateOnACityLevelRadioButton = getId('iOperateOnACityLevelRadioButton');

const countryForStateOperation = getId('countryForStateOperation');
const traderStatesOfOperation = getId('traderStatesOfOperation');
const countryForCityOperation = getId('countryForCityOperation');
const statesForCityOperation = getId('statesForCityOperation');
const traderCityOfOperation = getId('traderCityOfOperation');

const traderRegionOfOperationValidation = getId('traderRegionOfOperationValidation');
const traderCountryOfOperationValidation = getId('traderCountryOfOperationValidation');
const traderStatesOfOperationValidation = getId('traderStatesOfOperationValidation');
const traderCityOfOperationValidation = getId('traderCityOfOperationValidation');

const divRegionOfOperation = getId('divRegionOfOperation');
const divCountryOfOperation = getId('divCountryOfOperation');
const divStatesOfOperation = getId('divStatesOfOperation');
const divCityOfOperation = getId('divCityOfOperation');

const $editRegionOfOperation = $('#editRegionOfOperation');

iOperateOnAWorldWideLevelRadioButton.checked = false;
iOperateOnAGlobalRegionalLevelRadioButton.checked = false;
iOperateOnANationalLevelRadioButton.checked = false;
iOperateOnAStateLevelRadioButton.checked = false;
iOperateOnACityLevelRadioButton.checked = false;

traderRegionOfOperationValidation.innerHTML = '';
traderCountryOfOperationValidation.innerHTML = '';
traderStatesOfOperationValidation.innerHTML = '';
traderCityOfOperationValidation.innerHTML = '';

divRegionOfOperation.style.display = 'none';
divCountryOfOperation.style.display = 'none';
divStatesOfOperation.style.display = 'none';
divCityOfOperation.style.display = 'none';

const radioButtonArray = [
    'iOperateOnAWorldWideLevelRadioButton',
    'iOperateOnAGlobalRegionalLevelRadioButton',
    'iOperateOnANationalLevelRadioButton',
    'iOperateOnAStateLevelRadioButton',
    'iOperateOnACityLevelRadioButton',
];

const divRegionOfOperationArray = [
    'divRegionOfOperation',
    'divCountryOfOperation',
    'divStatesOfOperation',
    'divCityOfOperation',
];

const API_URL = {
    users_upload_files: `${host}/uploads/users_upload_files/`,
    banner_placeholder: `${host}/uploads/placeholder/banner-placeholder.png`,
    logo_placeholder: `${host}/uploads/placeholder/logo-placeholder.jpg`,
    get_users_logo_and_banner: `${host}/api/get/users-logo-and-banners`,
    get_company_details: `${host}/api/get/company-details`,
    get_user: `${host}/api/get/user`,
    get_users_account: `${host}/api/get/users-account`,
    get_users_address: `${host}/api/get/users-address`,
    update_company_banner: `${host}/api/post/update-trader-company-banner`,
    update_company_logo: `${host}/api/post/update-trader-company-logo`,
    create_communicator_link: `${host}/api/get/create-communicator-link`,
    generate_waiting_room: `${host}/api/v2/post/generate-waiting-room`,
    get_current_visitor: `${host}/api/post/get-current-visitor`,
    email_payment_account: `${host}/api/post/email-payment-account`,
    communicator_domain: `https://meet.allworldtrade.com/join/`,
    //communicator_domain: 'https://meet2.allworldtrade.com/groupcall/' //old
    download_current_visitor_data: `${host}/download-current-visitor-data`,
    get_trade_categories: `${host}/api/get/categories`,
    get_region_of_operations: `${host}/api/get/region-of-operations`,
    get_business_visibility: `${host}/api/get/users-business-visibility`,
    region_of_operation: `${host}/api/v2/update/region-of-operation`,
};

// $(function () {
//     // getUsersBusinessBrochures();
// });

//====================================
// DISPLAY COMPANY DETAILS - [START]
//====================================
async function getCompanyDetails() {
    try {
        const response = await fetch(API_URL.get_company_details, {
            method: 'POST',
        });
        const data = await response.json();

        // display
        displayCompanyDetails(data);
        // edit
        editCompanyDetails(data);
    } catch (error) {
        console.error(error);
    }
}

const displayCompanyDetails = (data) => {
    const {
        business_name,
        business_tagline,
        business_email,
        business_contact,
        business_website,
        business_social_media_contact_type,
        business_social_media_contact_number,
        business_address,
        business_city,
        business_states,
        business_country,
        region_of_operation,
        city_of_operation,
        states_of_operation,
        country_of_operation,
        business_language_of_communication,
        start_operating_hour,
        end_operating_hour,
    } = data[0];

    displayBusinessNameH1.innerHTML = business_name;
    displayBusinessTagLineH1.innerHTML = business_tagline;

    displayData(displayCompanyName, business_name);
    displayData(displayCompanyTagline, business_tagline);
    displayData(displayBusinessEmail, business_email);
    displayData(displayBusinessContact, business_contact);
    displayData(displayBusinessWebsite, business_website);
    displayData(displayBusinessSocialMediaContact, business_social_media_contact_number);
    displayDataV2(displayBusinessAddress, business_address);

    getCityNameToBeDisplayUsingCode(business_country, business_states, business_city, 'displayBusinessAddressCity');
    getStatesNameToBeDisplayUsingCode(business_states, 'displayBusinessAddressStates');
    getCountryNameUsingCode(business_country, 'displayBusinessAddressCountry');
    getRegionNameUsingCode(region_of_operation, 'displayBusinessRegionOfOperation');
    getCityOfOperationNameUsingCode(city_of_operation, 'displayBusinessCityOfOperation');
    getStatesOfOperationNameUsingCode(states_of_operation, 'displayBusinessStatesOfOperation');
    getCountryOfOperationNameUsingCode(country_of_operation, 'displayBusinessCountryOfOperation');
    getLanguageName(business_language_of_communication, 'displayLanguageOfComm');

    displayLocalTime(localOperatingTimeId, start_operating_hour, end_operating_hour);
    displayConvertedTime(uctOperatingTimeId, start_operating_hour, end_operating_hour, 'Philippines', 'UTC');

    if (!business_address && !business_city && !business_states && !business_country) {
        displayBusinessAddress.innerHTML = 'N/A';
    }
};

const displayData = (elemenId, data) => {
    elemenId.innerHTML = data || 'N/A';
};

const displayDataV2 = (elemenId, data) => {
    elemenId.innerHTML = data ? `${data}, ` : ' ';
};

const displayLocalTime = (elemenId, start_operating_hour, end_operating_hour) => {
    elemenId.innerHTML =
        start_operating_hour && end_operating_hour ? `${start_operating_hour} - ${end_operating_hour}` : 'N/A';
};

const displayConvertedTime = (elemenId, start_operating_hour, end_operating_hour, countryTimeZone, timeZoneOffset) => {
    elemenId.innerHTML =
        start_operating_hour && end_operating_hour
            ? convertTimeToInternationalStart(start_operating_hour, countryTimeZone, timeZoneOffset) +
              ' - ' +
              convertTimeToInternationalEnd(end_operating_hour, countryTimeZone, timeZoneOffset)
            : 'N/A';
};

const editCompanyDetails = (data) => {
    const {
        business_name,
        business_tagline,
        business_email,
        business_contact,
        business_website,
        business_social_media_contact_type,
        business_social_media_contact_number,
        business_address,
        business_city,
        business_states,
        business_country,
        region_of_operation,
        country_of_operation,
        country_for_state,
        states_of_operation,
        country_for_city,
        states_for_city,
        city_of_operation,
        business_language_of_communication,
        start_operating_hour,
        end_operating_hour,
    } = data[0];

    displayDataToEdit(companyName, business_name);
    displayDataToEdit(tagline, business_tagline);
    displayDataToEdit(businessEmailAddress, business_email);
    displayDataToEdit(businessContactNumber, business_contact);
    displayDataToEdit(website, business_website);
    getBusinessSocialMediaContactType(business_social_media_contact_type, 'businessSocialMediaContactType');
    displayDataToEdit(businessSocialMediaContactNumber, business_social_media_contact_number);
    displayDataToEdit(businessAddress, business_address);
    displayDataToEdit(startOperatingHour, start_operating_hour);
    displayDataToEdit(endOperatingHour, end_operating_hour);

    getCountryToBeEditAndOptions(business_country, 'editBusinessCountryLocation');
    getStatesToBeEditAndOptions(business_country, business_states, 'editBusinessStatesLocation');
    getCityToBeEditAndOptions(business_country, business_states, business_city, 'editBusinessCityLocation');
    getLanguagesToBeEditAndOptions(business_language_of_communication);

    // update region of operation | I operate on a Global Regional Level
    getRegionOfOperationToBeEditAndOptions(region_of_operation, 'traderRegionOfOperation');
    // update country of operation | I operate on a National Level
    getCountriesOfOperationToBeEditAndOptions(country_of_operation, 'traderCountryOfOperation');
    // update state of operation | I operate on a Provincial/State Level
    getCountryToBeEditAndOptions(country_for_state, 'countryForStateOperation');
    getStatesToBeEditAndOptions(country_for_state, states_of_operation, 'traderStatesOfOperation');
    // update state of operation | I operate on a City Level
    getCountryToBeEditAndOptions(country_for_city, 'countryForCityOperation');
    getStatesToBeEditAndOptions(country_for_city, states_for_city, 'statesForCityOperation');
    getCityToBeEditAndOptions(country_for_city, states_for_city, city_of_operation, 'traderCityOfOperation');
};

const displayDataToEdit = (elemenId, data) => {
    elemenId.value = data || '';
};

async function getCityNameToBeDisplayUsingCode(countryCode, stateId, cityId, elementId) {
    //=======================================================================================================
    // version 1: get first the country, then under country get the state and under state find the city id
    //=======================================================================================================
    // const element_id = getId(elementId);

    // if (cityId && cityId !== 'No Cities Found') {
    //     const cities = await fetchCities();
    //     const citiesUnderCountry = cities.filter(({ country_code }) => country_code === countryCode);
    //     const citiesUnderCountryAndState = citiesUnderCountry.filter(({ state_id }) => state_id === parseInt(stateId));
    //     const selectedCity = citiesUnderCountryAndState.find((d) => d.id === parseInt(cityId));

    //     console.log('selectedCity: ', selectedCity);
    //     element_id.innerHTML = selectedCity ? selectedCity.name + ', ' : ' ';
    // } else {
    //     element_id.innerHTML = ' ';
    // }

    // =====================================================
    // version 2: directly find city id in all cities data
    // =====================================================
    const element_id = getId(elementId);

    if (cityId || cityId !== 'No States Found') {
        const cities = await fetchCities();
        const selectedCity = cities.find((d) => d.id === parseInt(cityId));
        element_id.innerHTML = selectedCity ? selectedCity.name + ', ' : ' ';
    } else {
        element_id.innerHTML = ' ';
    }
}

async function getStatesNameToBeDisplayUsingCode(stateId, elementId) {
    const element_id = getId(elementId);

    if (stateId && stateId !== 'No States Found') {
        const states = await fetchStates();
        const selectedState = states.find((d) => d.id === parseInt(stateId));
        element_id.innerHTML = selectedState ? selectedState.name + ', ' : ' ';
    } else {
        element_id.innerHTML = ' ';
    }
}

async function getCountryNameUsingCode(code, elementId) {
    const element_id = getId(elementId);

    if (code) {
        const countries = await fetchCountries();
        const filtered = countries.filter((d) => d.iso2 == code);
        element_id.innerHTML = filtered.length > 0 ? filtered[0].name : ' ';
    } else {
        element_id.innerHTML = ' ';
    }
}

function getLanguageName(string, elementId) {
    const element_id = getId(elementId);

    if (!string) {
        element_id.innerHTML = 'N/A';
        return;
    }

    const data = string.split(',');
    for (var i = 0; i < data.length; i++) {
        element_id.innerHTML =
            element_id.innerHTML +
            '<a href="#" class="bg-gray-200 py-1.5 px-4 rounded-full">' +
            getLanguageNameByCode(data[i]) +
            '</a>';
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

async function getUsersBusinessCharacteristics() {
    try {
        const response = await fetch('/api/get/user-business-characteristics', { method: 'POST' });
        const data = await response.json();
        if (!data || data.length === 0) {
            return;
        }
        const {
            business_major_category,
            business_sub_category,
            business_sub_category_str,
            business_minor_sub_category,
            business_minor_sub_category_str,
            business_scale,
            business_industry_belong_to,
        } = data[0];

        // display
        displayBusinessTradeCategory.textContent = getTradeCategoriesTitleById(business_major_category);
        displayBusinessSubCategory.textContent = getSubCategoriesTitleById(
            business_sub_category,
            business_sub_category_str,
        );
        displayBusinessMinorCategory.textContent = getMinorSubCategoriesTitleById(
            business_minor_sub_category,
            business_minor_sub_category_str,
        );
        displayBusinessScale.textContent = getBusinessScaleTitle(business_scale);
        formattingBusinessTags(business_industry_belong_to, 'displayBusinessTags');

        // edit
        getTradeCategoriesToBeEditAndOptions(business_major_category, 'editTradeCategory');
        getSubCategoriesToBeEditByTradeCategoryId(data);
        getMinorSubCategoriesToBeEditByTradeCategoryId(data);
        getUsersBusinessScale(data);
        displayTagList(business_industry_belong_to);
    } catch (error) {
        console.error(error);
    }
}

function getTradeCategoriesTitleById(tradeCategoryId) {
    if (!tradeCategoryId) {
        return 'N/A';
    }

    if (tradeCategoryId) {
        let value;
        $.ajax({
            url: host + '/api/get/trade-category-title-by-id/' + tradeCategoryId,
            async: false,
            success: function (data) {
                value = data[0].title;
            },
        });
        return value;
    }
}

function getSubCategoriesTitleById(subCategoryId, string) {
    if (!subCategoryId && !string) {
        return 'N/A';
    }

    if (subCategoryId) {
        let value;
        $.ajax({
            url: host + '/api/get/sub-category-title-by-id/' + subCategoryId,
            async: false,
            success: function (data) {
                value = data[0].title;
            },
        });
        return value;
    }

    if (string) {
        return string;
    }
}

function getMinorSubCategoriesTitleById(minorSubCategoryId, string) {
    if (!minorSubCategoryId && !string) {
        return 'N/A';
    }

    if (minorSubCategoryId) {
        let value;
        $.ajax({
            url: host + '/api/get/minor-sub-category-title-by-id/' + minorSubCategoryId,
            async: false,
            success: function (data) {
                value = data[0].title;
            },
        });
        return value;
    }

    if (string) {
        return string;
    }
}

function getBusinessScaleTitle(id) {
    let value;

    switch (id) {
        case 1:
            value = 'Small Scale';
            break;
        case 2:
            value = 'Medium Scale';
            break;
        case 3:
            value = 'Large Scale';
            break;
        default:
            value = 'N/A';
    }

    return value;
}

function formattingBusinessTags(string, elementId) {
    const element_id = getId(elementId);

    if (!string) {
        element_id.innerHTML = 'N/A';
    }

    if (string) {
        const data = string.split(',');
        for (var i = 0; i < data.length; i++) {
            element_id.innerHTML =
                element_id.innerHTML + '<a href="#" class="bg-gray-200 py-1.5 px-4 rounded-full">' + data[i] + '</a>';
        }
    }
}
//==================================
// DISPLAY COMPANY DETAILS - [END]
//==================================

//==========================================
// DISPLAY REPRESENTATIVE DETAILS - [START]
//==========================================
async function getUser() {
    try {
        const response = await fetch(API_URL.get_user, { method: 'POST' });
        const data = await response.json();
        const firstName = data[0]?.first_name || '';
        const lastName = data[0]?.last_name || '';
        displayReprestativeFullname.textContent = `${firstName} ${lastName}`;
    } catch (error) {
        console.error(error);
    }
}

async function getUsersAccount() {
    try {
        const response = await fetch(API_URL.get_users_account, { method: 'POST' });
        const data = await response.json();
        const { email_or_social_media, contact_number } = data[0] || {};
        displayReprestativeEmailAddress.textContent = email_or_social_media || '';
        displayReprestativeContactNumber.textContent = contact_number || '';
    } catch (error) {
        console.error(error);
    }
}

async function getUsersAddress() {
    try {
        const response = await fetch(API_URL.get_users_address, { method: 'POST' });
        const data = await response.json();
        if (!data || data.length === 0) {
            displayReprestativeAddress.textContent = ' ';
            return;
        }
        const { address, city, state_or_province, country } = data[0];
        displayReprestativeAddress.textContent = address || ' ';
        getCityNameToBeDisplayUsingCode(country, state_or_province, city, 'displayReprestativeAddressCity');
        getStatesNameToBeDisplayUsingCode(state_or_province, 'displayReprestativeAddressStates');
        getCountryNameUsingCode(country, 'displayReprestativeAddressCountry');
    } catch (error) {
        console.error(error);
    }
}

//========================================
// DISPLAY REPRESENTATIVE DETAILS - [END]
//========================================

//=================================================
// DISPLAY COMPANY REGION OF OPERATION - [START]
//=================================================
function getRegionNameUsingCode(string, elementId) {
    const element_id = getId(elementId);

    if (!string) {
        element_id.innerHTML = 'N/A';
        return;
    }

    if (string) {
        const data = string.split(',');
        for (var i = 0; i < data.length; i++) {
            element_id.innerHTML =
                element_id.innerHTML + '<a href="#" class="bg-gray-200 py-1.5 px-4 rounded-full">' + data[i] + '</a>';
        }
    }
}

async function getCountryOfOperationNameUsingCode(code, elementId) {
    const element_id = getId(elementId);

    if (!code) {
        element_id.innerHTML = 'N/A';
        return;
    }

    const data = code.split(',');
    for (var i = 0; i < data.length; i++) {
        const countryName = await displayCountryName(data[i]);
        element_id.innerHTML =
            element_id.innerHTML +
            `<a href="" onclick="return false;" class="bg-gray-200 py-1.5 px-4 rounded-full">${countryName}</a>`;
    }
}

async function displayCountryName(countryCode) {
    const countries = await fetchCountries();
    const selectedCountry = countries.find((d) => d.iso2 === countryCode);
    return selectedCountry.name;
}

async function getStatesOfOperationNameUsingCode(stateId, elementId) {
    const element_id = getId(elementId);

    if (stateId && stateId !== 'No States Found') {
        const states = await fetchStates();
        const selectedState = states.find((d) => d.id === parseInt(stateId));
        element_id.innerHTML = selectedState ? selectedState.name : ' ';
    } else {
        element_id.innerHTML = 'N/A';
    }
}

async function getCityOfOperationNameUsingCode(cityId, elementId) {
    const element_id = getId(elementId);

    if (cityId && cityId !== 'No States Found') {
        const cities = await fetchCities();
        const selectedCity = cities.find((d) => d.id === parseInt(cityId));
        element_id.innerHTML = selectedCity ? selectedCity.name : ' ';
    } else {
        element_id.innerHTML = 'N/A';
    }
}
//================================================
//  DISPLAY COMPANY REGION OF OPERATION - [END]
//================================================

//====================================
// UPDATE COMPANY DETAILS - [START]
//====================================
btnCompanyDetailsEdit.addEventListener('click', (e) => {
    divCompanyDetails.style.display = 'none';
    divUpdateCompanyDetails.style.display = 'block';
});

btnCompanyDetailsCancelEdit.addEventListener('click', (e) => {
    divCompanyDetails.style.display = 'block';
    divUpdateCompanyDetails.style.display = 'none';
});

function getBusinessSocialMediaContactType(selectedValue, elementId) {
    const element_id = document.getElementById(elementId);
    const companyDetails = [
        { id: '', title: 'None' },
        { id: '1', title: 'Viber' },
        { id: '2', title: 'Wechat' },
        { id: '3', title: 'Whatsapp' },
    ];

    if (!selectedValue || selectedValue === '' || selectedValue === null) {
        element_id.innerHTML = companyDetails
            .map((detail) => `<option value="${detail.id}">${detail.title}</option>`)
            .join('');
    } else {
        const selectedOption = companyDetails.find((detail) => detail.id == selectedValue);
        const optionsToRender = companyDetails.filter((detail) => detail.id != selectedValue);
        const optionsHtml = optionsToRender
            .map((detail) => `<option value="${detail.id}">${detail.title}</option>`)
            .join('');
        element_id.innerHTML = `<option value="${selectedOption.id}">${selectedOption.title}</option>${optionsHtml}`;
        element_id.value = selectedValue;
    }

    $(`#${elementId}`).selectpicker('refresh');
}

async function fetchCountries() {
    const resp = await fetch('assets/json/countries.json');
    const countries = await resp.json();
    return countries;
}

async function getCountryToBeEditAndOptions(countryCode, elementId) {
    const element_id = getId(elementId);
    const countries = await fetchCountries();
    const selectedCountry = countries.find((country) => country.iso2 === countryCode);

    element_id.innerHTML = countryCode
        ? `<option value="${selectedCountry.iso2}">${selectedCountry.name}</option>`
        : '<option value="">Select Country</option>';

    const unselectedCountry = countries.filter((country) => country.iso2 !== countryCode);

    // OLD AND DELETE
    // businessCountryLocationForOfLoop(unselectedCountry, element_id);
    // NEW
    optionsForOfLoop(unselectedCountry, element_id, 'iso2', 'name');

    $(`#${elementId}`).selectpicker('refresh');
}

function businessCountryLocationForOfLoop(countriesOptionsToRender, element_id) {
    for (const country of countriesOptionsToRender) {
        const option = document.createElement('option');
        option.value = country.iso2;
        option.textContent = country.name;
        element_id.appendChild(option);
    }
}

async function fetchStates() {
    const resp = await fetch('assets/json/states.json');
    const states = await resp.json();
    return states;
}

function initialOption(value = null, title, elementId) {
    elementId.innerHTML = `<option value="${value}">${title}</option>`;
    $(elementId).selectpicker('refresh');
}

async function getStatesToBeEditAndOptions(countryCode, stateId, elementId) {
    const element_id = getId(elementId);
    !countryCode ? initialOption(null, 'Select Country First', element_id) : null;
    stateId === 'No States Found' ? initialOption('No States Found', 'No States Found', element_id) : null;

    const states = await fetchStates();
    const statesInCountry = states.filter((state) => state.country_code === countryCode);
    const selectedState = states.find((state) => state.id === parseInt(stateId));
    const statesToRender = statesInCountry.filter((state) => state.id !== parseInt(stateId));

    element_id.innerHTML = !stateId
        ? '<option value="">Select Country First</option>'
        : `<option value="${selectedState.id}">${selectedState.name}</option>`;

    // OLD AND DELETE
    // businessStatesLocationForOfLoop(statesToRender, element_id);
    // NEW
    optionsForOfLoop(statesToRender, element_id, 'id', 'name');
    $(element_id).selectpicker('refresh');
}

function businessStatesLocationForOfLoop(statesOptionsToRender, element_id) {
    for (const state of statesOptionsToRender) {
        const option = document.createElement('option');
        option.value = state.id;
        option.textContent = state.name;
        element_id.appendChild(option);
    }
    $(element_id).selectpicker('refresh');
}

async function fetchCities() {
    const response = await fetch('assets/json/cities.json');
    const cities = await response.json();
    return cities;
}

async function getCityToBeEditAndOptions(countryCode, stateId, cityId, elementId) {
    try {
        const element_id = document.getElementById(elementId);
        let citiesUnderCountry, citiesUnderCountryAndState, selectedCity, otherCitiesUnderCountryAndState;

        if (cityId === 'No Cities Found') {
            element_id.innerHTML = '<option value="No Cities Found">No Cities Found</option>';
        }

        if (stateId === 'No States Found') {
            element_id.innerHTML = '<option value="No States Found">No States Found</option>';
        }

        if (!countryCode || !stateId) {
            element_id.innerHTML = '<option value="">Select Country and State First</option>';
        }

        if (countryCode && stateId && !cityId) {
            const cities = await fetchCities();
            citiesUnderCountry = cities.filter(({ country_code }) => country_code === countryCode);
            citiesUnderCountryAndState = citiesUnderCountry.filter(({ state_id }) => state_id === parseInt(stateId));

            element_id.innerHTML = '<option value="">Select City</option>';
            // OLD AND DELETE
            // businessCityLocationForEachLoop(citiesUnderCountryAndState, element_id);
            // NEW
            optionsForOfLoop(citiesUnderCountryAndState, element_id, 'id', 'name');
        }

        if (countryCode && stateId && cityId) {
            const cities = await fetchCities();
            citiesUnderCountry = cities.filter(({ country_code }) => country_code === countryCode);
            citiesUnderCountryAndState = citiesUnderCountry.filter(({ state_id }) => state_id === parseInt(stateId));
            selectedCity = citiesUnderCountryAndState.filter(({ id }) => id === parseInt(cityId));
            otherCitiesUnderCountryAndState = citiesUnderCountryAndState.filter(({ id }) => id !== parseInt(cityId));

            element_id.innerHTML = `<option value="${selectedCity[0].id}">${selectedCity[0].name}</option>`;

            // OLD AND DELETE
            // businessCityLocationForEachLoop(otherCitiesUnderCountryAndState, element_id);
            // NEW
            optionsForOfLoop(otherCitiesUnderCountryAndState, element_id, 'id', 'name');
        }

        $(`#${elementId}`).selectpicker('refresh');
    } catch (error) {
        console.error('Error fetching states:', error);
    }
}

function businessCityLocationForEachLoop(citiesOptionsToRender, elementId) {
    citiesOptionsToRender.forEach(({ id, name }) => {
        const option = document.createElement('option');
        option.value = id;
        option.innerHTML = name;
        elementId.appendChild(option);
    });
}

editBusinessCountryLocation.addEventListener('change', function () {
    $('#editBusinessStatesLocation').empty();
    $('#editBusinessCityLocation').empty();

    let traderBusinessCountryCode = this.value;

    fetch('assets/json/states.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    editBusinessStatesLocation.innerHTML =
                        editBusinessStatesLocation.innerHTML +
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
                editBusinessStatesLocation.appendChild(option);
            }

            $('#editBusinessStatesLocation').selectpicker('refresh');
            // required(
            //     editBusinessStatesLocation,
            //     editBusinessStatesLocationValidation,
            //     'Business States Location is required',
            // );
        });

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_id = editBusinessStatesLocation.value;
            let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    if (filtered[i].state_id == state_id) {
                        editBusinessCityLocation.innerHTML =
                            editBusinessCityLocation.innerHTML +
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
                editBusinessCityLocation.appendChild(option);
            }

            $('#editBusinessCityLocation').selectpicker('refresh');
        });
});

editBusinessStatesLocation.addEventListener('change', function () {
    $('#editBusinessCityLocation').empty();

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_id = editBusinessStatesLocation.value;
            let traderResidenceCountryCode = editBusinessCountryLocation.value;
            let filtered = data.filter((d) => d.country_code == traderResidenceCountryCode);
            let filtered2 = filtered.filter((x) => x.state_id == state_id);

            if (filtered2.length) {
                for (var i = 0; i < filtered2.length; i++) {
                    editBusinessCityLocation.innerHTML =
                        editBusinessCityLocation.innerHTML +
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
                editBusinessCityLocation.appendChild(option);
            }

            $('#editBusinessCityLocation').selectpicker('refresh');
        });
});

async function getTradeCategories() {
    const response = await fetch(API_URL.get_trade_categories);
    const data = await response.json();
    return data;
}

async function getTradeCategoriesToBeEditAndOptions(tradeCategoryId, elementId) {
    const element_id = getId(elementId);

    const tradeCategories = await getTradeCategories();
    const selectedOption = tradeCategories.find((d) => d.id === parseInt(tradeCategoryId));
    const unselectedOptions = tradeCategories.filter((d) => d.id != parseInt(tradeCategoryId));

    element_id.innerHTML = tradeCategoryId
        ? `<option value="${selectedOption.id}">${selectedOption.title}</option>`
        : '<option value="">Select Trade Category</option>';

    optionsForOfLoop(unselectedOptions, element_id, 'id', 'title');

    $(`#${elementId}`).selectpicker('refresh');
}

// version 1: good starting point for rendering options in a select
// const optionsForOfLoop = (optionsToRender, elementId, optionValue, optionTextContent) => {
//     for (const optionToRender of optionsToRender) {
//         const option = document.createElement('option');
//         option.value = optionToRender[optionValue];
//         option.textContent = optionToRender[optionTextContent];
//         elementId.appendChild(option);
//     }
// }

// version 2:
// For large arrays of options, it's more efficient to use 'document.createDocumentFragment()'
// If this code is ok till finish the insert/update transaction, lets use this as universal function
const optionsForOfLoop = (optionsToRender, elementId, optionValue, optionTextContent) => {
    const fragment = document.createDocumentFragment();
    for (const optionToRender of optionsToRender) {
        const option = document.createElement('option');
        option.value = optionToRender[optionValue];
        option.textContent = optionToRender[optionTextContent];
        fragment.appendChild(option);
    }
    elementId.appendChild(fragment);
};

editTradeCategory.addEventListener('change', () => {
    const tradeCategoryId = editTradeCategory.value;
    console.log('editTradeCategory id when change: ', tradeCategoryId);
});

editTradeCategory.addEventListener('change', function () {
    let tradeCategoryId = this.value;

    document.getElementById('minor-sub-category-select').value = '';
    document.getElementById('minor-sub-category-manual').value = '';
    $('#minor-sub-category-select').empty();

    // NOTE: this function can be foud in dropdown-select-option-with-input-other.js
    getSubCategoriesOptionsWhenTradeCategoriesChange(tradeCategoryId);
});

function getUsersBusinessScale(data) {
    let value = data[0].business_scale;
    if (value) {
        let x = getBusinessScaleTitle(value);
        document.getElementById('editBusinessScale').innerHTML = '<option value="' + value + '">' + x + '</option>';
    }

    let jsonObj =
        '{ "companyDetails" : [' +
        '{ "id":"1" , "title":"Small Scale" },' +
        '{ "id":"2" , "title":"Medium Scale" },' +
        '{ "id":"3" , "title":"Large Scale" } ]}';

    const parsedObj = JSON.parse(jsonObj);
    let companyDetails = parsedObj.companyDetails;
    let leng = companyDetails.length;

    for (let i = 0; i < leng; i++) {
        document.getElementById('editBusinessScale').innerHTML =
            document.getElementById('editBusinessScale').innerHTML +
            '<option value="' +
            companyDetails[i]['id'] +
            '">' +
            companyDetails[i]['title'] +
            '</option>';

        if (i + 1 == leng) {
            $('#editBusinessScale').selectpicker('refresh');
        }
    }
}

async function getLanguagesToBeEditAndOptions(languages) {
    // consume api to get all languages
    async function getLanguages() {
        const response = await fetch(`${host}/api/get/languages`);
        const data = await response.json();
        return data;
    }

    try {
        const data = await getLanguages();
        const arr = languages.split(',');

        const editLanguagesOfCommunication = document.getElementById('editLanguagesOfCommunication');
        editLanguagesOfCommunication.innerHTML = '';

        const selectedOptions = data
            .filter((d) => arr.includes(d.code))
            .map((d) => `<option value="${d.code}" selected>${d.name}</option>`);
        const unselectedOptions = data
            .filter((d) => !arr.includes(d.code))
            .map((d) => `<option value="${d.code}">${d.name}</option>`);

        editLanguagesOfCommunication.innerHTML = selectedOptions.concat(unselectedOptions).join('');

        $(`#editLanguagesOfCommunication`).selectpicker('refresh');
    } catch (error) {
        console.error(error);
    }
}

const $form = $('#editCompanyDetails');

btnUpdateCompanyDetails.addEventListener('click', (e) => {
    //stop submit the form, we will post it manually.
    e.preventDefault();

    console.log('editCompanyDetails');

    $.ajax({
        // url: '/api/v2/post/update-company-details',
        url: '/api/v2/update/update-company-details',
        type: 'post',
        data: $form.serialize(),
    }).done((response) => {
        if (response === 'success') {
            Swal.fire('Success', 'Update Successful.', 'success');
            setTimeout(() => {
                location.replace(host + '/profile');
            }, 1500);
        } else {
            Swal.fire('Warning', 'Try again later or contact to the customer service.', 'warning');
        }
    });
});
//====================================
// UPDATE COMPANY DETAILS - [END]
//====================================

//==============================================
// UPDATE COMPANY REGION OF OPERATION - [START]
//==============================================
btnRegionOfOperationEdit.addEventListener('click', async (e) => {
    divDisplayRegionOfOperation.style.display = 'none';
    divUpdateRegionOfOperation.style.display = 'block';
    await checkRadioButtonBySelectedVisibility();
});

btnRegionOfOperationCancelUpdate.addEventListener('click', (e) => {
    divDisplayRegionOfOperation.style.display = 'block';
    divUpdateRegionOfOperation.style.display = 'none';
});

async function getBusinessVisibility() {
    try {
        const response = await fetch(API_URL.get_business_visibility, {
            method: 'POST',
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error);
    }
}

async function checkRadioButtonBySelectedVisibility() {
    const data = await getBusinessVisibility();
    const {
        i_operate_on_a_world_wide_level,
        i_operate_on_a_global_regional_level,
        i_operate_on_a_national_level,
        i_operate_on_a_state_level,
        i_operate_on_a_city_level,
    } = data[0];

    if (parseInt(i_operate_on_a_world_wide_level) === 1) {
        iOperateOnAWorldWideLevelRadioButton.checked = true;
    }
    if (parseInt(i_operate_on_a_global_regional_level) === 1) {
        iOperateOnAGlobalRegionalLevelRadioButton.checked = true;
        divRegionOfOperation.style.display = 'block';
    }
    if (parseInt(i_operate_on_a_national_level) === 1) {
        iOperateOnANationalLevelRadioButton.checked = true;
        divCountryOfOperation.style.display = 'block';
    }
    if (parseInt(i_operate_on_a_state_level) === 1) {
        iOperateOnAStateLevelRadioButton.checked = true;
        divStatesOfOperation.style.display = 'block';
    }
    if (parseInt(i_operate_on_a_city_level) === 1) {
        iOperateOnACityLevelRadioButton.checked = true;
        divCityOfOperation.style.display = 'block';
    }
}

// Add event listeners to radio buttons
iOperateOnAWorldWideLevelRadioButton.addEventListener(
    'change',
    universalToggleFunction.bind(null, 'iOperateOnAWorldWideLevelRadioButton', ''),
);
iOperateOnAGlobalRegionalLevelRadioButton.addEventListener(
    'change',
    universalToggleFunction.bind(null, 'iOperateOnAGlobalRegionalLevelRadioButton', 'divRegionOfOperation'),
);
iOperateOnANationalLevelRadioButton.addEventListener(
    'change',
    universalToggleFunction.bind(null, 'iOperateOnANationalLevelRadioButton', 'divCountryOfOperation'),
);
iOperateOnAStateLevelRadioButton.addEventListener(
    'change',
    universalToggleFunction.bind(null, 'iOperateOnAStateLevelRadioButton', 'divStatesOfOperation'),
);
iOperateOnACityLevelRadioButton.addEventListener(
    'change',
    universalToggleFunction.bind(null, 'iOperateOnACityLevelRadioButton', 'divCityOfOperation'),
);

function universalToggleFunction(radioButtonId, divId, event) {
    const radioButton = event.target;
    const radioButtonChecked = radioButton.checked;

    if (radioButtonChecked) {
        // Uncheck other radio buttons
        radioButtonArray
            .filter((id) => id !== radioButtonId)
            .forEach((id) => {
                const otherRadioButton = getId(id);
                otherRadioButton.checked = false;
            });

        // Hide other divs
        divRegionOfOperationArray
            .filter((id) => id !== divId)
            .forEach((id) => {
                const otherDiv = getId(id);
                otherDiv.style.display = 'none';
            });

        // Show the selected div
        if (divId) {
            const selectedDiv = getId(divId);
            selectedDiv.style.display = 'block';
        }
    } else {
        // Dont allow to uncheck the already checked radio button.
        console.log(`"${radioButtonId}" radio button is trying to unchecked`);

        radioButtonArray
            .filter((id) => id === radioButtonId)
            .forEach((id) => {
                const otherRadioButton = getId(id);
                otherRadioButton.checked = true;
            });
    }
}

async function getRegionOfOperation() {
    const response = await fetch(API_URL.get_region_of_operations);
    const data = await response.json();
    return data;
}

// For: I operate on a Global Regional Level
async function getRegionOfOperationToBeEditAndOptions(regionOfOperationCode, elementId) {
    const data = await getRegionOfOperation();
    const element_id = getId(elementId);
    element_id.innerHTML = '';

    if (regionOfOperationCode) {
        const arr = regionOfOperationCode.split(',');

        const selectedOptions = data
            .filter((d) => arr.includes(d.iso))
            .map((d) => `<option value="${d.iso}" selected>${d.name}</option>`);
        const unselectedOptions = data
            .filter((d) => !arr.includes(d.iso))
            .map((d) => `<option value="${d.iso}">${d.name}</option>`);

        element_id.innerHTML = selectedOptions.concat(unselectedOptions).join('');
        $(`#${elementId}`).selectpicker('refresh');
    } else {
        // element_id.innerHTML = '<option value="" selected>Select Region</option>';
        optionsForOfLoop(data, element_id, 'iso', 'name');
        $(`#${elementId}`).selectpicker('refresh');
    }
}

// For: I operate on a National Level
async function getCountriesOfOperationToBeEditAndOptions(countryOfOperationCode, elementId) {
    const countries = await fetchCountries();
    const element_id = getId(elementId);
    element_id.innerHTML = '';

    if (countryOfOperationCode) {
        const arr = countryOfOperationCode.split(',');

        const selectedOptions = countries
            .filter((d) => arr.includes(d.iso2))
            .map((d) => `<option value="${d.iso2}" selected>${d.name}</option>`);
        const unselectedOptions = countries
            .filter((d) => !arr.includes(d.iso2))
            .map((d) => `<option value="${d.iso2}">${d.name}</option>`);

        element_id.innerHTML = selectedOptions.concat(unselectedOptions).join('');
        $(`#${elementId}`).selectpicker('refresh');
    } else {
        // element_id.innerHTML = '<option value="" selected>Select Country</option>';
        optionsForOfLoop(countries, element_id, 'iso2', 'name');
        $(`#${elementId}`).selectpicker('refresh');
    }
}

async function getCountryForStateLevelToBeEditAndOptions(countryCode, elementId) {
    const element_id = getId(elementId);
    const countries = await fetchCountries();
    const selectedCountry = countries.find((country) => country.iso2 === countryCode);

    element_id.innerHTML = countryCode
        ? `<option value="${selectedCountry.iso2}">${selectedCountry.name}</option>`
        : '<option value="">Select Country</option>';

    const unselectedCountry = countries.filter((country) => country.iso2 !== countryCode);
    businessCountryLocationForOfLoop(unselectedCountry, element_id);

    $(`#${elementId}`).selectpicker('refresh');
}

async function getStateOfOperationToBeEditAndOptions(countryCode, stateId, elementId) {
    const element_id = getId(elementId);
    !countryCode ? initialOption(null, 'Select Country First', element_id) : null;
    stateId === 'No States Found' ? initialOption('No States Found', 'No States Found', element_id) : null;

    const states = await fetchStates();
    const statesInCountry = states.filter((state) => state.country_code === countryCode);
    const selectedState = states.find((state) => state.id === parseInt(stateId));
    const statesToRender = statesInCountry.filter((state) => state.id !== parseInt(stateId));

    element_id.innerHTML = !stateId
        ? '<option value="">Select Country First</option>'
        : `<option value="${selectedState.id}">${selectedState.name}</option>`;

    businessStatesLocationForOfLoop(statesToRender, element_id);
}

countryForStateOperation.addEventListener('change', async () => {
    $('#traderStatesOfOperation').empty();
    const element_id = getId('traderStatesOfOperation');
    let countryCode = countryForStateOperation.value;

    const states = await fetchStates();
    let filtered = states.filter((d) => d.country_code === countryCode);

    if (filtered.length > 0) {
        optionsForOfLoop(filtered, element_id, 'id', 'name');
    } else {
        let option = document.createElement('option');
        option.value = 'No States Found';
        option.innerHTML = 'No States Found';
        element_id.appendChild(option);
    }

    $(element_id).selectpicker('refresh');
});

countryForCityOperation.addEventListener('change', async () => {
    // $('#traderCityOfOperation').empty();
    traderCityOfOperation.innerHTML = '';

    const statesForCityOperation = getId('statesForCityOperation');
    let countryCode = countryForCityOperation.value;
    getStatesUnderCountry(statesForCityOperation, countryCode);

    $(traderCityOfOperation).selectpicker('refresh');
});

async function getStatesUnderCountry(element_id, countryCode) {
    $(element_id).empty();
    const states = await fetchStates();
    let filtered = states.filter((d) => d.country_code === countryCode);
    if (filtered.length > 0) {
        optionsForOfLoop(filtered, statesForCityOperation, 'id', 'name');
    } else {
        let option = document.createElement('option');
        option.value = 'No States Found';
        option.innerHTML = 'No States Found';
        statesForCityOperation.appendChild(option);
    }
    $(element_id).selectpicker('refresh');
}

statesForCityOperation.addEventListener('change', async () => {
    let stateId = statesForCityOperation.value;
    getStatesUnderCountryAndStates(traderCityOfOperation, stateId);
});

async function getStatesUnderCountryAndStates(element_id, stateId) {
    $(element_id).empty();
    const cities = await fetchCities();
    const filteredCities = cities.filter((d) => d.state_id === parseInt(stateId));

    if (filteredCities.length > 0) {
        optionsForLoop(filteredCities, element_id, 'id', 'name');
    } else {
        let option = document.createElement('option');
        option.value = 'No Cities Found';
        option.innerHTML = 'No Cities Found';
        element_id.appendChild(option);
    }
    $(element_id).selectpicker('refresh');
}

function optionsForLoop(optionsToRender, selectElement, valueProperty, displayProperty) {
    selectElement.innerHTML = '';

    for (let i = 0; i < optionsToRender.length; i++) {
        const data = optionsToRender[i];
        const optionElement = document.createElement('option');
        optionElement.value = data[valueProperty];
        optionElement.textContent = data[displayProperty];
        selectElement.appendChild(optionElement);
    }
    $(selectElement).selectpicker('refresh');
}

btnRegionOfOperationUpdate.addEventListener('click', (e) => {
    //stop submit the form, we will post it manually.
    e.preventDefault();

    $.ajax({
        // url: '/api/v2/post/update-company-details',
        url: '/api/v2/update/region-of-operation',
        type: 'post',
        data: $editRegionOfOperation.serialize(),
    }).done((response) => {
        if (response === 'success') {
            Swal.fire('Success', 'Update Successful.', 'success');
            setTimeout(() => {
                location.replace(host + '/profile');
            }, 1500);
        } else {
            Swal.fire('Warning', 'Try again later or contact to the customer service.', 'warning');
        }
    });
});
//==============================================
// UPDATE COMPANY REGION OF OPERATION - [END]
//==============================================

async function getUsersLogoAndBanner() {
    try {
        const data = await $.ajax({
            url: API_URL.get_users_logo_and_banner,
            type: 'GET',
        });

        const firstData = data[0] || {};
        const { banner, logo, id } = firstData;

        if (banner) {
            companyBannerPreview.src = `${API_URL.users_upload_files}${banner}`;
        } else {
            companyBannerPreview.src = API_URL.banner_placeholder;
        }

        if (logo) {
            companyLogoPreview.src = `${API_URL.users_upload_files}${logo}`;
            userImage.src = `${API_URL.users_upload_files}${logo}`;
            isAvatar.src = `${API_URL.users_upload_files}${logo}`;
        } else {
            companyLogoPreview.src = API_URL.logo_placeholder;
            userImage.src = API_URL.logo_placeholder;
            isAvatar.src = API_URL.logo_placeholder;
        }

        companyLogoId.value = id;
        companyBannerId.value = id;
    } catch (error) {
        console.log(error);
    }
}

//====================
// BANNNER - START
//====================
companyBanner.onchange = (evt) => {
    const [file] = companyBanner.files;
    if (file) {
        companyBannerPreview.src = URL.createObjectURL(file);
        editcompanyBanner();
    }
};

function editcompanyBanner() {
    // Get form
    const form = $('#editcompanyBanner')[0];

    // Create an FormData object
    const data = new FormData(form);

    $.ajax({
        type: 'POST',
        enctype: 'multipart/form-data',
        url: API_URL.update_company_banner,
        data: data,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        async: true,
        success: function (data) {
            // some code here
        },
        // error: function (e) {},
        error: function (jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 413) {
                console.error('Request Entity Too Large');
                console.log('Request Entity Too Large');
                Swal.fire('Warning', 'Try to upload file image lower than 1mb', 'warning');
                // Handle error response
            }
        },
    });
}
//====================
// BANNNER - END
//====================

//====================
// LOGO - START
//====================
companyLogo.onchange = (evt) => {
    const [file] = companyLogo.files;
    if (file) {
        companyLogoPreview.src = URL.createObjectURL(file);
        editcompanyLogo();
    }
};

function editcompanyLogo() {
    // Get form
    const form = $('#editcompanyLogo')[0];

    // Create an FormData object
    const data = new FormData(form);

    $.ajax({
        type: 'POST',
        enctype: 'multipart/form-data',
        url: API_URL.update_company_logo,
        data: data,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        success: function (data) {
            // some code here
        },
        error: function (jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 413) {
                console.error('Request Entity Too Large');
                console.log('Request Entity Too Large');
                Swal.fire('Warning', 'Try to upload file image lower than 1mb', 'warning');
                // Handle error response
            }
        },
    });
}
//====================
// LOGO - END
//====================

//=================================
// THREE FUNCTION BUTTON - START
//=================================

const generateWaitingRoom = () => {
    fetch(API_URL.generate_waiting_room, {
        method: 'POST',
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.communicator) {
                window.open(API_URL.communicator_domain + data.communicator, '_blank');
            }
        })
        .catch((error) => console.error(error));
};

const createCommunicatorLink = () => {
    fetch(API_URL.create_communicator_link, {
        method: 'POST',
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.communicator) {
                window.open(API_URL.communicator_domain + data.communicator, '_blank');
            }
        })
        .catch((error) => console.error(error));
};

const downloadCurrentVisitorData = async () => {
    try {
        const response = await fetch(API_URL.get_current_visitor, {
            method: 'POST',
        });
        const res = await response.json();

        if (res.length > 0) {
            const result = await Swal.fire({
                title: 'Download?',
                text: 'Do you want to download visitor details?',
                icon: 'info',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, download!',
            });

            if (result.isConfirmed) {
                window.location = API_URL.download_current_visitor_data;
            }
        } else {
            Swal.fire('Success', 'Currently No Visitors', 'success');
        }
    } catch (error) {
        console.error(error);
    }
};

function paymentAccount() {
    $.ajax({
        url: API_URL.email_payment_account,
        type: 'POST',
        data: {
            email: sessionEmail,
        },
        success: function (data) {
            if (data === 'email sent') {
                Swal.fire('Success', 'Email Sent. Kindly check you email address inbox or spam folder', 'success');
            } else {
                Swal.fire('Warning', 'Email not sent. Report to customer service', 'warning');
            }
        },
        error: function (e) {
            // some code here
        },
    });
}

//==============================
// THREE FUNCTION BUTTON - END
//==============================

Promise.all([
    getCompanyDetails(),
    getUser(),
    getUsersAccount(),
    getUsersAddress(),
    getUsersBusinessCharacteristics(),
    getUsersLogoAndBanner(),
]);
