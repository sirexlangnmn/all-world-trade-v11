// NOTE: This function getStatesOptions is officially for selection module only
// function getStatesOptions(countryElementId, stateElementId, cityElementId) {
//     $('#' + stateElementId).empty();
//     $('#' + cityElementId).empty();

//     let country_code = document.getElementById(countryElementId).value;

//     if (country_code) {
//         fetch('assets/json/states.json')
//             .then(function (resp) {
//                 return resp.json();
//             })
//             .then(function (data) {
//                 let filtered = data.filter((d) => d.country_code == country_code);

//                 if (filtered.length > 0) {
//                     document.getElementById(stateElementId).innerHTML = '<option value="" selected>Any</option>';
//                     for (var i = 0; i < filtered.length; i++) {
//                         document.getElementById(stateElementId).innerHTML =
//                             document.getElementById(stateElementId).innerHTML +
//                             '<option value="' +
//                             filtered[i].id +
//                             '">' +
//                             filtered[i].name +
//                             '</option>';
//                     }
//                 } else {
//                     let option = document.createElement('option');
//                     option.value = 'No States Found';
//                     option.innerHTML = 'No States Found';
//                     document.getElementById(stateElementId).appendChild(option);
//                 }

//                 $('#' + stateElementId).selectpicker('refresh');

//                 let state_id = document.getElementById(stateElementId).value;
//                 if (state_id === 'No States Found') {
//                     let option = document.createElement('option');
//                     option.value = 'No Cities Found';
//                     option.innerHTML = 'No Cities Found';
//                     document.getElementById(cityElementId).appendChild(option);
//                 } else {
//                     document.getElementById(cityElementId).innerHTML = '<option value="" selected>Any</option>';
//                 }

//                 $('#' + cityElementId).selectpicker('refresh');
//             });
//     } else {
//         document.getElementById(stateElementId).innerHTML = '<option value="" selected>Any</option>';
//         document.getElementById(cityElementId).innerHTML = '<option value="" selected>Any</option>';
//         $('#' + stateElementId).selectpicker('refresh');
//         $('#' + cityElementId).selectpicker('refresh');
//     }
// }
function getStatesOptions(countryElementId, stateElementId, cityElementId) {
    $('#' + stateElementId).empty();
    $('#' + cityElementId).empty();

    let country_code = document.getElementById(countryElementId).value;

    if (country_code) {
        fetch('assets/json/states.json')
            .then(function (resp) {
                return resp.json();
            })
            .then(function (data) {
                let filtered = data.filter((d) => d.country_code == country_code);

                if (filtered.length > 0) {
                    document.getElementById(stateElementId).innerHTML =
                        '<div class="filterByStateClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50" data-el="">Metro Manila</div>';
                    for (var i = 0; i < filtered.length; i++) {
                        if (filtered[i].id === 1347) {
                            document.getElementById(stateElementId).innerHTML +=
                                '<div class="filterByStateClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50" data-el="' +
                                filtered[i].id +
                                '">' +
                                filtered[i].name +
                                '</div>';
                        }
                    }

                    document.getElementById(cityElementId).innerHTML =
                        '<div class="filterByCityClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="">Any</div>';
                } else {
                    document.getElementById(stateElementId).innerHTML =
                        '<div class="filterByStateClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50" data-el="No States Found">No States Found</div>';
                    document.getElementById(cityElementId).innerHTML =
                        '<div class="filterByCityClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50" data-el="No Cities Found">No Cities Found</div>';
                    displaySelectedState.innerHTML = 'No States Found';
                    displaySelectedCity.innerHTML = 'No Cities Found';
                }

                $('#' + stateElementId).selectpicker('refresh');

                let state_id = selectedState.value;
                if (state_id === 'No States Found') {
                    document.getElementById(cityElementId).innerHTML =
                        '<div class="filterByCityClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50" data-el="No Cities Found">No Cities Found</div>';
                }
            });
    } else {
        displaySelectedState.innerHTML = 'Any';
        displaySelectedCity.innerHTML = 'Any';
        document.getElementById(stateElementId).innerHTML =
            '<div class="filterByStateClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="">Any</div>';
        document.getElementById(cityElementId).innerHTML =
            '<div class="filterByCityClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50 orbitron" data-el="">Any</div>';
    }
}

// NOTE: This function getCitiesOptions is officially for selection module only
// function getCitiesOptions(countryElementId, stateElementId, cityElementId) {
//     $('#' + cityElementId).empty();

//     fetch('assets/json/cities.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let country_code = document.getElementById(countryElementId).value;
//             let state_id = document.getElementById(stateElementId).value;
//             let filtered = data.filter((d) => d.country_code == country_code);

//             if (filtered.length > 0 && state_id != 'No States Found') {
//                 document.getElementById(cityElementId).innerHTML = '<option value="" selected>Any</option>';
//                 for (var i = 0; i < filtered.length; i++) {
//                     if (filtered[i].state_id == state_id) {
//                         document.getElementById(cityElementId).innerHTML =
//                             document.getElementById(cityElementId).innerHTML +
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
//                 document.getElementById(cityElementId).appendChild(option);
//             }

//             $('#' + cityElementId).selectpicker('refresh');
//         });
// }

function getCitiesOptions(countryElementId, stateElementId, cityElementId) {
    $('#' + cityElementId).empty();

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let country_code = document.getElementById(countryElementId).value;
            let state_id = document.getElementById(stateElementId).value;
            let filtered = data.filter((d) => d.country_code == country_code);

            if (filtered.length > 0 && state_id != 'No States Found' && state_id != '') {
                document.getElementById(cityElementId).innerHTML =
                    '<div class="filterByCityClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50" data-el="">Any</div>';
                for (var i = 0; i < filtered.length; i++) {
                    if (filtered[i].state_id == state_id) {
                        document.getElementById(cityElementId).innerHTML =
                            document.getElementById(cityElementId).innerHTML +
                            '<div class="filterByCityClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50" data-el="' +
                            filtered[i].id +
                            '">' +
                            filtered[i].name +
                            '</div>';
                    }
                }
            } else if (state_id === '') {
                displaySelectedCity.innerHTML = 'Any';
                document.getElementById(cityElementId).innerHTML =
                    '<div class="filterByCityClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50" data-el="">Any</div>';
            } else {
                displaySelectedCity.innerHTML = 'No Cities Found';
                document.getElementById(cityElementId).innerHTML =
                    '<div class="filterByCityClass text-md font-md text-white-900 dark:text-white-300 p-2 hover:bg-gray-50" data-el="No Cities Found">No Cities Found</div>';
            }
        });
}

function getStatesOptions2(countryElementId, stateElementId, cityElementId) {
    $('#' + stateElementId).empty();
    $('#' + cityElementId).empty();

    let country_code = document.getElementById(countryElementId).value;

    fetch('assets/json/states.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            // let filtered = data.filter((d) => d.country_code == traderBusinessCountryCode);
            let filtered = data.filter((d) => d.country_code == country_code);

            if (filtered.length) {
                for (var i = 0; i < filtered.length; i++) {
                    document.getElementById(stateElementId).innerHTML =
                        document.getElementById(stateElementId).innerHTML +
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
                document.getElementById(stateElementId).appendChild(option);
            }

            $('#' + stateElementId).selectpicker('refresh');
        });
}

function getCitiesOptions2(countryElementId, stateElementId, cityElementId) {
    $('#' + cityElementId).empty();

    fetch('assets/json/cities.json')
        .then(function (resp) {
            return resp.json();
        })
        .then(function (data) {
            let country_code = document.getElementById(countryElementId).value;
            let state_id = document.getElementById(stateElementId).value;
            let filtered = data.filter((d) => d.country_code == country_code);
            let filtered2 = filtered.filter((x) => x.state_id == state_id);

            if (filtered2.length) {
                for (var i = 0; i < filtered2.length; i++) {
                    document.getElementById(cityElementId).innerHTML =
                        document.getElementById(cityElementId).innerHTML +
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
                document.getElementById(cityElementId).appendChild(option);
            }

            // if (filtered.length) {
            //     let filteredCount = 0;
            //     for (var i = 0; i < filtered.length; i++) {
            //         if (filtered[i].state_id == state_id) {
            //             document.getElementById(cityElementId).innerHTML =
            //             document.getElementById(cityElementId).innerHTML + '<option value="' + filtered[i].id + '">' + filtered[i].name + '</option>';
            //                 filteredCount++;
            //         }
            //     }

            //     if (filteredCount === 0){
            //         let option = document.createElement('option');
            //         option.value = 'No Cities Found';
            //         option.innerHTML = 'No Cities Found';
            //         document.getElementById(cityElementId).appendChild(option);
            //     }
            // } else {
            //     let option = document.createElement('option');
            //     option.value = 'No Cities Found';
            //     option.innerHTML = 'No Cities Found';
            //     document.getElementById(cityElementId).appendChild(option);
            // }

            $('#' + cityElementId).selectpicker('refresh');
        });
}
