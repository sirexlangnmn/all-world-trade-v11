let btnAddKeyword;
let inputAddKeyword;
let textAreaAddKeywords;

let editTradeCategory;
let traderMinorSubCategoryToggleField1;
let traderMinorSubCategoryToggleField2;
let traderSubCategoryToggleField1;
let traderSubCategoryToggleField2;

btnAddKeyword = getId('btnAddKeyword');
inputAddKeyword = getId('inputAddKeyword');
textAreaAddKeywords = getId('textAreaAddKeywords');

editTradeCategory = getId('editTradeCategory');
traderMinorSubCategoryToggleField1 = getId('traderMinorSubCategoryToggleField1');
traderMinorSubCategoryToggleField2 = getId('traderMinorSubCategoryToggleField2');
traderSubCategoryToggleField1 = getId('traderSubCategoryToggleField1');
traderSubCategoryToggleField2 = getId('traderSubCategoryToggleField2');

$(function () {
    getUserBusinessCharacteristics();
});

let editLanguagesOfCommunication;
editLanguagesOfCommunication = getId('editLanguagesOfCommunication');

// consume api to get all languages
async function getLanguages() {
    let response = await fetch(host + '/api/get/languages');
    let data = await response.json();
    return data;
}

// display all languages in frontend select option
getLanguages().then((data) => {
    editLanguagesOfCommunication.innerHTML = '<option value="" disabled>Status Quo</option>';
    for (var i = 0; i < data.length; i++) {
        editLanguagesOfCommunication.innerHTML =
            editLanguagesOfCommunication.innerHTML +
            '<option value="' +
            data[i]['code'] +
            '">' +
            data[i]['name'] +
            '</option>';
    }

    $('#editLanguagesOfCommunication').selectpicker('refresh');
});

function getUserBusinessCharacteristics() {
    $.ajax({
        url: '/api/get/user-business-characteristics',
        type: 'POST',
        success: function (data) {
            if (data.length > 0) {
                getTradeCategoriesToBeEditAndOptions(data, 'editTradeCategory');
                getSubCategoriesToBeEditAndOptions(
                    data,
                    'traderSubCategoryToggleField1',
                    'traderSubCategoryToggleField2',
                );
                getMinorSubCategoryToBeEditAndOptions(
                    data,
                    'minorSubCategories',
                    'minorSubCategory',
                    'minorSubCategoryInput',
                );

                document.getElementById('textAreaCurrentKeywords').value = data[0].business_industry_belong_to;
            }

            if (data.length == 0) {
                getTradeCategoriesOptions('editTradeCategory');
                document.getElementById('editTradeCategoryValidation').innerHTML = 'Trade Category is required';
                document.getElementById('traderSubCategoryValidation').innerHTML = 'Sub Category is required';
                document.getElementById('editBusinessScaleValidation').innerHTML = 'Business Scale is required';
            } else {
                if (data[0].business_major_category == null || data[0].business_major_category == '') {
                    document.getElementById('editTradeCategoryValidation').innerHTML = 'Trade Category is required';
                }
            }

            getUsersBusinessScale(data);
        },
    });
}

function getTradeCategoriesOptions(elementId) {
    // consume api to get all trade categories
    async function getTradeCategories() {
        let response = await fetch(host + '/api/get/categories');
        let data = await response.json();
        return data;
    }

    // display all trade categories in frontend select option
    getTradeCategories().then((data) => {
        document.getElementById(elementId).innerHTML = '<option value="">Select</option>';
        for (var i = 0; i < data.length; i++) {
            document.getElementById(elementId).innerHTML =
                document.getElementById(elementId).innerHTML +
                '<option value="' +
                data[i]['id'] +
                '">' +
                data[i]['title'] +
                '</option>';
        }
    });
}

editTradeCategory.addEventListener('change', function () {
    let tradeCategoryId = this.value;

    document.getElementById('minorSubCategory').value = '';
    document.getElementById('minorSubCategoryInput').value = '';
    $('#minorSubCategories').empty();

    getSubCategoriesOptionsWhenTradeCategoryChange(tradeCategoryId, 'traderSubCategoryToggleField1');
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

btnAddKeyword.addEventListener('click', addKeyword);
const keywordData = [];
function addKeyword() {
    let add = inputAddKeyword.value;
    keywordData.push(add);
    textAreaAddKeywords.value = keywordData;
}
