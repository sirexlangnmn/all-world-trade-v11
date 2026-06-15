let btnRegistration;

let password;
let plainPassword;
let confirmPassword;
let hashedPassword;
let plainPasswordInput;
let hashedPasswordInput;

btnRegistration = getId('btnRegistration');

password = getId('password');
plainPassword = getId('plainPassword');
confirmPassword = getId('confirmPassword');
hashedPassword = getId('hashedPassword');
plainPasswordInput = getId('plainPasswordInput');
hashedPasswordInput = getId('hashedPasswordInput');

hashedPasswordInput.style.display = 'none';
plainPasswordInput.style.display = 'none';

// consume api to get all languages
async function getLanguages() {
    let response = await fetch(host + '/api/get/languages');
    let data = await response.json();
    return data;
}

// display all languages in frontend select option
getLanguages().then((data) => {
    language.innerHTML = '<option value="select">Select</option>';
    for (var i = 0; i < data.length; i++) {
        language.innerHTML =
            language.innerHTML + '<option value="' + data[i]['code'] + '">' + data[i]['name'] + '</option>';
    }
    $('#language').selectpicker('refresh');
});

password.onkeyup = function () {
    hashedPasswordProcess();
    required(password, passwordValidation, 'Password');
};

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

password.addEventListener('blur', function () {
    passwordComparison('password', 'confirmPassword');
});

confirmPassword.addEventListener('blur', function () {
    passwordComparison('password', 'confirmPassword');
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

btnRegistration.addEventListener('click', (e) => {
    //stop submit the form, we will post it manually.
    e.preventDefault();

    const form = $('#lookingForMediumScaleCompanyForm');

    // uncomment the following line after to finish the server side validation
    //let validation = registrationValidation();
    let validation = 'true';

    if (validation === 'true') {
        //     //if (validation != '') {
        $.ajax({
            // url: '/api/post/looking-for-medium-scale-company-registration',
            url: '/api/v2/post/medium-scale-company-registration',
            type: 'post',
            data: form.serialize(),
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
