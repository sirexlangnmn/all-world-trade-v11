function getBusinessCountryLocationToBeEditAndOptions(value, elementId) {
    fetch('assets/json/countries.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let countryCode = value[0].business_country;

            if (countryCode == null || countryCode == '') {
                document.getElementById(elementId).innerHTML = '<option value="" >Select</option>';
            } else {
                let filtered = data.filter((d) => d.iso2 == countryCode);

                document.getElementById(elementId).innerHTML =
                    '<option value="' + filtered[0].iso2 + '" >' + filtered[0].name + '</option>';
            }

            for (var i = 0; i < data.length; i++) {
                document.getElementById(elementId).innerHTML =
                    document.getElementById(elementId).innerHTML +
                    '<option value="' +
                    data[i].iso2 +
                    '">' +
                    data[i].name +
                    '</option>';
            }

            $('#' + elementId).selectpicker('refresh');
        });
}

function getBusinessStatesLocationToBeEditAndOptions(value, elementId) {
    fetch('assets/json/states.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let stateCode = value[0].business_states;
            let countryCode = value[0].business_country;

            if (countryCode || stateCode) {
                let filtered = data.filter((d) => d.country_code == countryCode);
                let filtered2 = filtered.filter((x) => x.id == stateCode);

                document.getElementById(elementId).innerHTML =
                    '<option value="' + filtered2[0].id + '" >' + filtered2[0].name + '</option>';

                for (var i = 0; i < filtered.length; i++) {
                    let option = document.createElement('option');
                    option.value = filtered[i].id;
                    option.innerHTML = filtered[i].name;
                    document.getElementById(elementId).appendChild(option);
                }
            }

            $('#' + elementId).selectpicker('refresh');
        });
}

function getBusinessCityLocationToBeEditAndOptions(value, elementId) {
    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let stateCode = value[0].business_states;
            let countryCode = value[0].business_country;

            if (countryCode || stateCode) {
                //let filtered2 = filtered.filter((x) => x.state_id == stateCode);
                let filtered = data.filter((d) => d.state_id == stateCode);
                let filtered2 = data.filter((d) => d.country_code == countryCode);
                let filtered3 = filtered.filter((x) => x.id == value[0].business_city);

                document.getElementById(elementId).innerHTML =
                    '<option value="' + filtered3[0].id + '" >' + filtered3[0].name + '</option>';

                for (var i = 0; i < filtered.length; i++) {
                    let option = document.createElement('option');
                    option.value = filtered[i].id;
                    option.innerHTML = filtered[i].name;
                    document.getElementById(elementId).appendChild(option);
                }
            }

            $('#' + elementId).selectpicker('refresh');
        });
}

function getCountryOfOperation(value, elementId) {
    fetch('assets/json/countries.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            if (value[0].country_of_operation == null || value[0].country_of_operation == '') {
                document.getElementById(elementId).innerHTML = '<option value="" >Select</option>';

                for (var i = 0; i < data.length; i++) {
                    document.getElementById(elementId).innerHTML =
                        document.getElementById(elementId).innerHTML +
                        '<option value="' +
                        data[i].iso2 +
                        '">' +
                        data[i].name +
                        '</option>';
                }
            } else {
                document.getElementById(elementId).innerHTML = '<option value="" >Select</option>';

                for (var i = 0; i < data.length; i++) {
                    let option = document.createElement('option');
                    option.value = data[i].iso2;
                    option.innerHTML = data[i].name;
                    document.getElementById(elementId).appendChild(option);
                }
            }

            $('#' + elementId).selectpicker('refresh');
        });
}

function getStatesOfOperation(value, elementId) {
    fetch('assets/json/states.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let stateCode = value[0].states_of_operation;
            let countryCode = value[0].country_of_operation;

            if (stateCode) {
                let filtered = data.filter((d) => d.country_code == countryCode);
                let filtered2 = filtered.filter((x) => x.id == stateCode);

                document.getElementById(elementId).innerHTML =
                    '<option value="' + filtered2[0].id + '" >' + filtered2[0].name + '</option>';

                for (var i = 0; i < filtered.length; i++) {
                    let option = document.createElement('option');
                    option.value = filtered[i].id;
                    option.innerHTML = filtered[i].name;
                    document.getElementById(elementId).appendChild(option);
                }
            } else {
                document.getElementById(elementId).innerHTML = '<option value="" >Select</option>';

                let filtered = data.filter((d) => d.country_code == countryCode);

                for (var i = 0; i < filtered.length; i++) {
                    let option = document.createElement('option');
                    option.value = filtered[i].id;
                    option.innerHTML = filtered[i].name;
                    document.getElementById(elementId).appendChild(option);
                }
            }

            $('#' + elementId).selectpicker('refresh');
        });
}

function getCityOfOperation(value, elementId) {
    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let stateCode = value[0].states_of_operation;
            let countryCode = value[0].country_of_operation;

            if (stateCode && countryCode) {
                let filtered = data.filter((d) => d.country_code == countryCode);
                let filtered2 = filtered.filter((x) => x.state_id == stateCode);

                document.getElementById(elementId).innerHTML = '<option value="" >Selec</option>';

                for (var i = 0; i < filtered2.length; i++) {
                    let option = document.createElement('option');
                    option.value = filtered2[i].id;
                    option.innerHTML = filtered2[i].name;
                    document.getElementById(elementId).appendChild(option);
                }
            } else {
                document.getElementById(elementId).innerHTML = '<option value="" >Select</option>';

                let filtered = data.filter((d) => d.country_code == value[0].countryCode);

                for (var i = 0; i < filtered.length; i++) {
                    let option = document.createElement('option');
                    option.value = filtered[i].id;
                    option.innerHTML = filtered[i].name;
                    document.getElementById(elementId).appendChild(option);
                }
            }

            $('#' + elementId).selectpicker('refresh');
        });
}

function getRegionOfOperationFunction(value, elementId) {
    // consume api to get all trade categories
    async function getRegionOfOperations() {
        let response = await fetch(host + '/api/get/region-of-operations');
        let data = await response.json();
        return data;
    }

    // display region of operations in frontend select option
    getRegionOfOperations().then((data) => {
        let regionOfOperation = value[0].region_of_operation;
        if (regionOfOperation == null || regionOfOperation.length == 0) {
            document.getElementById(elementId).innerHTML = '<option value="" >Select</option>';
        } else {
            let filtered = data.filter((d) => d.iso == regionOfOperation);
            document.getElementById(elementId).innerHTML =
                '<option value="' + filtered[0].iso + '" >' + filtered[0].name + '</option>';
        }

        for (var i = 0; i < data.length; i++) {
            let option = document.createElement('option');
            option.value = data[i].iso;
            option.innerHTML = data[i].name;
            document.getElementById(elementId).appendChild(option);
        }

        $('#' + elementId).selectpicker('refresh');
    });
}
