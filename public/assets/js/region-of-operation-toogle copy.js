const iOperateOnAWorldWideLevelRadioButton = getId('iOperateOnAWorldWideLevelRadioButton');
const iOperateOnAGlobalRegionalLevelRadioButton = getId('iOperateOnAGlobalRegionalLevelRadioButton');
const iOperateOnANationalLevelRadioButton = getId('iOperateOnANationalLevelRadioButton');
const iOperateOnAStateLevelRadioButton = getId('iOperateOnAStateLevelRadioButton');
const iOperateOnACityLevelRadioButton = getId('iOperateOnACityLevelRadioButton');

const traderRegionOfOperationValidation = getId('traderRegionOfOperationValidation');
const traderCountryOfOperationValidation = getId('traderCountryOfOperationValidation');
const traderStatesOfOperationValidation = getId('traderStatesOfOperationValidation');
const traderCityOfOperationValidation = getId('traderCityOfOperationValidation');

const divRegionOfOperation = getId('divRegionOfOperation');
const divCountryOfOperation = getId('divCountryOfOperation');
const divStatesOfOperation = getId('divStatesOfOperation');
const divCityOfOperation = getId('divCityOfOperation');

iOperateOnAWorldWideLevelRadioButton.checked = false;
iOperateOnAGlobalRegionalLevelRadioButton.checked = false;
iOperateOnANationalLevelRadioButton.checked = true;
iOperateOnAStateLevelRadioButton.checked = false;
iOperateOnACityLevelRadioButton.checked = false;

traderRegionOfOperationValidation.innerHTML = '';
traderCountryOfOperationValidation.innerHTML = '';
traderStatesOfOperationValidation.innerHTML = '';
traderCityOfOperationValidation.innerHTML = '';

divRegionOfOperation.style.display = 'none';
divCountryOfOperation.style.display = 'none';
divStatesOfOperation.style.display = 'none';
divCityOfOperation.style.display = 'none';

// Add event listeners to radio buttons
getId('iOperateOnAWorldWideLevelRadioButton').addEventListener(
    'change',
    universalToggleFunction.bind(null, 'iOperateOnAWorldWideLevelRadioButton'),
);
getId('iOperateOnAGlobalRegionalLevelRadioButton').addEventListener(
    'change',
    universalToggleFunction.bind(null, 'iOperateOnAGlobalRegionalLevelRadioButton'),
);
getId('iOperateOnANationalLevelRadioButton').addEventListener(
    'change',
    universalToggleFunction.bind(null, 'iOperateOnANationalLevelRadioButton'),
);
getId('iOperateOnAStateLevelRadioButton').addEventListener(
    'change',
    universalToggleFunction.bind(null, 'iOperateOnAStateLevelRadioButton'),
);
getId('iOperateOnACityLevelRadioButton').addEventListener(
    'change',
    universalToggleFunction.bind(null, 'iOperateOnACityLevelRadioButton'),
);

function universalToggleFunction(radioButtonId, event) {
    const radioButton = event.target;
    const radioButtonChecked = radioButton.checked;

    if (radioButtonChecked) {
        // Uncheck other radio buttons
        [
            'iOperateOnAWorldWideLevelRadioButton',
            'iOperateOnAGlobalRegionalLevelRadioButton',
            'iOperateOnANationalLevelRadioButton',
            'iOperateOnAStateLevelRadioButton',
            'iOperateOnACityLevelRadioButton',
        ]
            .filter((id) => id !== radioButtonId)
            .forEach((id) => {
                const otherRadioButton = getId(id);
                otherRadioButton.checked = false;
            });

        // Do something with the checked radio button
        console.log(`"${radioButtonId}" radio button is checked`);
    } else {
        // Do something when radio button is unchecked
        console.log(`"${radioButtonId}" radio button is unchecked`);
    }
}

// iOperateOnAWorldWideLevelRadioButton.addEventListener('change', universalToggleFunction.bind(iOperateOnAWorldWideLevelRadioButton, true));

// function universalToggleFunction(radioButtonId, boolean) {
//     const cb = getId(radioButtonId);
//     console.log('universalToggleFunction: cb: ', cb);
//     if (cb.checked) {
//         console.log('universalToggleFunction: yes');
//         console.log('universalToggleFunction: boolean', boolean);
//     } else {
//         console.log('universalToggleFunction: no');
//         console.log('universalToggleFunction: boolean', boolean);
//     }
// }

// function iOperateOnAWorldWideLevelFunction() {
//     const cb = document.querySelector('#iOperateOnAWorldWideLevelRadioButton');
//     if (cb.checked) {
//     } else {
//     }
// }

// iOperateOnAGlobalRegionalLevelRadioButton.addEventListener('change', iOperateOnAGlobalRegionalLevelFunction);
// function iOperateOnAGlobalRegionalLevelFunction() {
//     const cb = document.querySelector('#iOperateOnAGlobalRegionalLevelRadioButton');
//     if (cb.checked) {
//     } else {
//     }
// }

// document
//     .getElementById('iOperateOnANationalLevelRadioButton')
//     .addEventListener('change', iOperateOnANationalLevelFunction);
// function iOperateOnANationalLevelFunction() {
//     const cb = document.querySelector('#iOperateOnANationalLevelRadioButton');
//     if (cb.checked) {
//     } else {
//     }
// }

// document.getElementById('iOperateOnAStateLevelRadioButton').addEventListener('change', iOperateOnAStateLevelFunction);
// function iOperateOnAStateLevelFunction() {
//     const cb = document.querySelector('#iOperateOnAStateLevelRadioButton');
//     if (cb.checked) {
//     } else {
//     }
// }
