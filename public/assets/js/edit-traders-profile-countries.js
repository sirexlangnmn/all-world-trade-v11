$(function () {
    getUsersAddress();
    getBusinessLocationCode();
    getBusinessVisibility();
});

let editBusinessCountryLocation;
let editBusinessStatesLocation;
let editBusinessCityLocation;

// let editRegionOfOperation;
let traderRegionOfOperation;
// let countryOfOperation;
let traderCountryOfOperation;
let traderCountryOfOperation2;
// let statesOfOperation;
let traderStatesOfOperation;
// let cityOfOperation;
let traderCityOfOperation;

editBusinessCountryLocation = getId('editBusinessCountryLocation');
editBusinessStatesLocation = getId('editBusinessStatesLocation');
editBusinessCityLocation = getId('editBusinessCityLocation');

//editRegionOfOperation = getId('editRegionOfOperation');
traderRegionOfOperation = getId('traderRegionOfOperation');
// countryOfOperation = getId('countryOfOperation');
traderCountryOfOperation = getId('traderCountryOfOperation');
traderCountryOfOperation2 = getId('traderCountryOfOperation2');
// statesOfOperation = getId('statesOfOperation');
traderStatesOfOperation = getId('traderStatesOfOperation');
// cityOfOperation = getId('cityOfOperation');
traderCityOfOperation = getId('traderCityOfOperation');

function getBusinessLocationCode() {
    $.ajax({
        url: '/api/get/business-location-code',
        type: 'POST',
        success: function (data) {
            getBusinessCountryLocationToBeEditAndOptions(data, 'editBusinessCountryLocation');
            getBusinessStatesLocationToBeEditAndOptions(data, 'editBusinessStatesLocation');
            getBusinessCityLocationToBeEditAndOptions(data, 'editBusinessCityLocation');
            getRegionOfOperationFunction(data);
            getCountryOfOperation(data);
            getCountryForState(data);
            getStatesOfOperation(data);
            getCityOfOperation(data);
        },
    });
}

function getBusinessVisibility() {
    $.ajax({
        url: '/api/get/users-business-visibility',
        type: 'POST',
        success: function (data) {
            if (data[0].i_operate_on_a_world_wide_level == 1) {
                document.getElementById('iOperateOnAWorldWideLevelRadioButton').checked = true;
                document.getElementById('iOperateOnAGlobalRegionalLevelRadioButton').checked = false;
                document.getElementById('iOperateOnANationalLevelRadioButton').checked = false;
                document.getElementById('iOperateOnAStateLevelRadioButton').checked = false;

                document.getElementById('editRegionOfOperationInput').style.display = 'none';
                document.getElementById('editRegionOfOperationPlaceholder').style.display = 'block';
                document.getElementById('countryOfOperationInput').style.display = 'none';
                document.getElementById('countryOfOperationPlaceholder').style.display = 'block';
                document.getElementById('statesOfOperationInput').style.display = 'none';
                document.getElementById('statesOfOperationPlaceholder').style.display = 'block';
                document.getElementById('cityOfOperationInput').style.display = 'none';
                document.getElementById('cityOfOperationPlaceholder').style.display = 'block';
            }
            if (data[0].i_operate_on_a_global_regional_level == 1) {
                document.getElementById('iOperateOnAWorldWideLevelRadioButton').checked = false;
                document.getElementById('iOperateOnAGlobalRegionalLevelRadioButton').checked = true;
                document.getElementById('iOperateOnANationalLevelRadioButton').checked = false;
                document.getElementById('iOperateOnAStateLevelRadioButton').checked = false;

                document.getElementById('iOperateOnAGlobalRegionalLevelDiv').style.display = 'block';
                document.getElementById('editRegionOfOperationInput').style.display = 'block';
                document.getElementById('editRegionOfOperationPlaceholder').style.display = 'none';

                document.getElementById('editRegionOfOperationInput').style.display = 'block';
                document.getElementById('editRegionOfOperationPlaceholder').style.display = 'none';
                document.getElementById('countryOfOperationInput').style.display = 'none';
                document.getElementById('countryOfOperationPlaceholder').style.display = 'block';
                document.getElementById('statesOfOperationInput').style.display = 'none';
                document.getElementById('statesOfOperationPlaceholder').style.display = 'block';
                document.getElementById('cityOfOperationInput').style.display = 'none';
                document.getElementById('cityOfOperationPlaceholder').style.display = 'block';
            }
            if (data[0].i_operate_on_a_national_level == 1) {
                document.getElementById('iOperateOnAWorldWideLevelRadioButton').checked = false;
                document.getElementById('iOperateOnAGlobalRegionalLevelRadioButton').checked = false;
                document.getElementById('iOperateOnANationalLevelRadioButton').checked = true;
                document.getElementById('iOperateOnAStateLevelRadioButton').checked = false;

                document.getElementById('editRegionOfOperationInput').style.display = 'none';
                document.getElementById('editRegionOfOperationPlaceholder').style.display = 'block';
                document.getElementById('countryOfOperationInput').style.display = 'block';
                document.getElementById('countryOfOperationInput2').style.display = 'none';
                document.getElementById('countryOfOperationPlaceholder').style.display = 'none';
                document.getElementById('statesOfOperationInput').style.display = 'none';
                document.getElementById('statesOfOperationPlaceholder').style.display = 'block';
                document.getElementById('cityOfOperationInput').style.display = 'none';
                document.getElementById('cityOfOperationPlaceholder').style.display = 'block';
            }
            if (data[0].i_operate_on_a_state_level == 1) {
                document.getElementById('iOperateOnAWorldWideLevelRadioButton').checked = false;
                document.getElementById('iOperateOnAGlobalRegionalLevelRadioButton').checked = false;
                document.getElementById('iOperateOnANationalLevelRadioButton').checked = false;
                document.getElementById('iOperateOnAStateLevelRadioButton').checked = true;

                document.getElementById('editRegionOfOperationInput').style.display = 'none';
                document.getElementById('editRegionOfOperationPlaceholder').style.display = 'block';
                document.getElementById('countryOfOperationInput').style.display = 'none';
                document.getElementById('countryOfOperationInput2').style.display = 'block';
                document.getElementById('countryOfOperationPlaceholder').style.display = 'none';
                document.getElementById('statesOfOperationInput').style.display = 'block';
                document.getElementById('statesOfOperationPlaceholder').style.display = 'none';
                document.getElementById('cityOfOperationInput').style.display = 'none';
                document.getElementById('cityOfOperationPlaceholder').style.display = 'block';
            }
            if (data[0].i_operate_on_a_city_level == 1) {
                document.getElementById('iOperateOnAWorldWideLevelRadioButton').checked = false;
                document.getElementById('iOperateOnAGlobalRegionalLevelRadioButton').checked = false;
                document.getElementById('iOperateOnANationalLevelRadioButton').checked = false;
                document.getElementById('iOperateOnAStateLevelRadioButton').checked = false;
            }
        },
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

// function getRegionOfOperationFunction(value) {
//     // consume api to get all trade categories
//     async function getRegionOfOperations() {
//         let response = await fetch(host + '/api/get/region-of-operations');
//         let data = await response.json();
//         return data;
//     }

//     // display region of operations in frontend select option
//     getRegionOfOperations().then((data) => {
//         let regionOfOperationCode = value[0].region_of_operation;

//         traderRegionOfOperation.innerHTML = '';
//         if (regionOfOperationCode) {
//             let arr = regionOfOperationCode.split(',');
//             for (var i = 0; i < data.length; i++) {
//                 for (var x = 0; x < arr.length; x++) {
//                     if (arr[x] == data[i]['iso']) {
//                         traderRegionOfOperation.innerHTML =
//                             traderRegionOfOperation.innerHTML +
//                             '<option value="' +
//                             data[i]['iso'] +
//                             '" selected>' +
//                             data[i]['name'] +
//                             '</option>';
//                     }
//                 }

//                 if (i + 1 == data.length) {
//                     getRegionOfOperationOption();
//                 }
//             }
//         } else {
//             getRegionOfOperationOption();
//         }
//     });
// }

function getRegionOfOperationFunction(value) {
    // consume api to get all region of operations
    async function getRegionOfOperations() {
        let response = await fetch(host + '/api/get/region-of-operations');
        let data = await response.json();
        return data;
    }

    // display region of operations in frontend select option
    getRegionOfOperations().then((data) => {
        let regionOfOperationCode = value[0].region_of_operation;

        traderRegionOfOperation.innerHTML = '';

        // If regionOfOperationCode is not null or empty, add selected options first
        if (regionOfOperationCode) {
            let arr = regionOfOperationCode.split(',');

            for (var i = 0; i < data.length; i++) {
                if (arr.includes(data[i]['iso'])) {
                    traderRegionOfOperation.innerHTML +=
                        '<option value="' + data[i]['iso'] + '" selected>' + data[i]['name'] + '</option>';
                }
            }
        }

        // Add remaining options
        for (var i = 0; i < data.length; i++) {
            if (regionOfOperationCode && regionOfOperationCode.includes(data[i]['iso'])) {
                // Skip already added options
                continue;
            }
            traderRegionOfOperation.innerHTML +=
                '<option value="' + data[i]['iso'] + '">' + data[i]['name'] + '</option>';
        }

        // Refresh selectpicker
        $(traderRegionOfOperation).selectpicker('refresh');
    });
}

function getRegionOfOperationOption() {
    // consume api to get all trade categories
    async function getRegionOfOperations() {
        let response = await fetch(host + '/api/get/region-of-operations');
        let data = await response.json();
        return data;
    }

    // display region of operations in frontend select option
    getRegionOfOperations().then((data) => {
        for (var i = 0; i < data.length; i++) {
            let option = document.createElement('option');
            option.value = data[i].iso;
            option.innerHTML = data[i].name;
            traderRegionOfOperation.appendChild(option);
        }
        $('#traderRegionOfOperation').selectpicker('refresh');
    });
}

function getCountryOfOperation(value) {
    fetch('assets/json/countries.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let code = value[0].country_of_operation;

            if (code) {
                let arr = code.split(',');
                for (var i = 0; i < data.length; i++) {
                    for (var x = 0; x < arr.length; x++) {
                        if (arr[x] == data[i]['iso2']) {
                            traderCountryOfOperation.innerHTML =
                                traderCountryOfOperation.innerHTML +
                                '<option value="' +
                                data[i]['iso2'] +
                                '" selected>' +
                                data[i]['name'] +
                                '</option>';
                        }
                    }
                    if (i + 1 == data.length) {
                        getCountryOfOperationOption();
                    }
                }
            } else {
                getCountryOfOperationOption();
            }
        });
}

function getCountryOfOperationOption() {
    fetch('assets/json/countries.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            for (var i = 0; i < data.length; i++) {
                let option = document.createElement('option');
                option.value = data[i].iso2;
                option.innerHTML = data[i].name;
                traderCountryOfOperation.appendChild(option);
            }
            $('#traderCountryOfOperation').selectpicker('refresh');
        });
}

function getCountryForState(value) {
    fetch('assets/json/countries.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let code = value[0].country_for_state;

            if (code) {
                let filtered = data.filter((d) => d.iso2 == code);

                traderCountryOfOperation2.innerHTML =
                    '<option value="' + filtered[0].iso2 + '" >' + filtered[0].name + '</option>';

                for (var i = 0; i < data.length; i++) {
                    traderCountryOfOperation2.innerHTML =
                        traderCountryOfOperation2.innerHTML +
                        '<option value="' +
                        data[i].iso2 +
                        '">' +
                        data[i].name +
                        '</option>';
                }
            } else {
                for (var i = 0; i < data.length; i++) {
                    traderCountryOfOperation2.innerHTML =
                        traderCountryOfOperation2.innerHTML +
                        '<option value="' +
                        data[i].iso2 +
                        '">' +
                        data[i].name +
                        '</option>';
                }
            }

            $('#traderCountryOfOperation2').selectpicker('refresh');
        });
}

fetch('assets/json/countries.json')
    .then(function (resp) {
        return resp.json();
    })
    .then(function (data) {
        traderCountryOfOperation2.innerHTML =
            '<option value="" >Select Country (Prerequisite for State / Province) </option>';
        for (var i = 0; i < data.length; i++) {
            traderCountryOfOperation2.innerHTML =
                traderCountryOfOperation2.innerHTML +
                '<option value="' +
                data[i].iso2 +
                '">' +
                data[i].name +
                '</option>';
        }
        $('#traderCountryOfOperation2').selectpicker('refresh');
    });

traderCountryOfOperation2.addEventListener('change', function () {
    $('#traderStatesOfOperation').empty();
    $('#traderCityOfOperation').empty();

    let traderCountryOfOperationCode = this.value;

    fetch('assets/json/states.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.country_code == traderCountryOfOperationCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    let option = document.createElement('option');
                    option.value = filtered[i].id;
                    option.innerHTML = filtered[i].name;
                    traderStatesOfOperation.appendChild(option);
                }
            } else {
                let option = document.createElement('option');
                option.value = 'No States Found';
                option.innerHTML = 'No States Found';
                traderStatesOfOperation.appendChild(option);
            }

            $('#traderStatesOfOperation').selectpicker('refresh');
            required(traderStatesOfOperation, traderStatesOfOperationValidation, 'required');
        });

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_id = traderStatesOfOperation.value;
            let filtered = data.filter((d) => d.country_code == traderCountryOfOperationCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    if (filtered[i].state_id == state_id) {
                        let option = document.createElement('option');
                        option.value = filtered[i].id;
                        option.innerHTML = filtered[i].name;
                        traderCityOfOperation.appendChild(option);
                    }
                }
            } else {
                let option = document.createElement('option');
                option.value = 'No Cities Found';
                option.innerHTML = 'No Cities Found';
                traderCityOfOperation.appendChild(option);
            }

            $('#traderCityOfOperation').selectpicker('refresh');
        });
});

function getStatesOfOperation(value) {
    fetch('assets/json/states.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_code = value[0].states_of_operation;
            let countryCode = value[0].country_of_operation;

            if (state_code) {
                let filtered = data.filter((d) => d.id == state_code);
                traderStatesOfOperation.innerHTML =
                    '<option value="' + filtered[0].id + '" >' + filtered[0].name + '</option>';

                for (var i = 0; i < data.length; i++) {
                    if (data[i].country_code === countryCode) {
                        let option = document.createElement('option');
                        option.value = data[i].id;
                        option.innerHTML = data[i].name;
                        traderStatesOfOperation.appendChild(option);
                    }
                }
            } else {
                traderStatesOfOperation.innerHTML = '<option value="" >Select</option>';

                for (var i = 0; i < data.length; i++) {
                    if (data[i].country_code === countryCode) {
                        let option = document.createElement('option');
                        option.value = data[i].id;
                        option.innerHTML = data[i].name;
                        traderStatesOfOperation.appendChild(option);
                    }
                }
            }

            $('#traderStatesOfOperation').selectpicker('refresh');
        });
}

function getCityOfOperation(value) {
    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_code = value[0].states_of_operation;
            let countryCode = value[0].country_of_operation;

            if (state_code && countryCode) {
                let filtered = data.filter((d) => d.country_code == countryCode);
                let filtered2 = filtered.filter((x) => x.state_id == state_code);

                traderCityOfOperation.innerHTML = '<option value="" >Select</option>';

                for (var i = 0; i < filtered2.length; i++) {
                    let option = document.createElement('option');
                    option.value = filtered2[i].id;
                    option.innerHTML = filtered2[i].name;
                    traderCityOfOperation.appendChild(option);
                }
            }
        });
}

function getCountryNameUsingCode(code, elementId) {
    if (code) {
        fetch('assets/json/countries.json')
            .then(function (resp) {
                return resp.json();
            })
            .then(function (data) {
                let filtered = data.filter((d) => d.iso2 == code);
                document.getElementById(elementId).innerHTML = filtered[0].name;
            });
    } else {
        document.getElementById(elementId).innerHTML = 'N/A';
    }
}

function getUsersAddress() {
    $.ajax({
        url: '/api/get/users-address',
        type: 'POST',
        success: function (data) {
            document.getElementById('displayReprestativeAddress').innerHTML = data[0].address;
            getCityNameToBeDisplayUsingCode(data[0].city, 'displayReprestativeAddressCity');
            getStatesNameToBeDisplayUsingCode(data[0].state_or_province, 'displayReprestativeAddressStates');
            getCountryNameUsingCode(data[0].country, 'displayReprestativeAddressCountry');
        },
    });
}
