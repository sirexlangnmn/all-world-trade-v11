function getStatesNameToBeDisplayUsingCode(code, elementId) {
    if (code) {
        if (code === 'No States Found') {
            document.getElementById(elementId).innerHTML = ' ';
        } else {
            fetch('assets/json/states.json')
                .then(function (resp) {
                    return resp.json();
                })
                .then(function (data) {
                    let filtered = data.filter((d) => d.id == code);
                    document.getElementById(elementId).innerHTML = filtered[0].name;
                });
        }
    } else {
        document.getElementById(elementId).innerHTML = ' ';
    }
}

// old version
// function getStatesNameToBeDisplayUsingCode(code, elementId) {
//     if (code) {
//         fetch('assets/json/states.json')
//             .then(function (resp) {
//                 return resp.json();
//             })
//             .then(function (data) {
//                 let filtered = data.filter((d) => d.id == code);
//                 document.getElementById(elementId).innerHTML = filtered[0].name;
//             });
//     } else {
//         document.getElementById(elementId).innerHTML = 'N/A';
//     }
// }
