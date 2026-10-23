function goToLoginPage() {
    location.replace(host + '/login');
}

const resetPasswordForm = $('#resetPasswordForm');
resetPasswordForm.on('submit', forgotPasswordSubmitHandler);

const password1 = getId('password');
const password2 = getId('password2');

function showWarning(message) {
    Swal.fire('Warning', message, 'warning');
}

function forgotPasswordSubmitHandler(e) {
    e.preventDefault();

    if (password1.value !== password2.value) {
        showWarning('Confirm Password Failed');
        return;
    }

    $.ajax({
        url: window.location.href,
        type: 'POST',
        data: resetPasswordForm.serialize(),
        success: function (res) {
            if (res !== 'reset password successfully') {
                showWarning('Something wrong. Contact your administrator');
                return;
            }

            Swal.fire('Success', 'Reset Password Successfully.', 'success');
            setTimeout(function () {
                location.replace(host + '/login');
            }, 3000);
        },
        error: function (xhr) {
            if (xhr && xhr.status === 429) {
                showWarning('Too many requests. Please try again later.');
            }
        },
    });
}
