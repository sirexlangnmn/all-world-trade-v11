$(function () {
    getUsersAddress();
    getBusinessLocationCode();
});

let editBusinessCountryLocation;
let editBusinessStatesLocation;
let editBusinessCityLocation;
let editRegionOfOperation;

let traderRegionOfOperation;
let traderCountryOfOperation;
let traderCountryOfOperation2;
let traderStatesOfOperation;
let traderCityOfOperation;

editBusinessCountryLocation = getId('editBusinessCountryLocation');
editBusinessStatesLocation = getId('editBusinessStatesLocation');
editBusinessCityLocation = getId('editBusinessCityLocation');
editRegionOfOperation = getId('editRegionOfOperation');

traderRegionOfOperation = getId('traderRegionOfOperation');
traderCountryOfOperation = getId('traderCountryOfOperation');
traderCountryOfOperation2 = getId('traderCountryOfOperation2');
traderStatesOfOperation = getId('traderStatesOfOperation');
traderCityOfOperation = getId('traderCityOfOperation');

function getBusinessLocationCode() {
    $.ajax({
        url: '/api/get/business-location-code',
        type: 'POST',
        success: function (data) {
            getBusinessCountryLocationToBeEditAndOptions(data, 'editBusinessCountryLocation');
            getBusinessStatesLocationToBeEditAndOptions(data, 'editBusinessStatesLocation');
            getBusinessCityLocationToBeEditAndOptions(data, 'editBusinessCityLocation');

            if (data[0].business_country == null || data[0].business_country == '') {
                document.getElementById('editBusinessCountryLocationValidation').innerHTML =
                    'Business Country Location is required';
            }
            if (data[0].business_states == null || data[0].business_states == '') {
                document.getElementById('editBusinessStatesLocationValidation').innerHTML =
                    'Business States Location is required';
            }
            if (data[0].business_city == null || data[0].business_city == '') {
                document.getElementById('editBusinessCityLocationValidation').innerHTML =
                    'Business City Location is required';
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

function getStatesNameToBeDisplayUsingCode(code, elementId) {
    if (code) {
        fetch('assets/json/states.json')
            .then(function (resp) {
                return resp.json();
            })
            .then(function (data) {
                let filtered = data.filter((d) => d.id == code);
                document.getElementById(elementId).innerHTML = filtered[0].name;
            });
    } else {
        document.getElementById(elementId).innerHTML = 'N/A';
    }
}

function getCityNameToBeDisplayUsingCode(code, elementId) {
    if (code) {
        fetch('assets/json/cities.json')
            .then(function (resp) {
                return resp.json();
            })
            .then(function (data) {
                let filtered = data.filter((d) => d.id == code);
                document.getElementById(elementId).innerHTML = filtered[0].name + ', ';
            });
    } else {
        document.getElementById(elementId).innerHTML = 'N/A, ';
    }
}

// consume api to get all trade categories
async function getRegionOfOperations() {
    let response = await fetch(host + '/api/get/region-of-operations');
    let data = await response.json();
    return data;
}

// display region of operations in frontend select option
getRegionOfOperations().then((data) => {
    traderRegionOfOperation.innerHTML = '<option value="">Select</option>';
    for (var i = 0; i < data.length; i++) {
        traderRegionOfOperation.innerHTML =
            traderRegionOfOperation.innerHTML +
            '<option value="' +
            data[i]['iso'] +
            '">' +
            data[i]['name'] +
            '</option>';
    }
});

fetch('assets/json/countries.json')
    .then(function (resp) {
        return resp.json();
    })
    .then(function (data) {
        traderCountryOfOperation.innerHTML = '<option value="" >Select</option>';
        for (var i = 0; i < data.length; i++) {
            traderCountryOfOperation.innerHTML =
                traderCountryOfOperation.innerHTML +
                '<option value="' +
                data[i].iso2 +
                '">' +
                data[i].name +
                '</option>';
        }
    });

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
            required('traderStatesOfOperation', 'traderStatesOfOperationValidation', 'States of operation is required');
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

traderStatesOfOperation.addEventListener('change', function () {
    $('#traderCityOfOperation').empty();
    let state_id = this.value;

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_id = traderStatesOfOperation.value;
            let traderCountryOfOperationCode = traderCountryOfOperation.value;
            let filtered = data.filter((d) => d.country_code == traderCountryOfOperationCode);
            let filtered2 = filtered.filter((x) => x.state_id == state_id);

            if (filtered2.length) {
                for (var i = 0; i < filtered2.length; i++) {
                    traderCityOfOperation.innerHTML =
                        traderCityOfOperation.innerHTML +
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
                traderCityOfOperation.appendChild(option);
            }

            $('#traderCityOfOperation').selectpicker('refresh');
        });
});
