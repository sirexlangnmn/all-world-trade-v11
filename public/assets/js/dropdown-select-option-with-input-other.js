// NOTE: also use html element in ejs file that related in the declared element here
const subCategorySelectpicker = getId('sub-category-select');
const subCategoryManual = getId('sub-category-manual');
const minorSubCategoryManual = getId('minor-sub-category-manual');
const minorSubCategorySelectpicker = getId('minor-sub-category-select');

let globalOldTradeCategorySelected = '';
let globalSubCategoryOptions = [];
let globalOldSubCategorySelected = '';
let globalMinorSubCategoryOptions = [];
let globalOldMinorSubCategorySelected = '';

async function getSubCategoriesToBeEditByTradeCategoryId(value) {
    const tradeCategoryId = value[0].business_major_category;
    if (tradeCategoryId) {
        const response = await fetch(`${host}/api/get/sub-categories-by-trade-category-id/${tradeCategoryId}`);
        const data = await response.json();
        globalSubCategoryOptions = data;

        const subCategoryId = value[0].business_sub_category;
        const subCategoryString = value[0].business_sub_category_str;

        globalOldTradeCategorySelected = tradeCategoryId;
        globalOldSubCategorySelected = subCategoryId;

        // Clear existing options from dropdown
        $(subCategorySelectpicker).empty();

        // Loop through subcategories and add them as options to the dropdown
        data.forEach(({ id, title }) => {
            const option = document.createElement('option');
            option.value = id;
            option.text = title;
            subCategorySelectpicker.appendChild(option);

            // Set the selected attribute of the option that matches the old data
            if (subCategoryId && id == subCategoryId) {
                option.selected = true;
            }
        });

        // Add "Other" option to the dropdown
        const otherOption = document.createElement('option');
        otherOption.value = 'other';
        otherOption.text = 'Other';
        subCategorySelectpicker.appendChild(otherOption);

        // Refresh the Bootstrap selectpicker
        $(subCategorySelectpicker).selectpicker('refresh');

        // Check if the subcategory string is present and display the corresponding input field
        if (subCategoryString) {
            subCategorySelectpicker.style.display = 'none';
            $(subCategorySelectpicker).selectpicker('hide');
            $(minorSubCategorySelectpicker).selectpicker('hide');
            subCategoryManual.style.display = 'block';
            subCategoryManual.value = subCategoryString;
        }
    }
}

subCategorySelectpicker.addEventListener('change', function () {
    if (subCategorySelectpicker.value === 'other') {
        $(subCategorySelectpicker).selectpicker('hide');
        $(minorSubCategorySelectpicker).selectpicker('hide');
        subCategoryManual.style.display = 'block';
        minorSubCategoryManual.style.display = 'block';
        subCategoryManual.disabled = false;
        minorSubCategoryManual.disabled = false;
        $(subCategorySelectpicker).empty();
        $(minorSubCategorySelectpicker).empty();
    } else {
        $(subCategorySelectpicker).selectpicker('show');
        $(minorSubCategorySelectpicker).selectpicker('show');
        subCategorySelectpicker.style.display = 'block';
        subCategoryManual.style.display = 'none';
        minorSubCategoryManual.style.display = 'none';
        subCategoryManual.disabled = true;
        minorSubCategoryManual.disabled = true;
        subCategoryManual.value = '';
        minorSubCategoryManual.value = '';
        getMinorSubCategoriesOptionsWhenSubCategoriesChange(subCategorySelectpicker.value);
    }
});

subCategoryManual.onblur = function () {
    if (subCategoryManual.value === '') {
        $(subCategorySelectpicker).selectpicker('show');
        $(minorSubCategorySelectpicker).selectpicker('show');
        subCategoryManual.style.display = 'none';
        minorSubCategoryManual.style.display = 'none';
        subCategoryManual.disabled = true;
        minorSubCategoryManual.disabled = true;
        subCategoryManual.value = '';
        minorSubCategoryManual.value = '';

        console.log('globalOldTradeCategorySelected: ', globalOldTradeCategorySelected);
        console.log('editTradeCategory.value: ', editTradeCategory.value);
        console.log('subCategorySelectpicker.value: ', subCategorySelectpicker.value);

        if (globalOldTradeCategorySelected == editTradeCategory.value) {
            repopulateSubCategoriesToBeEdit(globalSubCategoryOptions, globalOldSubCategorySelected);
            repopulateMinorSubCategoriesToBeEdit();
        } else {
            getSubCategoriesOptionsWhenTradeCategoriesChange(editTradeCategory.value);
            // getMinorSubCategoriesOptionsWhenSubCategoriesChange(subCategorySelectpicker.value);
        }
    }
};

function repopulateSubCategoriesToBeEdit(globalSubCategoryOptions, globalOldSubCategorySelected) {
    const data = globalSubCategoryOptions;
    const subCategoryId = globalOldSubCategorySelected;

    // Clear existing options from dropdown
    $(subCategorySelectpicker).empty();

    // Loop through subcategories and add them as options to the dropdown
    data.forEach(({ id, title }) => {
        const option = document.createElement('option');
        option.value = id;
        option.text = title;
        subCategorySelectpicker.appendChild(option);

        // Set the selected attribute of the option that matches the old data
        if (subCategoryId && id == subCategoryId) {
            option.selected = true;
        }
    });

    // Add "Other" option to the dropdown
    const otherOption = document.createElement('option');
    otherOption.value = 'other';
    otherOption.text = 'Other';
    subCategorySelectpicker.appendChild(otherOption);

    // Refresh the Bootstrap selectpicker
    $(subCategorySelectpicker).selectpicker('refresh');
}

async function getMinorSubCategoriesToBeEditByTradeCategoryId(value) {
    const subCategoryId = value[0].business_sub_category;
    const minorSubCategoryId = value[0].business_minor_sub_category;
    const minorSubCategoryString = value[0].business_minor_sub_category_str;

    if (subCategoryId) {
        const response = await fetch(`${host}/api/get/minor-sub-categories-by-sub-category-id/${subCategoryId}`);
        const data = await response.json();

        globalMinorSubCategoryOptions = data;
        globalOldMinorSubCategorySelected = minorSubCategoryId;

        // console.log('subCategoryId', subCategoryId);
        // console.log('minorSubCategoryId', minorSubCategoryId);
        // console.log('minorSubCategoryString', minorSubCategoryString);
        // console.log('getMinorSubCategoriesById data', data);

        // Clear existing options from dropdown
        $(minorSubCategorySelectpicker).empty();

        // Loop through subcategories and add them as options to the dropdown
        data.forEach(({ id, title }) => {
            const option = document.createElement('option');
            option.value = id;
            option.text = title;
            minorSubCategorySelectpicker.appendChild(option);

            // Set the selected attribute of the option that matches the old data
            if (minorSubCategoryId && id == minorSubCategoryId) {
                option.selected = true;
            }
        });

        // Add "Other" option to the dropdown
        const otherOption = document.createElement('option');
        otherOption.value = 'other';
        otherOption.text = 'Other';
        minorSubCategorySelectpicker.appendChild(otherOption);

        // Refresh the Bootstrap selectpicker
        $(minorSubCategorySelectpicker).selectpicker('refresh');
    } else {
        console.log('minorSubCategoryString: ', minorSubCategoryString);
        // Check if the subcategory string is present and display the corresponding input field
        if (minorSubCategoryString) {
            $(minorSubCategorySelectpicker).selectpicker('hide');
            minorSubCategoryManual.style.display = 'block';
            minorSubCategoryManual.value = minorSubCategoryString;
        }
    }
}

minorSubCategorySelectpicker.addEventListener('change', function () {
    if (minorSubCategorySelectpicker.value === 'other') {
        $(minorSubCategorySelectpicker).selectpicker('hide');
        minorSubCategoryManual.style.display = 'block';
        minorSubCategoryManual.disabled = false;
        $(minorSubCategorySelectpicker).empty();
    } else {
        $(minorSubCategorySelectpicker).selectpicker('show');
        minorSubCategoryManual.style.display = 'none';
        minorSubCategoryManual.disabled = true;
        minorSubCategoryManual.value = '';
    }
});

minorSubCategoryManual.onblur = function () {
    if (minorSubCategoryManual.value === '' && subCategoryManual.vlaue === '') {
        $(minorSubCategorySelectpicker).selectpicker('show');
        minorSubCategoryManual.style.display = 'none';
        minorSubCategoryManual.disabled = true;
        minorSubCategoryManual.value = '';
        if (globalOldSubCategorySelected == subCategorySelectpicker.value) {
            repopulateMinorSubCategoriesToBeEdit();
        } else {
            getMinorSubCategoriesOptionsWhenSubCategoriesChange(subCategorySelectpicker.value);
        }
    }
};

function repopulateMinorSubCategoriesToBeEdit() {
    const data = globalMinorSubCategoryOptions;
    //const subCategoryId = globalOldMinorSubCategorySelected;
    const minorSubCategoryId = globalOldMinorSubCategorySelected;

    // Clear existing options from dropdown
    $(minorSubCategorySelectpicker).empty();

    // Loop through subcategories and add them as options to the dropdown
    data.forEach(({ id, title }) => {
        const option = document.createElement('option');
        option.value = id;
        option.text = title;
        minorSubCategorySelectpicker.appendChild(option);

        // Set the selected attribute of the option that matches the old data
        if (minorSubCategoryId && id == minorSubCategoryId) {
            option.selected = true;
        }
    });

    // Add "Other" option to the dropdown
    const otherOption = document.createElement('option');
    otherOption.value = 'other';
    otherOption.text = 'Other';
    minorSubCategorySelectpicker.appendChild(otherOption);

    // Refresh the Bootstrap selectpicker
    $(minorSubCategorySelectpicker).selectpicker('refresh');
}

async function getSubCategoriesOptionsWhenTradeCategoriesChange(tradeCategoryId) {
    // Clear existing options from dropdown
    $(subCategorySelectpicker).empty();
    $(minorSubCategorySelectpicker).empty();

    const response = await fetch(host + '/api/get/sub-categories-by-trade-category-id/' + tradeCategoryId);
    const data = await response.json();
    // Loop through subcategories and add them as options to the dropdown
    data.forEach(({ id, title }) => {
        const option = document.createElement('option');
        option.value = id;
        option.text = title;
        subCategorySelectpicker.appendChild(option);
    });

    // Add "Other" option to the dropdown
    const otherOption = document.createElement('option');
    otherOption.value = 'other';
    otherOption.text = 'Other';
    subCategorySelectpicker.appendChild(otherOption);

    // Refresh the Bootstrap selectpicker
    $(subCategorySelectpicker).selectpicker('refresh');
    $(minorSubCategorySelectpicker).selectpicker('refresh');
    getMinorSubCategoriesOptionsWhenSubCategoriesChange(subCategorySelectpicker.value);
}

async function getMinorSubCategoriesOptionsWhenSubCategoriesChange(subCategoryId) {
    // Clear existing options from dropdown
    $(minorSubCategorySelectpicker).empty();

    console.log('getMinorSubCategoriesOptionsWhenSubCategoriesChange subCategoryId: ', subCategoryId);
    if (subCategoryId !== 'other') {
        const response = await fetch(`${host}/api/get/minor-sub-categories-by-sub-category-id/${subCategoryId}`);
        const data = await response.json();
        console.log('getMinorSubCategoriesOptionsWhenSubCategoriesChange data: ', data);

        data.forEach(({ id, title }) => {
            const option = document.createElement('option');
            option.value = id;
            option.text = title;
            minorSubCategorySelectpicker.appendChild(option);
        });

        // Add "Other" option to the dropdown
        const otherOption = document.createElement('option');
        otherOption.value = 'other';
        otherOption.text = 'Other';
        minorSubCategorySelectpicker.appendChild(otherOption);

        // Refresh the Bootstrap selectpicker
        $(minorSubCategorySelectpicker).selectpicker('refresh');
    }
}
