function getBusinessStatesLocationToBeEditAndOptions(value, elementId) {
    if (value[0].business_states == 'No States Found') {
        document.getElementById(elementId).innerHTML = '<option value="No States Found" >No States Found</option>';
    } else {
        fetch('assets/json/states.json')
            .then(function (resp) {
                return resp.json();
            })
            .then(function (data) {
                let state_code = value[0].business_states;
                let countryCode = value[0].business_country;

                let filtered = data.filter((d) => d.id == state_code);

                document.getElementById(elementId).innerHTML =
                    '<option value="' + filtered[0].id + '" >' + filtered[0].name + '</option>';

                for (var i = 0; i < data.length; i++) {
                    if (data[i].country_code === countryCode) {
                        let option = document.createElement('option');
                        option.value = data[i].id;
                        option.innerHTML = data[i].name;
                        document.getElementById(elementId).appendChild(option);
                    }

                    if (i + 1 == data.length) {
                        $('#' + elementId).selectpicker('refresh');
                    }
                }
            });
    }
}

function getUsersStatesLocationToBeEditAndOptions(value, elementId) {
    if (value[0].state_or_province == 'No States Found') {
        document.getElementById(elementId).innerHTML = '<option value="No States Found" >No States Found</option>';
    } else {
        fetch('assets/json/states.json')
            .then(function (resp) {
                return resp.json();
            })
            .then(function (data) {
                let state_code = value[0].state_or_province;
                let countryCode = value[0].country;

                let filtered = data.filter((d) => d.id == state_code);

                document.getElementById(elementId).innerHTML =
                    '<option value="' + filtered[0].id + '" >' + filtered[0].name + '</option>';

                for (var i = 0; i < data.length; i++) {
                    if (data[i].country_code === countryCode) {
                        let option = document.createElement('option');
                        option.value = data[i].id;
                        option.innerHTML = data[i].name;
                        document.getElementById(elementId).appendChild(option);
                    }

                    if (i + 1 == data.length) {
                        $('#' + elementId).selectpicker('refresh');
                    }
                }
            });
    }
}

//old version
// function getBusinessStatesLocationToBeEditAndOptions(value) {
//     fetch('assets/json/states.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let state_code = value[0].business_states;
//             let countryCode = value[0].business_country;

//             let filtered = data.filter((d) => d.id == state_code);

//             editBusinessStatesLocation.innerHTML =
//                 '<option value="' + filtered[0].id + '" >' + filtered[0].name + '</option>';

//             for (var i = 0; i < data.length; i++) {
//                 if (data[i].country_code === countryCode) {
//                     let option = document.createElement('option');
//                     option.value = data[i].id;
//                     option.innerHTML = data[i].name;
//                     editBusinessStatesLocation.appendChild(option);
//                 }
//             }
//         });
// }
