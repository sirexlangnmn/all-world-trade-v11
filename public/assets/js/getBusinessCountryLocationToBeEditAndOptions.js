// function getBusinessCountryLocationToBeEditAndOptions(value, elementId) {
//     fetch('assets/json/countries.json')
//         .then(function (resp) {
//             return resp.json();
//         })
//         .then(function (data) {
//             let code = value[0].business_country;
//             let filtered = data.filter((d) => d.iso2 == code);

//             document.getElementById(elementId).innerHTML =
//                 '<option value="' + filtered[0].iso2 + '" >' + filtered[0].name + '</option>';

//             for (var i = 0; i < data.length; i++) {
//                 document.getElementById(elementId).innerHTML =
//                     document.getElementById(elementId).innerHTML +
//                     '<option value="' +
//                     data[i].iso2 +
//                     '">' +
//                     data[i].name +
//                     '</option>';

//                 if (i + 1 == data.length) {
//                     $('#' + elementId).selectpicker('refresh');
//                 }
//             }
//         });
// }

async function getBusinessCountryLocationToBeEditAndOptions(value, elementId) {
    try {
        const resp = await fetch('assets/json/countries.json');
        const data = await resp.json();

        const code = value[0].business_country;
        const filtered = data.filter((d) => d.iso2 === code);

        const element = document.getElementById(elementId);
        element.innerHTML = `<option value="${filtered[0].iso2}">${filtered[0].name}</option>`;

        const options = data.filter((d) => d.iso2 !== code).map((d) => `<option value="${d.iso2}">${d.name}</option>`);
        element.innerHTML += options.join('');

        $(`#${elementId}`).selectpicker('refresh');
    } catch (error) {
        console.error(error);
    }
}
