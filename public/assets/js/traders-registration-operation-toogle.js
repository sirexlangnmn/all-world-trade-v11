// document.getElementById('editRegionOfOperationDiv').style.display = 'none';
// document.getElementById('iOperateOnAGlobalRegionalLevelDiv').style.display = 'none';
// document.getElementById('countryOfOperationDiv').style.display = 'none';
// document.getElementById('iOperateOnANationalLevelDiv').style.display = 'none';
// document.getElementById('statesOfOperationDiv').style.display = 'none';
// document.getElementById('iOperateOnAProvincialLevelDiv').style.display = 'none';
// document.getElementById('cityOfOperationDiv').style.display = 'none';
// document.getElementById('editRegionOfOperationPlaceholder').style.display = 'none';

document.getElementById('iOperateOnAWorldWideLevelRadioButton').checked = false;
document.getElementById('iOperateOnAGlobalRegionalLevelRadioButton').checked = false;
document.getElementById('iOperateOnANationalLevelRadioButton').checked = true;
document.getElementById('iOperateOnAStateLevelRadioButton').checked = false;

document.getElementById('traderRegionOfOperationValidation').innerHTML = '';
document.getElementById('traderCountryOfOperationValidation').innerHTML = '';
document.getElementById('traderStatesOfOperationValidation').innerHTML = '';
document.getElementById('traderCityOfOperationValidation').innerHTML = '';

document.getElementById('editRegionOfOperationInput').style.display = 'none';
document.getElementById('editRegionOfOperationPlaceholder').style.display = 'block';
document.getElementById('countryOfOperationInput').style.display = 'block';
document.getElementById('countryOfOperationPlaceholder').style.display = 'none';
document.getElementById('statesOfOperationInput').style.display = 'none';
document.getElementById('statesOfOperationPlaceholder').style.display = 'block';
document.getElementById('cityOfOperationInput').style.display = 'none';
document.getElementById('cityOfOperationPlaceholder').style.display = 'block';

document
    .getElementById('iOperateOnAWorldWideLevelRadioButton')
    .addEventListener('change', iOperateOnAWorldWideLevelFunction);
function iOperateOnAWorldWideLevelFunction() {
    const cb = document.querySelector('#iOperateOnAWorldWideLevelRadioButton');
    if (cb.checked) {
        //document.getElementById('iOperateOnAWorldWideLevelRadioButton').checked = false;
        document.getElementById('iOperateOnAGlobalRegionalLevelRadioButton').checked = false;
        document.getElementById('iOperateOnANationalLevelRadioButton').checked = false;
        document.getElementById('iOperateOnAStateLevelRadioButton').checked = false;

        document.getElementById('traderRegionOfOperationValidation').innerHTML = '';
        document.getElementById('traderCountryOfOperationValidation').innerHTML = '';
        document.getElementById('traderStatesOfOperationValidation').innerHTML = '';
        document.getElementById('traderCityOfOperationValidation').innerHTML = '';

        document.getElementById('editRegionOfOperationInput').style.display = 'none';
        document.getElementById('editRegionOfOperationPlaceholder').style.display = 'block';
        document.getElementById('countryOfOperationInput').style.display = 'none';
        document.getElementById('countryOfOperationPlaceholder').style.display = 'block';
        document.getElementById('statesOfOperationInput').style.display = 'none';
        document.getElementById('statesOfOperationPlaceholder').style.display = 'block';
        document.getElementById('cityOfOperationInput').style.display = 'none';
        document.getElementById('cityOfOperationPlaceholder').style.display = 'block';

        // document.getElementById('editRegionOfOperationDiv').style.display = 'none';
        // document.getElementById('iOperateOnAGlobalRegionalLevelDiv').style.display = 'none';
        // document.getElementById('countryOfOperationDiv').style.display = 'none';
        // document.getElementById('iOperateOnANationalLevelDiv').style.display = 'none';
        // document.getElementById('statesOfOperationDiv').style.display = 'none';
        // document.getElementById('iOperateOnAProvincialLevelDiv').style.display = 'none';
        // document.getElementById('cityOfOperationDiv').style.display = 'none';
        //document.getElementById('iOperateOnAWorldWideLevelRadioButton').checked = false;
    } else {
        //document.getElementById('iOperateOnAWorldWideLevelRadioButton').checked = false;
        document.getElementById('iOperateOnAGlobalRegionalLevelRadioButton').checked = false;
        document.getElementById('iOperateOnANationalLevelRadioButton').checked = false;
        document.getElementById('iOperateOnAStateLevelRadioButton').checked = false;

        // document.getElementById('editRegionOfOperationDiv').style.display = 'block';
        // document.getElementById('editRegionOfOperation').disabled = false;
        // document.getElementById('iOperateOnAGlobalRegionalLevelDiv').style.display = 'block';
    }
}

document
    .getElementById('iOperateOnAGlobalRegionalLevelRadioButton')
    .addEventListener('change', iOperateOnAGlobalRegionalLevelFunction);
function iOperateOnAGlobalRegionalLevelFunction() {
    const cb = document.querySelector('#iOperateOnAGlobalRegionalLevelRadioButton');
    if (cb.checked) {
        document.getElementById('traderRegionOfOperationValidation').innerHTML = 'Region of Operation is required';

        document.getElementById('iOperateOnAWorldWideLevelRadioButton').checked = false;
        // document.getElementById('iOperateOnAGlobalRegionalLevelRadioButton').checked = false;
        document.getElementById('iOperateOnANationalLevelRadioButton').checked = false;
        document.getElementById('iOperateOnAStateLevelRadioButton').checked = false;

        // document.getElementById('editRegionOfOperationDiv').style.display = 'block';
        // document.getElementById('editRegionOfOperation').disabled = false;
        document.getElementById('iOperateOnAGlobalRegionalLevelDiv').style.display = 'block';
        document.getElementById('editRegionOfOperationInput').style.display = 'block';
        document.getElementById('editRegionOfOperationPlaceholder').style.display = 'none';

        // document.getElementById('editRegionOfOperationDiv').style.display = 'none';
        // document.getElementById('editRegionOfOperation').disabled = true;
        //document.getElementById('iOperateOnAGlobalRegionalLevelDiv').style.display = 'none';
        //document.getElementById('editRegionOfOperationPlaceholder').style.display = 'block';

        // document.getElementById('countryOfOperationDiv').style.display = 'none';
        // document.getElementById('iOperateOnANationalLevelDiv').style.display = 'none';
        // document.getElementById('statesOfOperationDiv').style.display = 'none';
        // document.getElementById('iOperateOnAProvincialLevelDiv').style.display = 'none';
        // document.getElementById('cityOfOperationDiv').style.display = 'none';
        document.getElementById('traderRegionOfOperationValidation').innerHTML = '';
        document.getElementById('traderCountryOfOperationValidation').innerHTML = '';
        document.getElementById('traderStatesOfOperationValidation').innerHTML = '';
        document.getElementById('traderCityOfOperationValidation').innerHTML = '';

        document.getElementById('editRegionOfOperationInput').style.display = 'block';
        document.getElementById('editRegionOfOperationPlaceholder').style.display = 'none';
        document.getElementById('countryOfOperationInput').style.display = 'none';
        document.getElementById('countryOfOperationPlaceholder').style.display = 'block';
        document.getElementById('statesOfOperationInput').style.display = 'none';
        document.getElementById('statesOfOperationPlaceholder').style.display = 'block';
        document.getElementById('cityOfOperationInput').style.display = 'none';
        document.getElementById('cityOfOperationPlaceholder').style.display = 'block';
    } else {
        document.getElementById('traderRegionOfOperationValidation').innerHTML = '';

        document.getElementById('iOperateOnAWorldWideLevelRadioButton').checked = false;
        //document.getElementById('iOperateOnAGlobalRegionalLevelRadioButton').checked = false;
        document.getElementById('iOperateOnANationalLevelRadioButton').checked = false;
        document.getElementById('iOperateOnAStateLevelRadioButton').checked = false;

        // document.getElementById('editRegionOfOperationDiv').style.display = 'block';
        // document.getElementById('editRegionOfOperation').disabled = true;
        document.getElementById('editRegionOfOperationPlaceholder').style.display = 'block';
        document.getElementById('editRegionOfOperationInput').style.display = 'none';

        // document.getElementById('iOperateOnAGlobalRegionalLevelDiv').style.display = 'block';
        // document.getElementById('countryOfOperationDiv').style.display = 'block';
        // document.getElementById('iOperateOnANationalLevelDiv').style.display = 'block';
        // document.getElementById('statesOfOperationDiv').style.display = 'block';
        // document.getElementById('iOperateOnAProvincialLevelDiv').style.display = 'block';
        // document.getElementById('cityOfOperationDiv').style.display = 'block';
    }
}

document
    .getElementById('iOperateOnANationalLevelRadioButton')
    .addEventListener('change', iOperateOnANationalLevelFunction);
function iOperateOnANationalLevelFunction() {
    const cb = document.querySelector('#iOperateOnANationalLevelRadioButton');
    if (cb.checked) {
        document.getElementById('iOperateOnAWorldWideLevelRadioButton').checked = false;
        document.getElementById('iOperateOnAGlobalRegionalLevelRadioButton').checked = false;
        //document.getElementById('iOperateOnANationalLevelRadioButton').checked = false;
        document.getElementById('iOperateOnAStateLevelRadioButton').checked = false;

        // document.getElementById('countryOfOperationDiv').style.display = 'none';
        // document.getElementById('iOperateOnANationalLevelDiv').style.display = 'none';
        // document.getElementById('statesOfOperationDiv').style.display = 'none';
        // document.getElementById('iOperateOnAProvincialLevelDiv').style.display = 'none';
        // document.getElementById('cityOfOperationDiv').style.display = 'none';

        document.getElementById('traderRegionOfOperationValidation').innerHTML = '';
        document.getElementById('traderCountryOfOperationValidation').innerHTML = '';
        document.getElementById('traderStatesOfOperationValidation').innerHTML = '';
        document.getElementById('traderCityOfOperationValidation').innerHTML = '';

        document.getElementById('editRegionOfOperationInput').style.display = 'none';
        document.getElementById('editRegionOfOperationPlaceholder').style.display = 'block';
        document.getElementById('countryOfOperationInput').style.display = 'block';
        document.getElementById('countryOfOperationInput2').style.display = 'none';
        document.getElementById('countryOfOperationPlaceholder').style.display = 'none';
        document.getElementById('statesOfOperationInput').style.display = 'none';
        document.getElementById('statesOfOperationPlaceholder').style.display = 'block';
        document.getElementById('cityOfOperationInput').style.display = 'none';
        document.getElementById('cityOfOperationPlaceholder').style.display = 'block';
    } else {
        //getBusinessLocationCodeRefresh();
        document.getElementById('iOperateOnAWorldWideLevelRadioButton').checked = false;
        document.getElementById('iOperateOnAGlobalRegionalLevelRadioButton').checked = false;
        //document.getElementById('iOperateOnANationalLevelRadioButton').checked = false;
        document.getElementById('iOperateOnAStateLevelRadioButton').checked = false;

        // document.getElementById('countryOfOperationDiv').style.display = 'block';
        // document.getElementById('iOperateOnANationalLevelDiv').style.display = 'block';
        // document.getElementById('statesOfOperationDiv').style.display = 'block';
        // document.getElementById('iOperateOnAProvincialLevelDiv').style.display = 'block';
        //document.getElementById('cityOfOperationDiv').style.display = 'block';
        document.getElementById('editRegionOfOperationInput').style.display = 'none';
        document.getElementById('editRegionOfOperationPlaceholder').style.display = 'block';
        document.getElementById('countryOfOperationInput').style.display = 'block';
        document.getElementById('countryOfOperationInput2').style.display = 'none';
        document.getElementById('countryOfOperationPlaceholder').style.display = 'none';
        document.getElementById('statesOfOperationInput').style.display = 'block';
        document.getElementById('statesOfOperationPlaceholder').style.display = 'none';
        document.getElementById('cityOfOperationInput').style.display = 'block';
        document.getElementById('cityOfOperationPlaceholder').style.display = 'none';
    }
}

document.getElementById('iOperateOnAStateLevelRadioButton').addEventListener('change', iOperateOnAStateLevelFunction);
function iOperateOnAStateLevelFunction() {
    const cb = document.querySelector('#iOperateOnAStateLevelRadioButton');
    if (cb.checked) {
        document.getElementById('iOperateOnAWorldWideLevelRadioButton').checked = false;
        document.getElementById('iOperateOnAGlobalRegionalLevelRadioButton').checked = false;
        document.getElementById('iOperateOnANationalLevelRadioButton').checked = false;

        // document.getElementById('countryOfOperationDiv').style.display = 'none';
        // document.getElementById('iOperateOnANationalLevelDiv').style.display = 'none';
        // document.getElementById('statesOfOperationDiv').style.display = 'none';
        // document.getElementById('iOperateOnAProvincialLevelDiv').style.display = 'none';
        // document.getElementById('cityOfOperationDiv').style.display = 'none';

        //document.getElementById('iOperateOnAStateLevelRadioButton').checked = false;

        document.getElementById('traderRegionOfOperationValidation').innerHTML = '';
        document.getElementById('traderCountryOfOperationValidation').innerHTML = '';
        document.getElementById('traderStatesOfOperationValidation').innerHTML = '';
        document.getElementById('traderCityOfOperationValidation').innerHTML = '';

        document.getElementById('editRegionOfOperationInput').style.display = 'none';
        document.getElementById('editRegionOfOperationPlaceholder').style.display = 'block';
        document.getElementById('countryOfOperationInput').style.display = 'none';
        document.getElementById('countryOfOperationInput2').style.display = 'block';
        document.getElementById('countryOfOperationPlaceholder').style.display = 'none';
        document.getElementById('statesOfOperationInput').style.display = 'block';
        document.getElementById('statesOfOperationPlaceholder').style.display = 'none';
        document.getElementById('cityOfOperationInput').style.display = 'none';
        document.getElementById('cityOfOperationPlaceholder').style.display = 'block';
    } else {
        document.getElementById('cityOfOperationInput').style.display = 'block';
        document.getElementById('cityOfOperationPlaceholder').style.display = 'none';
        // document.getElementById('countryOfOperationDiv').style.display = 'block';
        // document.getElementById('iOperateOnANationalLevelDiv').style.display = 'block';
        // document.getElementById('statesOfOperationDiv').style.display = 'block';
        // document.getElementById('iOperateOnAProvincialLevelDiv').style.display = 'block';
        // document.getElementById('cityOfOperationDiv').style.display = 'block';
    }
}
