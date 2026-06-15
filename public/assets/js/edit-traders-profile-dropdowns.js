let btnAddKeyword;
let inputAddKeyword;
let textAreaAddKeywords;

let editTradeCategory;
let traderSubCategoryToggleField1;
let traderSubCategoryToggleField2;

btnAddKeyword = getId('btnAddKeyword');
inputAddKeyword = getId('inputAddKeyword');
textAreaAddKeywords = getId('textAreaAddKeywords');

editTradeCategory = getId('editTradeCategory');
traderSubCategoryToggleField1 = getId('traderSubCategoryToggleField1');
traderSubCategoryToggleField2 = getId('traderSubCategoryToggleField2');

$(function () {
    getUserBusinessCharacteristics();
});

let editLanguagesOfCommunication;
editLanguagesOfCommunication = getId('editLanguagesOfCommunication');

// function business_language_of_communication(languages) {
//     // consume api to get all languages
//     async function getLanguages() {
//         let response = await fetch(host + '/api/get/languages');
//         let data = await response.json();
//         return data;
//     }

//     // display all languages in frontend select option
//     getLanguages().then((data) => {
//         let arr = languages.split(',');

//         editLanguagesOfCommunication.innerHTML = '';

//         for (var i = 0; i < data.length; i++) {
//             for (var x = 0; x < arr.length; x++) {
//                 if (arr[x] == data[i]['code']) {
//                     editLanguagesOfCommunication.innerHTML =
//                         editLanguagesOfCommunication.innerHTML +
//                         '<option value="' +
//                         data[i]['code'] +
//                         '" selected>' +
//                         data[i]['name'] +
//                         '</option>';
//                 }
//             }

//             if (i < data.length) {
//                 $('#editLanguagesOfCommunication').selectpicker('refresh');
//             }
//         }

//         for (var i = 0; i < data.length; i++) {
//             editLanguagesOfCommunication.innerHTML +=
//                 '<option value="' + data[i]['code'] + '">' + data[i]['name'] + '</option>';
//             if (i < data.length) {
//                 $('#editLanguagesOfCommunication').selectpicker('refresh');
//             }
//         }
//     });
// }

async function business_language_of_communication(languages) {
    // consume api to get all languages
    async function getLanguages() {
        const response = await fetch(`${host}/api/get/languages`);
        const data = await response.json();
        return data;
    }

    try {
        const data = await getLanguages();
        const arr = languages.split(',');

        const editLanguagesOfCommunication = document.getElementById('editLanguagesOfCommunication');
        editLanguagesOfCommunication.innerHTML = '';

        const selectedOptions = data
            .filter((d) => arr.includes(d.code))
            .map((d) => `<option value="${d.code}" selected>${d.name}</option>`);
        const unselectedOptions = data
            .filter((d) => !arr.includes(d.code))
            .map((d) => `<option value="${d.code}">${d.name}</option>`);

        editLanguagesOfCommunication.innerHTML = selectedOptions.concat(unselectedOptions).join('');

        $(`#editLanguagesOfCommunication`).selectpicker('refresh');
    } catch (error) {
        console.error(error);
    }
}

function getUserBusinessCharacteristics() {
    $.ajax({
        url: '/api/get/user-business-characteristics',
        type: 'POST',
        success: function (value) {
            // getTradeCategoriesFunction(value);
            // getSubCategoriesByTradeCategoryIdFunction(value);
            // getMinorSubCategoryOptions(value);
            getTradeCategoriesToBeEditAndOptions(value, 'editTradeCategory');
            getSubCategoriesToBeEditAndOptions(value, 'traderSubCategoryToggleField1', 'traderSubCategoryToggleField2');

            getMinorSubCategoryToBeEditAndOptions(
                value,
                'minorSubCategories',
                'minorSubCategory',
                'minorSubCategoryInput',
            );
            getUsersBusinessScale(value);

            //new
            getSubCategoriesToBeEditByTradeCategoryId(value);
            getMinorSubCategoriesToBeEditByTradeCategoryId(value);
        },
    });
}

editTradeCategory.addEventListener('change', function () {
    let tradeCategoryId = this.value;

    document.getElementById('minorSubCategory').value = '';
    document.getElementById('minorSubCategoryInput').value = '';
    $('#minorSubCategories').empty();

    getSubCategoriesOptionsWhenTradeCategoryChange(tradeCategoryId, 'traderSubCategoryToggleField1');
    getSubCategoriesOptionsWhenTradeCategoriesChange(tradeCategoryId);
});

traderSubCategoryToggleField1.addEventListener('change', function () {
    let subCategoryId = this.value;

    document.getElementById('minorSubCategory').value = '';
    document.getElementById('minorSubCategoryInput').value = '';
    $('#minorSubCategories').empty();

    if (this.options[this.selectedIndex].value == 'customOption') {
        toggleField(this, this.nextSibling);
        this.selectedIndex = '0';
    }

    getMinorSubCategoriesOptionsWhenSubCategoryChange(subCategoryId, 'minorSubCategories');
});

traderSubCategoryToggleField2.addEventListener('blur', function () {
    if (this.value == '') {
        toggleField(this, this.previousSibling);
    }
});

function toggleField(hideObj, showObj) {
    hideObj.disabled = true;
    hideObj.style.display = 'none';
    showObj.disabled = false;
    showObj.style.display = 'inline';
    showObj.focus();
}

document.getElementById('minorSubCategory').addEventListener('change', function () {
    getMinorSubCategoryForInitialInputValue('minorSubCategory', 'minorSubCategoryInput');
});

document.getElementById('minorSubCategory').addEventListener('blur', function () {
    getMinorSubCategoryForInitialInputValue('minorSubCategory', 'minorSubCategoryInput');
});

// btnAddKeyword.addEventListener('click', addKeyword);
// const keywordData = [];
// function addKeyword() {
//     let add = inputAddKeyword.value;
//     keywordData.push(add);
//     textAreaAddKeywords.value = keywordData;
// }
