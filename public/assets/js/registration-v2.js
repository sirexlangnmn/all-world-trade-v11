let firstName = getId('firstName');
let lastName = getId('lastName');
let accountType = getId('accountType');
let contactNumber = getId('contactNumber');
let emailAddress = getId('emailAddress');
let password = getId('password');
let confirmPassword = getId('confirmPassword');
let terms = getId('terms');
let hashedPassword = getId('hashedPassword');
let plainPassword = getId('plainPassword');

let firstNameValidation = getId('firstNameValidation');
let lastNameValidation = getId('lastNameValidation');
let accountTypeValidation = getId('accountTypeValidation');
let contactNumberValidation = getId('contactNumberValidation');
let emailAddressValidation = getId('emailAddressValidation');
let passwordValidation = getId('passwordValidation');
let confirmPasswordValidation = getId('confirmPasswordValidation');
let termsValidation = getId('termsValidation');
const registrationFormV2 = getId('registrationFormV2');

registrationFormV2.addEventListener('submit', (event) => {
    event.preventDefault();

    let registrationFormV2 = $('#registrationFormV2');
    $.ajax({
        url: '/api/v2/post/registration-v2',
        type: 'post',
        data: registrationFormV2.serialize(),
    }).done((res) => {
        console.log(res);
        if (res.message === 'account has been created') {
            Swal.fire('Success', 'Registration Success.', 'success');
            window.location.replace('/selection');
        }

        if (res.message === 'email already in use') {
            emailAddressValidation.style.display = 'block';
            emailAddressValidation.innerHTML = res.message;
            Swal.fire('Warning', 'Email already in use', 'warning');
        }

        if (res.message === 'must agree in terms and conditions') {
            Swal.fire('Warning', 'Must agree in terms and conditions', 'warning');
        }

        if (res.message === 'rollback') {
            Swal.fire('Warning', 'Registration failed. Please try again later.', 'warning');
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
});

function displayServerValidation(message) {
    const filters = {
        firstName: getFilteredMessages(message, 'firstName'),
        contactNumber: getFilteredMessages(message, 'contactNumber'),
        accountType: getFilteredMessages(message, 'accountType'),
        emailAddress: getFilteredMessages(message, 'emailAddress'),
        password: getFilteredMessages(message, 'password'),
        confirmPassword: getFilteredMessages(message, 'confirmPassword'),
        terms: getFilteredMessages(message, 'terms'),
    };

    Object.entries(filters).forEach(([param, filteredMessage]) => {
        const validationElement = document.getElementById(`${param}Validation`);
        displayServerValidationToggle(validationElement, filteredMessage);
    });
}

function getFilteredMessages(message, param) {
    if (!Array.isArray(message)) {
        return [];
    }

    return message.filter((d) => d.param === param);
}

function displayServerValidationToggle(element, message) {
    if (message && message.length > 0) {
        element.style.display = 'block';
        element.innerHTML = message[0].msg || '';
    }
}

function messageValidationToggle(element, message) {
    if (message) {
        element.style.display = 'block';
        element.innerHTML = message;
    } else {
        element.style.display = 'none';
        element.innerHTML = '';
    }
}

firstName.addEventListener('keyup', function (event) {
    event.target.value
        ? messageValidationToggle(firstNameValidation, null)
        : messageValidationToggle(firstNameValidation, 'Fullname is required');
});

contactNumber.addEventListener('keyup', function (event) {
    event.target.value
        ? messageValidationToggle(contactNumberValidation, null)
        : messageValidationToggle(contactNumberValidation, 'Contact number is required');
});

emailAddress.addEventListener('keyup', function (event) {
    event.target.value
        ? messageValidationToggle(emailAddressValidation, null)
        : messageValidationToggle(emailAddressValidation, 'Email address is required');
});

password.addEventListener('keyup', function (event) {
    hashedPasswordProcess();

    event.target.value
        ? messageValidationToggle(passwordValidation, null)
        : messageValidationToggle(passwordValidation, 'Password is required');
});

confirmPassword.addEventListener('keyup', function (event) {
    event.target.value
        ? messageValidationToggle(confirmPasswordValidation, null)
        : messageValidationToggle(confirmPasswordValidation, 'Confirm password is required');
});

terms.addEventListener('change', function (event) {
    event.target.checked
        ? messageValidationToggle(termsValidation, null)
        : messageValidationToggle(termsValidation, 'Accept Terms and Conditions');
});

function hashedPasswordProcess() {
    let inputPassword = password.value;
    plainPassword.value = inputPassword;

    if (inputPassword !== '') {
        $.ajax({
            url: '/api/post/password-hashing',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                password: inputPassword,
            }),
            success: function (response) {
                hashedPassword.value = response;
            },
        });
    } else {
        hashedPassword.value = '';
    }
}
