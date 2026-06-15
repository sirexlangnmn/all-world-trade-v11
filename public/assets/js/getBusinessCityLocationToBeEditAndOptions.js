function getBusinessCityLocationToBeEditAndOptions(value, elementId) {
    if (value[0].business_city == 'No Cities Found') {
        document.getElementById(elementId).innerHTML = '<option value="No Cities Found" >No Cities Found</option>';
    } else {
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

                    if (i + 1 == filtered2.length) {
                        $('#' + elementId).selectpicker('refresh');
                    }
                }
            });
    }
}

function getUsersCityLocationToBeEditAndOptions(value, elementId) {
    if (value[0].city == 'No Cities Found') {
        document.getElementById(elementId).innerHTML = '<option value="No Cities Found" >No Cities Found</option>';
    } else {
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

                    if (i + 1 == filtered2.length) {
                        $('#' + elementId).selectpicker('refresh');
                    }
                }
            });
    }
}

// to be delete

// function getBusinessCityLocationToBeEditAndOptions_new1(value) {
//     if (value[0].business_city == 'No Cities Found') {
//         editBusinessCityLocation.innerHTML = '<option value="No Cities Found" >No Cities Found</option>';
//     } else {
//         fetch('assets/json/cities.json')
//             .then(function (resp) {
//                 return resp.json();
//             })
//             .then(function (data) {
//                 let city_code = value[0].business_city;
//                 let state_code = value[0].business_states;
//                 let countryCode = value[0].business_country;

//                 let filtered = data.filter((d) => d.id == city_code);
//                 let filteredCity = data.filter((d) => d.state_id == state_code);

//                 editBusinessCityLocation.innerHTML =
//                     '<option value="' + filtered[0].id + '" >' + filtered[0].name + '</option>';

//                 for (var i = 0; i < filteredCity.length; i++) {
//                     let option = document.createElement('option');
//                     option.value = filteredCity[i].id;
//                     option.innerHTML = filteredCity[i].name;
//                     editBusinessCityLocation.appendChild(option);

//                     if (i + 1 == filteredCity.length) {
//                         $('#editBusinessCityLocation').selectpicker('refresh');
//                     }
//                 }
//             });
//     }
// }

// old version // to be delete

// function getBusinessCityLocationToBeEditAndOptions_old(value) {
//     fetch('assets/json/cities.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let state_code = value[0].business_states;
//             let countryCode = value[0].business_country;

//             let filtered = data.filter((d) => d.id == state_code);

//             editBusinessCityLocation.innerHTML =
//                 '<option value="' + filtered[0].id + '" >' + filtered[0].name + '</option>';

//             for (var i = 0; i < data.length; i++) {
//                 if (data[i].country_code === countryCode) {
//                     let option = document.createElement('option');
//                     option.value = data[i].id;
//                     option.innerHTML = data[i].name;
//                     editBusinessCityLocation.appendChild(option);
//                 }
//             }
//         });
// }
