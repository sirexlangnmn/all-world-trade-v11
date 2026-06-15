// function getTradeCategoriesToBeEditAndOptions(value, elementId) {
//     async function getTradeCategories() {
//         let response = await fetch(host + '/api/get/categories');
//         let data = await response.json();
//         return data;
//     }

//     getTradeCategories().then((data) => {
//         let tradeCategoryId = value[0].business_major_category;
//         let filtered = data.filter((d) => d.id == tradeCategoryId);

//         document.getElementById(elementId).innerHTML = '<option value="' + filtered[0].id + '">' + filtered[0].title + '</option>';
//         for (var i = 0; i < data.length; i++) {
//             document.getElementById(elementId).innerHTML =
//             document.getElementById(elementId).innerHTML + '<option value="' + data[i]['id'] + '">' + data[i]['title'] + '</option>';
//         }

//         $('#' + elementId).selectpicker('refresh');
//     });
// }

async function getTradeCategoriesToBeEditAndOptions(value, elementId) {
    async function getTradeCategories() {
        const response = await fetch(`${host}/api/get/categories`);
        const data = await response.json();
        return data;
    }

    try {
        const data = await getTradeCategories();
        const tradeCategoryId = value[0].business_major_category;
        const selectedOption = data.find((d) => d.id == tradeCategoryId);
        const unselectedOptions = data.filter((d) => d.id != tradeCategoryId);

        const optionsHTML =
            `<option value="${selectedOption.id}">${selectedOption.title}</option>` +
            unselectedOptions.map((d) => `<option value="${d.id}">${d.title}</option>`).join('');

        document.getElementById(elementId).innerHTML = optionsHTML;

        $(`#${elementId}`).selectpicker('refresh');
    } catch (error) {
        console.error(error);
    }
}

function getSubCategoriesToBeEditAndOptions(value, dropdownElementId, inputElementId) {
    async function getSubCategoriesByTradeCategoryId() {
        let tradeCategoryId = value[0].business_major_category;
        let response = await fetch(host + '/api/get/sub-categories-by-trade-category-id/' + tradeCategoryId);
        let data = await response.json();
        return data;
    }

    getSubCategoriesByTradeCategoryId().then((data) => {
        $('#' + dropdownElementId).empty();
        document.getElementById(dropdownElementId).disabled = false;

        let subCategoryId = value[0].business_sub_category;
        let subCategoryString = value[0].business_sub_category_str;

        if (subCategoryId) {
            let filtered = data.filter((d) => d.id == subCategoryId);

            document.getElementById(dropdownElementId).innerHTML =
                '<option value="' + filtered[0].id + '">' + filtered[0].title + '</option>';
            for (var i = 0; i < data.length; i++) {
                document.getElementById(dropdownElementId).innerHTML =
                    document.getElementById(dropdownElementId).innerHTML +
                    '<option value="' +
                    data[i]['id'] +
                    '">' +
                    data[i]['title'] +
                    '</option>';
            }
            document.getElementById(dropdownElementId).innerHTML =
                document.getElementById(dropdownElementId).innerHTML +
                '<option value="customOption">Other (Type a custom value)</option><input type="text" class="shadow-none with-border" id="traderSubCategoryToggleField2" name="editSubCategory" style="display:none;" disabled="disabled" >';

            // $('#' + dropdownElementId).selectpicker('refresh');
        }

        if (subCategoryString) {
            $('#' + dropdownElementId).hide();
            document.getElementById(inputElementId).style.display = 'block';
            document.getElementById(inputElementId).disabled = false;
            document.getElementById(inputElementId).value = subCategoryString;
        }
    });
}

function getSubCategoriesOptionsWhenTradeCategoryChange(tradeCategoryId, dropdownElementId) {
    async function getSubCategoriesByTradeCategoryId() {
        let response = await fetch(host + '/api/get/sub-categories-by-trade-category-id/' + tradeCategoryId);
        let data = await response.json();
        return data;
    }

    getSubCategoriesByTradeCategoryId().then((data) => {
        document.getElementById(dropdownElementId).disabled = false;

        document.getElementById(dropdownElementId).innerHTML = '<option value=""> Select </option>';
        for (var i = 0; i < data.length; i++) {
            document.getElementById(dropdownElementId).innerHTML =
                document.getElementById(dropdownElementId).innerHTML +
                '<option value="' +
                data[i]['id'] +
                '">' +
                data[i]['title'] +
                '</option>';
        }
        document.getElementById(dropdownElementId).innerHTML =
            document.getElementById(dropdownElementId).innerHTML +
            '<option value="customOption">Other (Type a custom value)</option><input id="traderSubCategoryToggleField2" name="traderSubCategoryToggleField" style="display:none;" disabled="disabled" >';
    });
}

function getMinorSubCategoriesOptionsWhenSubCategoryChange(subCategoryId, dropdownElementId) {
    if (subCategoryId !== 'customOption') {
        async function getMinorSubCategoriesByTradeCategoryId() {
            let response = await fetch(host + '/api/get/minor-sub-categories-by-sub-category-id/' + subCategoryId);
            let data = await response.json();
            return data;
        }

        getMinorSubCategoriesByTradeCategoryId().then((data) => {
            if (data.length > 0) {
                $('#' + dropdownElementId).empty();
                for (var i = 0; i < data.length; i++) {
                    let option = document.createElement('option');
                    option.value = data[i]['title'];
                    document.getElementById(dropdownElementId).appendChild(option);
                }
            }
        });
    }
}

// NOTE: if choose to input manually the sub category, empty the minor sub category
function getMinorSubCategoryToBeEditAndOptions(value, datalistOptionElementId, datalistInputElementId, inputElementId) {
    async function getMinorSubCategoriesById() {
        let subCategoryId = value[0].business_sub_category;

        if (subCategoryId) {
            let response = await fetch(host + '/api/get/minor-sub-categories-by-sub-category-id/' + subCategoryId);
            let data = await response.json();
            return data;
        }
    }

    getMinorSubCategoriesById().then((data) => {
        let subCategoryId = value[0].business_sub_category;
        let minorSubCategoryId = value[0].business_minor_sub_category;
        let minorSubCategoryString = value[0].business_minor_sub_category_str;

        if (minorSubCategoryString) {
            document.getElementById(datalistInputElementId).value = minorSubCategoryString;
            document.getElementById(inputElementId).value = minorSubCategoryString;
        }

        if (subCategoryId && minorSubCategoryId) {
            let filtered = data.filter((d) => d.id == minorSubCategoryId);

            document.getElementById(datalistInputElementId).value = filtered[0].title;
            document.getElementById(inputElementId).value = minorSubCategoryId;
            for (var i = 0; i < data.length; i++) {
                for (var i = 0; i < data.length; i++) {
                    let option = document.createElement('option');
                    option.value = data[i]['title'];
                    document.getElementById(datalistOptionElementId).appendChild(option);
                }
            }
        }

        if (subCategoryId && minorSubCategoryString) {
            document.getElementById(datalistInputElementId).value = minorSubCategoryString;
            document.getElementById(inputElementId).value = minorSubCategoryString;

            for (var i = 0; i < data.length; i++) {
                let option = document.createElement('option');
                option.value = data[i]['title'];
                document.getElementById(datalistOptionElementId).appendChild(option);
            }
        }
    });
}

function getMinorSubCategoryForInitialInputValue(datalistInputElementId, inputElementId) {
    let minorSubCategoryInitialInput = document.getElementById(datalistInputElementId).value;

    if (minorSubCategoryInitialInput) {
        async function getMinorSubCategoryByTitle() {
            let response = await fetch(host + '/api/get/minor-sub-category-by-title/' + minorSubCategoryInitialInput);
            let data = await response.json();
            return data;
        }

        getMinorSubCategoryByTitle().then((data) => {
            let minorSubCategoryInitialInput = document.getElementById('minorSubCategory').value;
            if (data.length === 1) {
                document.getElementById(inputElementId).value = data[0].id;
            } else if (minorSubCategoryInitialInput == '') {
                document.getElementById(inputElementId).value = minorSubCategoryInitialInput;
            } else {
                document.getElementById(inputElementId).value = minorSubCategoryInitialInput;
            }
        });
    } else {
        document.getElementById(inputElementId).value = '';
    }
}
