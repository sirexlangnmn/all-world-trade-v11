$(function () {
    getUsersAddress();
});

function getUsersAddress() {
    $.ajax({
        url: '/api/get/users-address',
        type: 'POST',
        success: function (data) {
            getCountryLocation(data, 'country');
            getStatesLocation(data, 'states');
            getCityLocation(data, 'city');
        },
    });
}

function getCountryLocation(value, elementId) {
    fetch('assets/json/countries.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.iso2 == value[0].country);

            document.getElementById(elementId).innerHTML =
                '<option value="' + filtered[0].iso2 + '" >' + filtered[0].name + '</option>';

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

function getStatesLocation(value, elementId) {
    fetch('assets/json/states.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.country_code == value[0].country);
            let filtered2 = filtered.filter((x) => x.id == value[0].state_or_province);

            document.getElementById(elementId).innerHTML =
                '<option value="' + filtered2[0].id + '" >' + filtered2[0].name + '</option>';

            for (var i = 0; i < filtered.length; i++) {
                let option = document.createElement('option');
                option.value = filtered[i].id;
                option.innerHTML = filtered[i].name;
                document.getElementById(elementId).appendChild(option);
            }

            $('#' + elementId).selectpicker('refresh');
        });
}

function getCityLocation(value, elementId) {
    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.country_code == value[0].country);
            let filtered2 = filtered.filter((x) => x.state_id == value[0].state_or_province);
            let filtered3 = filtered.filter((x) => x.id == value[0].city);

            document.getElementById(elementId).innerHTML =
                '<option value="' + filtered3[0].id + '" >' + filtered3[0].name + '</option>';

            for (var i = 0; i < filtered2.length; i++) {
                let option = document.createElement('option');
                option.value = filtered2[i].id;
                option.innerHTML = filtered2[i].name;
                document.getElementById(elementId).appendChild(option);
            }

            $('#' + elementId).selectpicker('refresh');
        });
}

function getBusinessCountryLocationToBeEditAndOptions(value, elementId) {
    fetch('assets/json/countries.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            if (value[0].business_country) {
                let filtered = data.filter((d) => d.iso2 == value[0].business_country);

                document.getElementById(elementId).innerHTML =
                    '<option value="' + filtered[0].iso2 + '" >' + filtered[0].name + '</option>';
            } else {
                document.getElementById(elementId).innerHTML = '<option value="" disabled>Select</option>';
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
            let filtered = data.filter((d) => d.country_code == value[0].business_country);
            let filtered2 = filtered.filter((x) => x.id == value[0].business_states);

            document.getElementById(elementId).innerHTML =
                '<option value="' + filtered2[0].id + '" >' + filtered2[0].name + '</option>';

            for (var i = 0; i < filtered.length; i++) {
                let option = document.createElement('option');
                option.value = filtered[i].id;
                option.innerHTML = filtered[i].name;
                document.getElementById(elementId).appendChild(option);
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
            let filtered = data.filter((d) => d.country_code == value[0].business_country);
            let filtered2 = filtered.filter((x) => x.state_id == value[0].business_states);
            let filtered3 = filtered.filter((x) => x.id == value[0].business_city);

            document.getElementById(elementId).innerHTML =
                '<option value="' + filtered3[0].id + '" >' + filtered3[0].name + '</option>';

            for (var i = 0; i < filtered2.length; i++) {
                let option = document.createElement('option');
                option.value = filtered2[i].id;
                option.innerHTML = filtered2[i].name;
                document.getElementById(elementId).appendChild(option);
            }

            $('#' + elementId).selectpicker('refresh');
        });
}

document.getElementById('businessCountryLocation').addEventListener('change', function () {
    $('#businessStatesLocation').empty();
    $('#businessCityLocation').empty();

    let traderBusinessCountryCode = this.value;

    fetch('assets/json/states.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    document.getElementById('businessStatesLocation').innerHTML =
                        document.getElementById('businessStatesLocation').innerHTML +
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
                document.getElementById('businessStatesLocation').appendChild(option);
            }

            $('#businessStatesLocation').selectpicker('refresh');
        });

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_id = document.getElementById('businessStatesLocation').value;
            let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    if (filtered[i].state_id == state_id) {
                        document.getElementById('businessCityLocation').innerHTML =
                            document.getElementById('businessCityLocation').innerHTML +
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
                document.getElementById('businessCityLocation').appendChild(option);
            }

            $('#businessCityLocation').selectpicker('refresh');
        });
});

document.getElementById('country').addEventListener('change', function () {
    $('#states').empty();
    $('#city').empty();

    let traderBusinessCountryCode = this.value;

    fetch('assets/json/states.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    document.getElementById('states').innerHTML =
                        document.getElementById('states').innerHTML +
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
                document.getElementById('states').appendChild(option);
            }

            $('#states').selectpicker('refresh');
        });

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_id = document.getElementById('states').value;
            let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    if (filtered[i].state_id == state_id) {
                        document.getElementById('city').innerHTML =
                            document.getElementById('city').innerHTML +
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
                document.getElementById('city').appendChild(option);
            }

            $('#city').selectpicker('refresh');
        });
});

document.getElementById('businessStatesLocation').addEventListener('change', function () {
    $('#businessCityLocation').empty();

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_id = document.getElementById('businessStatesLocation').value;
            let traderResidenceCountryCode = document.getElementById('businessCountryLocation').value;
            let filtered = data.filter((d) => d.country_code == traderResidenceCountryCode);
            let filtered2 = filtered.filter((x) => x.state_id == state_id);

            if (filtered2.length) {
                for (var i = 0; i < filtered2.length; i++) {
                    document.getElementById('businessCityLocation').innerHTML =
                        document.getElementById('businessCityLocation').innerHTML +
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
                document.getElementById('businessCityLocation').appendChild(option);
            }

            $('#businessCityLocation').selectpicker('refresh');
        });
});

document.getElementById('states').addEventListener('change', function () {
    $('#city').empty();

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let state_id = document.getElementById('states').value;
            let traderResidenceCountryCode = document.getElementById('country').value;
            let filtered = data.filter((d) => d.country_code == traderResidenceCountryCode);
            let filtered2 = filtered.filter((x) => x.state_id == state_id);

            if (filtered2.length) {
                for (var i = 0; i < filtered2.length; i++) {
                    document.getElementById('city').innerHTML =
                        document.getElementById('city').innerHTML +
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
                document.getElementById('city').appendChild(option);
            }

            $('#city').selectpicker('refresh');
        });
});
