$(function () {
    getUsersAddress();
    getCitiesOptionsStatic();
});

function getUsersAddress() {
    $.ajax({
        url: '/api/get/users-address',
        type: 'POST',
        success: function (data) {
            displayselectedRegionOfOperation.innerHTML = 'SouthEast Asia'; // 'Any'
            displaySelectedCountry.innerHTML = 'Philippines';
            displaySelectedState.innerHTML = 'Metro Manila';
            displaySelectedCity.innerHTML = 'Any';
            displaySelectedlanguage.innerHTML = 'Any';
            displaySelectedBusinessScale.innerHTML = 'Any';
            displaySelectedTradeCategories.innerHTML = 'Any';
            displaySelectedSubCategories.innerHTML = 'Any';
            displaySelectedMinorSubCategories.innerHTML = 'Any';

            selectionState.innerHTML +=
                '<div class="filterByStateClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="">Metro Manila</div>';
            // selectionCity.innerHTML += '<div class="filterByCityClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="">Any</div>';
            subCategories.innerHTML +=
                '<div class="filterBySubCategoryClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50" data-el="">Any</div>';
            minorSubCategories.innerHTML +=
                '<div class="filterByMinorSubCategoryClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50" data-el="">Any</div>';
            // selectedCountry.value = data[0].country;
            // selectedState.value = data[0].state_or_province;
            // selectedCity.value = data[0].city;

            getCountryOfOperation(data, 'selectionCountry');
            // getStatesLocation(data, 'selectionState');
            // getCityLocation(data, 'selectionCity');
        },
    });
}

function getCountryOfOperation(value, elementId) {
    fetch('assets/json/countries.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let selectionCountry;
            selectionCountry = getId(elementId);

            // let countryCode = value[0].country; //ni comment ko ito para hindi lumabas sa seleccion yung country ng user
            // let countryCode = null;
            let countryCode = 'PH';

            if (countryCode == null || countryCode == '') {
                displaySelectedCountry.innerHTML = 'Philippines';
                selectionCountry.innerHTML +=
                    '<div class="filterByCountryClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="">Philippines</div>';
            } else {
                let filtered = data.filter((d) => d.iso2 == countryCode);

                getCountryNameUsingCode(countryCode, 'displaySelectedCountry');

                selectionCountry.innerHTML +=
                    '<div class="filterByCountryClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="' +
                    filtered[0].iso2 +
                    '">' +
                    filtered[0].name +
                    '</div>';
                // selectionCountry.innerHTML +=
                //     '<div class="filterByCountryClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="">Any</div>';
            }

            for (var i = 0; i < data.length; i++) {
                if (data[i]['iso'] === 'PH') {
                    selectionCountry.innerHTML +=
                        '<div class="filterByCountryClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="' +
                        data[i].iso2 +
                        '">' +
                        data[i].name +
                        '</div>';
                }
            }
        });
}

function getStatesLocation(value, elementId) {
    if (value[0].state_or_province == 'No States Found') {
        displaySelectedState.innerHTML = 'No States Found';
        document.getElementById(elementId).innerHTML =
            '<div class="filterByStateClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="No States Found">No States Found</div>';
    } else {
        fetch('assets/json/states.json')
            .then(function (resp) {
                return resp.json();
            })
            .then(function (data) {
                let state_code = value[0].state_or_province;
                let countryCode = value[0].country;

                let filtered = data.filter((d) => d.id == state_code);

                getStatesNameToBeDisplayUsingCode(filtered[0].id, 'displaySelectedState');

                document.getElementById(elementId).innerHTML =
                    '<div class="filterByStateClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="' +
                    filtered[0].id +
                    '">' +
                    filtered[0].name +
                    '</div>';

                for (var i = 0; i < data.length; i++) {
                    if (data[i].country_code === countryCode) {
                        document.getElementById(elementId).innerHTML +=
                            '<div class="filterByStateClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="' +
                            data[i].id +
                            '">' +
                            data[i].name +
                            '</div>';
                    }
                }
            });
    }
}

function getCityLocation(value, elementId) {
    if (value[0].city == 'No Cities Found') {
        displaySelectedCity.innerHTML = 'No Cities Found';
        document.getElementById(elementId).innerHTML =
            '<div class="filterByCityClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="No Cities Found">No Cities Found</div>';
    } else {
        fetch('assets/json/cities.json')
            .then(function (resp) {
                return resp.json();
            })
            .then(function (data) {
                let filtered = data.filter((d) => d.country_code == value[0].country);
                let filtered2 = filtered.filter((x) => x.state_id == value[0].state_or_province);
                let filtered3 = filtered.filter((x) => x.id == value[0].city);

                getCityNameToBeDisplayUsingCode(filtered3[0].id, 'displaySelectedCity');

                document.getElementById(elementId).innerHTML =
                    '<div class="filterByCityClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="' +
                    filtered3[0].id +
                    '">' +
                    filtered3[0].name +
                    '</div>';

                for (var i = 0; i < filtered2.length; i++) {
                    document.getElementById(elementId).innerHTML +=
                        '<div class="filterByCityClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="' +
                        filtered2[i].id +
                        '">' +
                        filtered2[i].name +
                        '</div>';

                    if (i + 1 == data.length) {
                        // $('#' + elementId).selectpicker('refresh');
                    }
                }
            });
    }
}

// consume api to get all global region
async function getGlobalRegion() {
    let response = await fetch(host + '/api/get/region-of-operations');
    let data = await response.json();
    return data;
}

// display all trade categories in frontend select option
// getGlobalRegion().then((data) => {
//     selectionRegionOfOperation.innerHTML +=
//         '<div class="filterByRegionOfOperationClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="">Any</div>';

//     for (var i = 0; i < data.length; i++) {
//         selectionRegionOfOperation.innerHTML +=
//             '<div class="filterByRegionOfOperationClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="' +
//             data[i]['iso'] +
//             '">' +
//             data[i]['name'] +
//             '</div>';
//     }
// });

// display southeast asia only
getGlobalRegion().then((data) => {
    selectionRegionOfOperation.innerHTML += '';

    for (var i = 0; i < data.length; i++) {
        if (data[i]['iso'] === 'SouthEast Asia') {
            selectionRegionOfOperation.innerHTML +=
                '<div class="filterByRegionOfOperationClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="' +
                data[i]['iso'] +
                '">' +
                data[i]['name'] +
                '</div>';
        }
    }
});

document.addEventListener(
    'click',
    function (e) {
        if (has_class(e.target, 'filterByRegionOfOperationClass')) {
            displayselectedRegionOfOperation.innerHTML = e.target.getAttribute('data-el')
                ? e.target.getAttribute('data-el')
                : 'SouthEast Asia'; //Any
            selectedRegionOfOperation.value = e.target.getAttribute('data-el');
            carouselOptionsRemoveActiveClass('filterByRegionOfOperationClass');
            e.target.classList.add('bg-gray-200');
            selectionSearchParameter();
            closeAccordion('selectionRegionOfOperationAccordion');
        }
        if (has_class(e.target, 'filterByCountryClass')) {
            if (e.target.getAttribute('data-el')) {
                getCountryNameUsingCode(e.target.getAttribute('data-el'), 'displaySelectedCountry');
            } else {
                displaySelectedCountry.innerHTML = 'Philippines';
            }

            selectedCountry.value = e.target.getAttribute('data-el');
            carouselOptionsRemoveActiveClass('filterByCountryClass');
            e.target.classList.add('bg-gray-200');
            selectedState.value = '';
            selectedCity.value = '';
            displaySelectedState.innerHTML = 'Metro Manila';
            displaySelectedCity.innerHTML = 'Any';
            // getStatesOptions('selectedCountry', 'selectionState', 'selectionCity');
            closeAccordion('selectionCountryAccordion');
            setTimeout(() => {
                selectionSearchParameter();
            }, 500);
        }
        if (has_class(e.target, 'filterByStateClass')) {
            if (e.target.getAttribute('data-el')) {
                getStatesNameToBeDisplayUsingCode(e.target.getAttribute('data-el'), 'displaySelectedState');
            } else {
                displaySelectedState.innerHTML = 'Metro Manila';
            }

            selectedState.value = e.target.getAttribute('data-el');
            carouselOptionsRemoveActiveClass('filterByStateClass');
            e.target.classList.add('bg-gray-200');
            displaySelectedCity.innerHTML = '';
            selectedCity.value = '';
            displaySelectedCity.innerHTML = 'Metro Manila';
            // getCitiesOptions('selectedCountry', 'selectedState', 'selectionCity');
            closeAccordion('selectionStateAccordion');
            setTimeout(() => {
                selectionSearchParameter();
            }, 500);
        }
        if (has_class(e.target, 'filterByCityClass')) {
            if (e.target.getAttribute('data-el')) {
                getCityNameToBeDisplayUsingCode(e.target.getAttribute('data-el'), 'displaySelectedCity');
            } else {
                displaySelectedCity.innerHTML = 'Any';
            }

            selectedCity.value = e.target.getAttribute('data-el');
            carouselOptionsRemoveActiveClass('filterByCityClass');
            e.target.classList.add('bg-gray-200');
            selectionSearchParameter();
            closeAccordion('selectionCityAccordion');
        }
        if (has_class(e.target, 'filterByLanguageClass')) {
            displaySelectedlanguage.innerHTML = e.target.getAttribute('data-el')
                ? getLanguageNameByCode(e.target.getAttribute('data-el'))
                : 'Any';

            selectedLanguage.value = e.target.getAttribute('data-el');
            carouselOptionsRemoveActiveClass('filterByLanguageClass');
            e.target.classList.add('bg-gray-200');
            selectionSearchParameter();
            closeAccordion('selectionLanguageAccordion');
        }
        if (has_class(e.target, 'filterByBusinessScaleClass')) {
            console.log(
                'displaySelectedBusinessScale e.target.getAttribute(data-el)',
                e.target.getAttribute('data-el'),
            );
            console.log(
                'displaySelectedBusinessScale getBusinessScaleTitle(e.target.getAttribute',
                getBusinessScaleTitle(e.target.getAttribute('data-el')),
            );
            displaySelectedBusinessScale.innerHTML = e.target.getAttribute('data-el')
                ? getBusinessScaleTitle(e.target.getAttribute('data-el'))
                : 'Any';

            selectedBusinessScale.value = e.target.getAttribute('data-el');
            carouselOptionsRemoveActiveClass('filterByBusinessScaleClass');
            e.target.classList.add('bg-gray-200');
            selectionSearchParameter();
            closeAccordion('selectionBusinessScaleAccordion');
        }
        if (has_class(e.target, 'filterByTradeCategoryClass')) {
            selectedSubCategories.value = '';
            selectedMinorSubCategories.value = '';

            displaySelectedTradeCategories.innerHTML = e.target.getAttribute('data-el')
                ? getTradeCategoriesTitleById(e.target.getAttribute('data-el'))
                : 'Any';

            if (e.target.getAttribute('data-el') == 'Trade Everyday') {
                selectedTradeCategories.value = '';
            } else if (e.target.getAttribute('data-el') != 'Trade Everyday' || e.target.getAttribute('data-el') != '') {
                selectedTradeCategories.value = e.target.getAttribute('data-el');
            } else {
                selectedTradeCategories.value = '';
            }
            getSubCategory('selectedTradeCategories', 'sub-categories');
            minorSubCategories.innerHTML = '';
            minorSubCategories.innerHTML = 'Any';
            carouselOptionsRemoveActiveClass('filterByTradeCategoryClass');
            e.target.classList.add('bg-gray-200');
            selectionSearchParameter();
            closeAccordion('selectionTradeCategoriesAccordion');
        }
        if (has_class(e.target, 'filterBySubCategoryClass')) {
            selectedMinorSubCategories.value = '';
            displaySelectedMinorSubCategories.innerHTML = 'Any';

            displaySelectedSubCategories.innerHTML = e.target.getAttribute('data-el')
                ? getSubCategoriesTitleById(e.target.getAttribute('data-el'))
                : 'Any';

            selectedSubCategories.value = e.target.getAttribute('data-el');
            getMinorCategory('selectedSubCategories', 'minor-sub-categories');
            carouselOptionsRemoveActiveClass('filterBySubCategoryClass');
            e.target.classList.add('bg-gray-200');
            selectionSearchParameter();
            closeAccordion('selectionSubCategoriesAccordion');
        }
        if (has_class(e.target, 'filterByMinorSubCategoryClass')) {
            displaySelectedMinorSubCategories.innerHTML = e.target.getAttribute('data-el')
                ? getMinorSubCategoriesTitleById(e.target.getAttribute('data-el'))
                : 'Any';
            selectedMinorSubCategories.value = e.target.getAttribute('data-el');
            carouselOptionsRemoveActiveClass('filterByMinorSubCategoryClass');
            e.target.classList.add('bg-gray-200');
            selectionSearchParameter();
            closeAccordion('selectionMinorSubCategoriesAccordion');
        }

        // else if (has_class(e.target, 'test')) {
        // }
    },
    false,
);

// function has_class(elem, className) {
//     // console.log('elem', elem);
//     // console.log('className', className);
//     // console.log('elem.className.split', elem.className.split(' ').indexOf(className) > -1);
//     return elem.className.split(' ').indexOf(className) > -1;
// }

function has_class(elem, className) {
    try {
        return elem.className.split(' ').indexOf(className) > -1;
    } catch (error) {
        //   console.error('Error in has_class function:', error);
        return false;
    }
}

function carouselOptionsRemoveActiveClass(className) {
    var elements = document.querySelectorAll('.' + className);
    for (var i = 0; i < elements.length; i++) {
        elements[i].classList.remove('bg-gray-200');
    }
}

function closeAccordion(elementId) {
    div = document.getElementById(elementId);
    div.classList.remove('uk-open');
}
