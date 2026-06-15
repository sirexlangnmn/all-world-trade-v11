$(function () {});

let traderLanguagesOfCommunication;

let tradeCategoriesForRegistration;
let traderSubCategoryToggleField1;
let traderSubCategoryToggleField2;
let traderMinorSubCategoryToggleField1;
let traderMinorSubCategoryToggleField2;

let traderPassword;
let traderPlainPassword;
let traderConfirmPassword;
let traderHashedPassword;
let traderHashedPasswordInput;

traderLanguagesOfCommunication = getId('traderLanguagesOfCommunication');

tradeCategoriesForRegistration = getId('traderTradeCategory');
traderSubCategoryToggleField1 = getId('traderSubCategoryToggleField1');
traderSubCategoryToggleField2 = getId('traderSubCategoryToggleField2');
traderMinorSubCategoryToggleField1 = getId('traderMinorSubCategoryToggleField1');
traderMinorSubCategoryToggleField2 = getId('traderMinorSubCategoryToggleField2');

traderPassword = getId('traderPassword');
traderPlainPassword = getId('traderPlainPassword');
traderConfirmPassword = getId('traderConfirmPassword');
traderHashedPassword = getId('traderHashedPassword');
traderHashedPasswordInput = getId('traderHashedPasswordInput');
traderPlainPasswordInput = getId('traderPlainPasswordInput');

// consume api to get all trade categories
async function getRegionOfOperations() {
    let response = await fetch(host + '/api/get/region-of-operations');
    let data = await response.json();
    return data;
}

// consume api to get all languages
async function getLanguages() {
    let response = await fetch(host + '/api/get/languages');
    let data = await response.json();
    return data;
}

// display all languages in frontend select option
getLanguages().then((data) => {
    traderLanguagesOfCommunication.innerHTML = '<option value="select">Select</option>';
    for (var i = 0; i < data.length; i++) {
        traderLanguagesOfCommunication.innerHTML =
            traderLanguagesOfCommunication.innerHTML +
            '<option value="' +
            data[i]['code'] +
            '">' +
            data[i]['name'] +
            '</option>';
    }
    $('#traderLanguagesOfCommunication').selectpicker('refresh');
});

// consume api to get all trade categories
async function getTradeCategories() {
    let response = await fetch(host + '/api/get/categories');
    let data = await response.json();
    return data;
}

// display all trade categories in frontend select option
getTradeCategories().then((data) => {
    traderMinorSubCategoryToggleField1.disabled = true;
    tradeCategoriesForRegistration.innerHTML = '<option value="">Select</option>';
    for (var i = 0; i < data.length; i++) {
        tradeCategoriesForRegistration.innerHTML =
            tradeCategoriesForRegistration.innerHTML +
            '<option value="' +
            data[i]['id'] +
            '">' +
            data[i]['title'] +
            '</option>';
    }
    $('#traderTradeCategory').selectpicker('refresh');
});

// display all minor sub categories under sub category in frontend select option
tradeCategoriesForRegistration.addEventListener('change', function () {
    let tradeCategoryId = this.value;

    async function getSubCategoriesByTradeCategoryId() {
        let response = await fetch(host + '/api/get/sub-categories-by-trade-category-id/' + tradeCategoryId);
        let data = await response.json();
        return data;
    }

    getSubCategoriesByTradeCategoryId().then((data) => {
        traderSubCategoryToggleField1.disabled = false;

        traderSubCategoryToggleField1.innerHTML = '<option value="select">Select</option>';
        for (var i = 0; i < data.length; i++) {
            traderSubCategoryToggleField1.innerHTML =
                traderSubCategoryToggleField1.innerHTML +
                '<option value="' +
                data[i]['id'] +
                '">' +
                data[i]['title'] +
                '</option>';
        }
        traderSubCategoryToggleField1.innerHTML =
            traderSubCategoryToggleField1.innerHTML +
            '<option value="customOption">Other (Type a custom value)</option><input id="traderSubCategoryToggleField2" name="traderSubCategoryToggleField" style="display:none;" disabled="disabled" >';

        required(traderSubCategoryToggleField1, traderSubCategoryValidation, 'required');
    });
});

// display all minor sub categories under sub category in frontend select option
traderSubCategoryToggleField1.addEventListener('change', function () {
    traderMinorSubCategoryToggleField1.disabled = false;
    $('#traderMinorSubCategoryToggleField1').empty();
    let subCategoryId = this.value;

    if (this.options[this.selectedIndex].value == 'customOption') {
        toggleField(this, this.nextSibling);
        this.selectedIndex = '0';

        traderMinorSubCategoryToggleField1.style.display = 'none';
        traderMinorSubCategoryToggleField1.disabled = false;

        traderMinorSubCategoryToggleField2.style.display = 'block';
        traderMinorSubCategoryToggleField2.disabled = false;
    }

    if (this.options[this.selectedIndex].value !== 'customOption' && subCategoryId !== 'customOption') {
        async function getMinorSubCategoriesByTradeCategoryId() {
            let response = await fetch(host + '/api/get/minor-sub-categories-by-sub-category-id/' + subCategoryId);
            let data = await response.json();
            return data;
        }

        getMinorSubCategoriesByTradeCategoryId().then((data) => {
            if (data.length === undefined) {
                $('#traderMinorSubCategoryToggleField1').empty();
                traderMinorSubCategoryToggleField1.style.display = 'none';
                traderMinorSubCategoryToggleField1.disabled = false;

                traderMinorSubCategoryToggleField2.style.display = 'block';
                traderMinorSubCategoryToggleField2.disabled = false;
                traderMinorSubCategoryToggleField2.style.display = 'inline';
                traderMinorSubCategoryToggleField2.focus();
            } else {
                traderMinorSubCategoryToggleField1.disabled = false;

                for (var i = 0; i < data.length; i++) {
                    traderMinorSubCategoryToggleField1.innerHTML =
                        traderMinorSubCategoryToggleField1.innerHTML +
                        '<option value="' +
                        data[i]['id'] +
                        '">' +
                        data[i]['title'] +
                        '</option>';
                }
                traderMinorSubCategoryToggleField1.innerHTML =
                    traderMinorSubCategoryToggleField1.innerHTML +
                    '<option value="none">None</option><option value="customOption">Other (Type a custom value)</option><input id="traderMinorSubCategoryToggleField2" name="traderMinorSubCategoryToggleField" style="display:none;" disabled="disabled" >';
            }
        });
    }
});

traderSubCategoryToggleField2.addEventListener('blur', function () {
    if (this.value == '') {
        toggleField(this, this.previousSibling);

        traderMinorSubCategoryToggleField2.style.display = 'none';
        traderMinorSubCategoryToggleField2.disabled = false;
        traderMinorSubCategoryToggleField2.value = '';

        traderMinorSubCategoryToggleField1.style.display = 'block';
        traderMinorSubCategoryToggleField1.disabled = false;
    }
});

traderMinorSubCategoryToggleField1.addEventListener('change', function () {
    if (this.options[this.selectedIndex].value == 'customOption') {
        toggleField(this, this.nextSibling);
        this.selectedIndex = '0';
    }
});

// traderMinorSubCategoryToggleField2.addEventListener('blur', function () {
//     if (this.value == '') {
//         toggleField(this, this.previousSibling);
//     }
// });

traderMinorSubCategoryToggleField2.addEventListener('blur', function () {
    if (
        (this.value == '' && traderSubCategoryToggleField1.value == 'customOption') ||
        traderSubCategoryToggleField2.value != ''
    ) {
        traderMinorSubCategoryToggleField2.style.display = 'block';
        traderMinorSubCategoryToggleField2.disabled = false;
    } else {
        if (this.value == '') {
            toggleField(this, this.previousSibling);
        }
    }
});

function toggleField(hideObj, showObj) {
    hideObj.disabled = true;
    hideObj.style.display = 'none';
    showObj.disabled = false;
    showObj.style.display = 'inline';
    showObj.focus();
}

const $form = $('#traderRegistrationForm');

traderHashedPasswordInput.style.display = 'none';
traderPlainPasswordInput.style.display = 'none';

traderPassword.onkeyup = function () {
    hashedPassword();
    required(traderPassword, traderPasswordValidation, 'required');
};

function hashedPassword() {
    let password = traderPassword.value;
    traderPlainPassword.value = password;

    if (password !== '') {
        $.ajax({
            url: '/api/post/password-hashing',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                password: password,
            }),
            success: function (response) {
                traderHashedPassword.value = response;
            },
        });
    } else {
        traderHashedPassword.value = '';
    }
}

traderPassword.addEventListener('blur', function () {
    passwordComparison('traderPassword', 'traderConfirmPassword');
});

traderConfirmPassword.addEventListener('blur', function () {
    passwordComparison('traderPassword', 'traderConfirmPassword');
});

function passwordComparison(tags1, tags2) {
    let password1 = document.getElementById(tags1).value;
    let password2 = document.getElementById(tags2).value;
    if (password2 !== '') {
        if (password1 === password2) {
        } else {
            Swal.fire('Warning', 'Password does not match.', 'warning');
        }
    }
}

let btnTraderRegistrationForm;
btnTraderRegistrationForm = getId('btnTraderRegistrationForm');

btnTraderRegistrationForm.addEventListener('click', (e) => {
    //stop submit the form, we will post it manually.
    e.preventDefault();

    // uncomment the following line after to finish the server side validation
    //let validation = tradersRegistrationValidation();
    let validation = 'true';

    if (validation === 'true') {
        //if (validation != '') {
        $.ajax({
            // url: '/api/post/looking-for-large-scale-company-registration',
            url: '/api/v2/post/large-scale-company-registration',
            type: 'post',
            data: $form.serialize(),
        }).done((res) => {
            if (res.message === 'account has been created') {
                registrationUploadBusinessMedias(res.uuid);
                registrationEmailVerification(res.uuid, res.verification_code, res.email_or_social_media);
                Swal.fire('Success', 'Registration Success.', 'success');
            }

            if (res.message === 'Email already in use') {
                emailAddressValidation.style.display = 'block';
                emailAddressValidation.innerHTML = res.message;
                Swal.fire('Warning', 'Email already in use', 'warning');
            }

            if (res.message === 'rollback') {
                Swal.fire('Warning', 'Registration failed. Please try again later.', 'warning');
            }

            if (res.message === 'must agree in terms and conditions') {
                Swal.fire('Warning', 'Must agree in terms and conditions', 'warning');
            }

            if (
                res.message !== 'Email already in use' &&
                res.message !== 'account has been created' &&
                res.message !== 'must agree in terms and conditions' &&
                res.message !== 'rollback'
            ) {
                displayServerValidation(res.message);
            }
        });
    } else {
        Swal.fire('Warning', 'At least one required field is incomplete.', 'warning');
    }
});
