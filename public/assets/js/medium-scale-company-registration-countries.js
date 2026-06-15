let country;
let states;
let city;
let businessCountryLocation;
let businessStatesLocation;
let businessCityLocation;

country = getId('country');
states = getId('states');
city = getId('city');
businessCountryLocation = getId('businessCountryLocation');
businessStatesLocation = getId('businessStatesLocation');
businessCityLocation = getId('businessCityLocation');

fetch('assets/json/countries.json')
    .then(function (resp) {
        return resp.json();
    })
    .then(function (data) {
        country.innerHTML = '<option value="" >Select</option>';
        for (var i = 0; i < data.length; i++) {
            country.innerHTML =
                country.innerHTML + '<option value="' + data[i].iso2 + '">' + data[i].name + '</option>';
        }

        businessCountryLocation.innerHTML = '<option value="" >Select</option>';
        for (var i = 0; i < data.length; i++) {
            businessCountryLocation.innerHTML =
                businessCountryLocation.innerHTML +
                '<option value="' +
                data[i].iso2 +
                '">' +
                data[i].name +
                '</option>';
        }

        $('#businessCountryLocation').selectpicker('refresh');
        $('#country').selectpicker('refresh');
    });

// country.addEventListener('change', function () {
//     $('#states').empty();
//     $('#city').empty();

//     let traderBusinessCountryCode = this.value;
//     required(country, countryValidation, 'Business Country Location');

//     fetch('assets/json/states.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

//             if (filtered.length) {
//                 for (var i = 0; i < filtered.length; i++) {
//                     states.innerHTML =
//                         states.innerHTML + '<option value="' + filtered[i].id + '">' + filtered[i].name + '</option>';
//                 }
//             } else {
//                 let option = document.createElement('option');
//                 option.value = 'No States Found';
//                 option.innerHTML = 'No States Found';
//                 states.appendChild(option);
//             }

//             $('#states').selectpicker('refresh');
//             required(states, statesValidation, 'Business States Location');
//         });

//     fetch('assets/json/cities.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let state_id = states.value;
//             let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

//             if (filtered.length) {
//                 for (var i = 0; i < filtered.length; i++) {
//                     if (filtered[i].state_id == state_id) {
//                         city.innerHTML =
//                             city.innerHTML + '<option value="' + filtered[i].id + '">' + filtered[i].name + '</option>';
//                     }
//                 }
//             } else {
//                 let option = document.createElement('option');
//                 option.value = 'No Cities Found';
//                 option.innerHTML = 'No Cities Found';
//                 city.appendChild(option);
//             }

//             $('#city').selectpicker('refresh');
//             required(city, cityValidation, 'Business States Location');
//         });
// });

country.addEventListener('change', function () {
    getStatesOptions2('country', 'states', 'city');
    getCitiesOptions2('country', 'states', 'city');
});

// states.addEventListener('change', function () {
//     $('#city').empty();

//     fetch('assets/json/cities.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let state_id = states.value;
//             let traderBusinessCountryCode = country.value;
//             let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);
//             let filtered2 = filtered.filter((x) => x.state_id == state_id);

//             if (filtered2.length) {
//                 for (var i = 0; i < filtered2.length; i++) {
//                     city.innerHTML =
//                         city.innerHTML + '<option value="' + filtered2[i].id + '">' + filtered2[i].name + '</option>';
//                 }
//             } else {
//                 let option = document.createElement('option');
//                 option.value = 'No Cities Found';
//                 option.innerHTML = 'No Cities Found';
//                 city.appendChild(option);
//             }

//             $('#city').selectpicker('refresh');
//             required(city, cityValidation, 'Business States Location');
//         });
// });

states.addEventListener('change', function () {
    getCitiesOptions2('country', 'states', 'city');
});

// fetch('assets/json/countries.json')
//     .then(function (resp) {
//         return resp.json();
//     })
//     .then(function (data) {
//         businessCountryLocation.innerHTML = '<option value="" >Select</option>';
//         for (var i = 0; i < data.length; i++) {
//             businessCountryLocation.innerHTML =
//                 businessCountryLocation.innerHTML +
//                 '<option value="' +
//                 data[i].iso2 +
//                 '">' +
//                 data[i].name +
//                 '</option>';
//         }
//     });

// businessCountryLocation.addEventListener('change', function () {
//     $('#businessStatesLocation').empty();
//     $('#businessCityLocation').empty();

//     let traderBusinessCountryCode = this.value;
//     required(businessCountryLocation, businessCountryLocationValidation, 'Business Country Location');

//     fetch('assets/json/states.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

//             if (filtered.length) {
//                 for (var i = 0; i < filtered.length; i++) {
//                     businessStatesLocation.innerHTML =
//                         businessStatesLocation.innerHTML +
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
//                 businessStatesLocation.appendChild(option);
//             }

//             $('#businessStatesLocation').selectpicker('refresh');
//             required(businessStatesLocation, businessStatesLocationValidation, 'Business States Location');
//         });

//     fetch('assets/json/cities.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let state_id = businessStatesLocation.value;
//             let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

//             if (filtered.length) {
//                 for (var i = 0; i < filtered.length; i++) {
//                     if (filtered[i].state_id == state_id) {
//                         businessCityLocation.innerHTML =
//                             businessCityLocation.innerHTML +
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
//                 businessCityLocation.appendChild(option);
//             }

//             $('#businessCityLocation').selectpicker('refresh');
//             required(businessCityLocation, businessCityLocationValidation, 'Business City Location');
//         });
// });

businessCountryLocation.addEventListener('change', function () {
    getStatesOptions2('businessCountryLocation', 'businessStatesLocation', 'businessCityLocation');
    getCitiesOptions2('businessCountryLocation', 'businessStatesLocation', 'businessCityLocation');
});

// businessStatesLocation.addEventListener('change', function () {
//     $('#businessCityLocation').empty();

//     fetch('assets/json/cities.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let state_id = businessStatesLocation.value;
//             let traderBusinessCountryCode = businessCountryLocation.value;
//             let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);
//             let filtered2 = filtered.filter((x) => x.state_id == state_id);

//             if (filtered2.length) {
//                 for (var i = 0; i < filtered2.length; i++) {
//                     businessCityLocation.innerHTML =
//                         businessCityLocation.innerHTML +
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
//                 businessCityLocation.appendChild(option);
//             }

//             $('#businessCityLocation').selectpicker('refresh');
//             required(businessCityLocation, businessCityLocationValidation, 'Business City Location');
//         });
// });

businessStatesLocation.addEventListener('change', function () {
    getCitiesOptions2('businessCountryLocation', 'businessStatesLocation', 'businessCityLocation');
});
