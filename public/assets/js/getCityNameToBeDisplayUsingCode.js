function getCityNameToBeDisplayUsingCode(code, elementId) {
    if (code) {
        if (code === 'No Cities Found') {
            document.getElementById(elementId).innerHTML = ',';
        } else {
            fetch('assets/json/cities.json')
                .then(function (resp) {
                    return resp.json();
                })
                .then(function (data) {
                    let filtered = data.filter((d) => d.id == code);
                    if (filtered.length > 0) {
                        document.getElementById(elementId).innerHTML = filtered[0].name + ', ';
                    } else {
                        document.getElementById(elementId).innerHTML = '';
                    }
                });
        }
    } else {
        document.getElementById(elementId).innerHTML = ',';
    }
}

// old version
// function getCityNameToBeDisplayUsingCode(code, elementId) {
//     if (code) {
//         fetch('assets/json/cities.json')
//             .then(function (resp) {
//                 return resp.json();
//             })
//             .then(function (data) {
//                 let filtered = data.filter((d) => d.id == code);
//                 document.getElementById(elementId).innerHTML = filtered[0].name + ', ';
//             });
//     } else {
//         document.getElementById(elementId).innerHTML = 'N/A, ';
//     }
// }
