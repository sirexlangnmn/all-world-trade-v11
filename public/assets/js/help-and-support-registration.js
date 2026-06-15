let hasrFirstname;
let hasrFirstnameValidation;
let hasrLastname;
let hasrLastnameValidation;
let hasrEmailAddress;
let hasrEmailAddressValidation;
let hasrPassword;
let hasrPasswordValidation;
let hasrConfirmPassword;
let hasrConfirmPasswordValidation;
let hasrHashedPassword;
let hasrPlainPassword;

hasrFirstname = getId('hasrFirstname');
hasrFirstnameValidation = getId('hasrFirstnameValidation');
hasrLastname = getId('hasrLastname');
hasrLastnameValidation = getId('hasrLastnameValidation');
hasrEmailAddress = getId('hasrEmailAddress');
hasrEmailAddressValidation = getId('hasrEmailAddressValidation');
hasrPassword = getId('hasrPassword');
hasrPasswordValidation = getId('hasrPasswordValidation');
hasrConfirmPassword = getId('hasrConfirmPassword');
hasrConfirmPasswordValidation = getId('hasrConfirmPasswordValidation');
hasrHashedPassword = getId('hasrHashedPassword');
hasrPlainPassword = getId('hasrPlainPassword');

hasrFirstname.onkeyup = function () {
    required(hasrFirstname, hasrFirstnameValidation, 'Firstname is required');
};

hasrLastname.onkeyup = function () {
    required(hasrLastname, hasrLastnameValidation, 'Lastname is required');
};

hasrEmailAddress.onkeyup = function () {
    let input = hasrEmailAddress.value;
    validateEmail(input, 'hasrEmailAddressValidation');
};

hasrPassword.onkeyup = function () {
    hashedPassword();
    required(hasrPassword, hasrPasswordValidation, 'Password is required');
};

function hashedPassword() {
    let password = hasrPassword.value;
    hasrPlainPassword.value = password;

    if (password !== '') {
        $.ajax({
            url: '/api/post/password-hashing',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                password: password,
            }),
            success: function (response) {
                hasrHashedPassword.value = response;
            },
        });
    } else {
        hasrHashedPassword.value = '';
    }
}

hasrPassword.addEventListener('blur', function () {
    required(hasrPassword, hasrPasswordValidation, 'Password is required');
    passwordComparison('hasrPassword', 'hasrConfirmPassword');
});

hasrConfirmPassword.addEventListener('blur', function () {
    required(hasrConfirmPassword, hasrConfirmPasswordValidation, 'Confirm password is required');
    passwordComparison('hasrPassword', 'hasrConfirmPassword');
});

function passwordComparison(tags1, tags2) {
    let password1 = document.getElementById(tags1).value;
    let password2 = document.getElementById(tags2).value;
    if (password2 !== '') {
        if (password1 === password2) {
        } else {
            Swal.fire('Warning', 'Password does not match.', 'warning');
            document.getElementById(tags2 + 'Validation').style.display = 'block';
            document.getElementById(tags2 + 'Validation').innerHTML = 'Password does not match.';
        }
    }
}

function required(elementIdInput, elementIdValidation, message) {
    if (elementIdInput.value.length == 0) {
        elementIdValidation.style.display = 'block';
        elementIdValidation.innerHTML = message;
    } else {
        elementIdValidation.style.display = 'none';
        elementIdValidation.innerHTML = '';
    }
}

function required2(elementIdValidation, message) {
    if (message.length != 0) {
        elementIdValidation.style.display = 'block';
        elementIdValidation.innerHTML = message[0].msg;
    } else {
        elementIdValidation.style.display = 'none';
        elementIdValidation.innerHTML = '';
    }
}

function helpAndSupportRegistrationValidation() {
    let output = 'true';

    if (hasrFirstname.value.length == 0) {
        output = 'empty first name';
        hasrFirstnameValidation.innerHTML = 'Firstname must not be empty';
    }
    if (hasrLastname.value.length == 0) {
        output = 'empty last name';
        hasrLastnameValidation.innerHTML = 'Lastname must not be empty';
    }
    if (hasrEmailAddress.value.length == 0) {
        output = 'empty email address';
        hasrEmailAddressValidation.innerHTML = 'Email address must not be empty';
    }
    if (hasrPassword.value.length == 0) {
        output = 'empty password';
        hasrPasswordValidation.innerHTML = 'Password must not be empty';
    }
    if (hasrConfirmPassword.value.length == 0) {
        output = 'empty password';
        hasrConfirmPasswordValidation.innerHTML = 'Confirm password must not be empty';
    }

    return output;
}

const helpAndSupportRegistrationForm = $('#helpAndSupportRegistrationForm');
helpAndSupportRegistrationForm.on('submit', helpAndSupportRegistrationSubmitHandler);

function helpAndSupportRegistrationSubmitHandler(e) {
    e.preventDefault();

    let validation = helpAndSupportRegistrationValidation();

    if (validation === 'true') {
        $.ajax({
            url: '/api/v2/post/help-and-support-registration-process',
            type: 'POST',
            data: helpAndSupportRegistrationForm.serialize(),
            success: function (res) {
                console.log(res);
                if (res.message === 'account has been created') {
                    // registrationEmailVerification(res.uuid, res.verification_code, res.email_or_social_media);
                    location.replace(host + '/help-and-support-login');
                    Swal.fire('Success', 'Registration Success.', 'success');
                } else if (res.message === 'email already in use') {
                    Swal.fire('Warning', 'Email already in use.', 'warning');
                } else {
                    Swal.fire('Warning', 'Something went wrong. Contact the administrator.', 'warning');
                }
            },
        });
    } else {
        Swal.fire('Warning', 'At least one required field is incomplete.', 'warning');
    }
}
