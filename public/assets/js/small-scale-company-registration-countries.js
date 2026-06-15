let country;
let states;
let city;

country = getId('country');
states = getId('states');
city = getId('city');

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
        $('#country').selectpicker('refresh');
    });

// country.addEventListener('change', function () {
//     $('#states').empty();
//     $('#city').empty();

//     let traderBusinessCountryCode = this.value;

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
//             //required(states, statesValidation, 'Business City Location is required');
//         });

//     fetch('assets/json/cities.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let state_id = states.value;
//             let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);

//             if (filtered.length) {

//                 let filteredCount = 0;
//                 for (var i = 0; i < filtered.length; i++) {
//                     if (filtered[i].state_id == state_id) {
//                         city.innerHTML =
//                             city.innerHTML + '<option value="' + filtered[i].id + '">' + filtered[i].name + '</option>';
//                             filteredCount++;
//                     }
//                 }

//                 if (filteredCount === 0){
//                     let option = document.createElement('option');
//                     option.value = 'No Cities Found';
//                     option.innerHTML = 'No Cities Found';
//                     city.appendChild(option);
//                 }
//             } else {
//                 let option = document.createElement('option');
//                 option.value = 'No Cities Found';
//                 option.innerHTML = 'No Cities Found';
//                 city.appendChild(option);
//             }

//             $('#city').selectpicker('refresh');
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
//         });
// });

states.addEventListener('change', function () {
    getCitiesOptions2('country', 'states', 'city');
});
