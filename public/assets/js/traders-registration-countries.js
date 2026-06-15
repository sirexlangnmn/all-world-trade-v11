let traderBusinessCountryLocation;
let traderBusinessCityLocation;
let traderCountryofResidence;
let traderCityOfResidence;
let traderBusinessCityLocations;
let traderCityOfResidences;
let traderCountryOfOperation;
let traderCountryOfOperation2;
let traderStatesOfOperation;
let traderCityOfOperation;

traderBusinessCountryLocation = getId('traderBusinessCountryLocation');
traderBusinessCityLocation = getId('traderBusinessCityLocation');
traderCountryofResidence = getId('traderCountryofResidence');
traderCityOfResidence = getId('traderCityOfResidence');
traderBusinessCityLocations = getId('traderBusinessCityLocations');
traderCityOfResidences = getId('traderCityOfResidences');
traderCountryOfOperation = getId('traderCountryOfOperation');
traderCountryOfOperation2 = getId('traderCountryOfOperation2');
traderStatesOfOperation = getId('traderStatesOfOperation');
traderCityOfOperation = getId('traderCityOfOperation');

fetch('assets/json/countries.json')
    .then(function (resp) {
        return resp.json();
    })
    .then(function (data) {
        traderBusinessCountryLocation.innerHTML = '<option class="orbitron" value="" >Select</option>';
        for (var i = 0; i < data.length; i++) {
            traderBusinessCountryLocation.innerHTML =
                traderBusinessCountryLocation.innerHTML +
                '<option class="orbitron" value="' +
                data[i].iso2 +
                '">' +
                data[i].name +
                '</option>';
        }

        traderCountryofResidence.innerHTML = '<option value="" >Select</option>';
        for (var i = 0; i < data.length; i++) {
            traderCountryofResidence.innerHTML =
                traderCountryofResidence.innerHTML +
                '<option value="' +
                data[i].iso2 +
                '">' +
                data[i].name +
                '</option>';
        }

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

        $('#traderBusinessCountryLocation').selectpicker('refresh');
        $('#traderCountryofResidence').selectpicker('refresh');
        $('#traderCountryOfOperation').selectpicker('refresh');
        $('#traderCountryOfOperation2').selectpicker('refresh');
    });

// traderBusinessCountryLocation.addEventListener('change', function () {
//     $('#traderBusinessCityLocation').empty();
//     $('#traderBusinessCityLocations').empty();

//     let traderBusinessCountryCode = this.value;

//     fetch('assets/json/states.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

//             if (filtered.length) {
//                 for (var i = 0; i < filtered.length; i++) {
//                     traderBusinessCityLocation.innerHTML =
//                         traderBusinessCityLocation.innerHTML +
//                         '<option value="' +
//                         filtered[i].id +
//                         '">' +
//                         filtered[i].name +
//                         '</option>';
//                 }
//             } else {
//                 let option = document.createElement('option');
//                 option.value = 'No States Found';
//                 option.innerHTML = 'No States Found';
//                 traderBusinessCityLocation.appendChild(option);
//             }

//             $('#traderBusinessCityLocation').selectpicker('refresh');
//             required(
//                 traderBusinessCityLocation,
//                 traderBusinessCityLocationValidation,
//                 'Business City Location is required',
//             );
//         });

//     fetch('assets/json/cities.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let state_id = traderBusinessCityLocation.value;
//             let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

//             if (filtered.length) {
//                 for (var i = 0; i < filtered.length; i++) {
//                     if (filtered[i].state_id == state_id) {
//                         traderBusinessCityLocations.innerHTML =
//                             traderBusinessCityLocations.innerHTML +
//                             '<option value="' +
//                             filtered[i].id +
//                             '">' +
//                             filtered[i].name +
//                             '</option>';
//                     }
//                 }
//             } else {
//                 let option = document.createElement('option');
//                 option.value = 'No Cities Found';
//                 option.innerHTML = 'No Cities Found';
//                 traderBusinessCityLocations.appendChild(option);
//             }

//             $('#traderBusinessCityLocations').selectpicker('refresh');
//         });
// });

traderBusinessCountryLocation.addEventListener('change', function () {
    getStatesOptions2('traderBusinessCountryLocation', 'traderBusinessCityLocation', 'traderBusinessCityLocations');
    getCitiesOptions2('traderBusinessCountryLocation', 'traderBusinessCityLocation', 'traderBusinessCityLocations');
});

// traderBusinessCityLocation.addEventListener('change', function () {
//     $('#traderBusinessCityLocations').empty();

//     fetch('assets/json/cities.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let state_id = traderBusinessCityLocation.value;
//             let traderBusinessCountryCode = traderBusinessCountryLocation.value;
//             let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);
//             let filtered2 = filtered.filter((x) => x.state_id == state_id);

//             if (filtered2.length) {
//                 for (var i = 0; i < filtered2.length; i++) {
//                     traderBusinessCityLocations.innerHTML =
//                         traderBusinessCityLocations.innerHTML +
//                         '<option value="' +
//                         filtered2[i].id +
//                         '">' +
//                         filtered2[i].name +
//                         '</option>';
//                 }
//             } else {
//                 let option = document.createElement('option');
//                 option.value = 'No Cities Found';
//                 option.innerHTML = 'No Cities Found';
//                 traderBusinessCityLocations.appendChild(option);
//             }

//             $('#traderBusinessCityLocations').selectpicker('refresh');
//         });
// });

traderBusinessCityLocation.addEventListener('change', function () {
    getCitiesOptions2('traderBusinessCountryLocation', 'traderBusinessCityLocation', 'traderBusinessCityLocations');
});

// fetch('assets/json/countries.json')
//     .then(function (resp) {
//         return resp.json();
//     })
//     .then(function (data) {
//         traderCountryofResidence.innerHTML = '<option value="" >Select</option>';
//         for (var i = 0; i < data.length; i++) {
//             traderCountryofResidence.innerHTML =
//                 traderCountryofResidence.innerHTML +
//                 '<option value="' +
//                 data[i].iso2 +
//                 '">' +
//                 data[i].name +
//                 '</option>';
//         }
//     });

// traderCountryofResidence.addEventListener('change', function () {
//     $('#traderCityOfResidence').empty();
//     $('#traderCityOfResidences').empty();

//     let traderCountryofResidenceCode = this.value;

//     fetch('assets/json/states.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let filtered = data.filter((d) => d.country_code == traderCountryofResidenceCode);

//             if (filtered.length) {
//                 for (var i = 0; i < filtered.length; i++) {
//                     let option = document.createElement('option');
//                     option.value = filtered[i].id;
//                     option.innerHTML = filtered[i].name;
//                     traderCityOfResidence.appendChild(option);
//                 }
//             } else {
//                 let option = document.createElement('option');
//                 option.value = 'No States Found';
//                 option.innerHTML = 'No States Found';
//                 traderCityOfResidence.appendChild(option);
//             }

//             $('#traderCityOfResidence').selectpicker('refresh');
//             required(traderCityOfResidence, traderCityOfResidenceValidation, 'required');
//         });

//     fetch('assets/json/cities.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let state_id = traderCityOfResidence.value;
//             let filtered = data.filter((d) => d.country_code == traderCountryofResidenceCode);

//             if (filtered.length) {
//                 for (var i = 0; i < filtered.length; i++) {
//                     if (filtered[i].state_id == state_id) {
//                         let option = document.createElement('option');
//                         option.value = filtered[i].id;
//                         option.innerHTML = filtered[i].name;
//                         traderCityOfResidences.appendChild(option);
//                     }
//                 }
//             } else {
//                 let option = document.createElement('option');
//                 option.value = 'No Cities Found';
//                 option.innerHTML = 'No Cities Found';
//                 traderCityOfResidences.appendChild(option);
//             }

//             $('#traderCityOfResidences').selectpicker('refresh');
//         });
// });

traderCountryofResidence.addEventListener('change', function () {
    getStatesOptions2('traderCountryofResidence', 'traderCityOfResidence', 'traderCityOfResidences');
    getCitiesOptions2('traderCountryofResidence', 'traderCityOfResidence', 'traderCityOfResidences');
});

// traderCityOfResidence.addEventListener('change', function () {
//     $('#traderCityOfResidences').empty();

//     fetch('assets/json/cities.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let state_id = traderCityOfResidence.value;
//             let traderResidenceCountryCode = traderCountryofResidence.value;
//             let filtered = data.filter((d) => d.country_code == traderResidenceCountryCode);
//             let filtered2 = filtered.filter((x) => x.state_id == state_id);

//             if (filtered2.length) {
//                 for (var i = 0; i < filtered2.length; i++) {
//                     traderCityOfResidences.innerHTML =
//                         traderCityOfResidences.innerHTML +
//                         '<option value="' +
//                         filtered2[i].id +
//                         '">' +
//                         filtered2[i].name +
//                         '</option>';
//                 }
//             } else {
//                 let option = document.createElement('option');
//                 option.value = 'No Cities Found';
//                 option.innerHTML = 'No Cities Found';
//                 traderCityOfResidences.appendChild(option);
//             }

//             $('#traderCityOfResidences').selectpicker('refresh');
//         });
// });

// global operation

traderCityOfResidence.addEventListener('change', function () {
    getCitiesOptions2('traderCountryofResidence', 'traderCityOfResidence', 'traderCityOfResidences');
});

// fetch('assets/json/countries.json')
//     .then(function (resp) {
//         return resp.json();
//     })
//     .then(function (data) {
//         traderCountryOfOperation.innerHTML = '<option value="" >Select</option>';
//         for (var i = 0; i < data.length; i++) {
//             traderCountryOfOperation.innerHTML =
//                 traderCountryOfOperation.innerHTML +
//                 '<option value="' +
//                 data[i].iso2 +
//                 '">' +
//                 data[i].name +
//                 '</option>';
//         }
//     });

// fetch('assets/json/countries.json')
//     .then(function (resp) {
//         return resp.json();
//     })
//     .then(function (data) {
//         traderCountryOfOperation2.innerHTML = '<option value="" >Select Country (Prerequisite for State / Province) </option>';
//         for (var i = 0; i < data.length; i++) {
//             traderCountryOfOperation2.innerHTML =
//                 traderCountryOfOperation2.innerHTML +
//                 '<option value="' +
//                 data[i].iso2 +
//                 '">' +
//                 data[i].name +
//                 '</option>';
//         }
//     });

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
