function goToLoginPage() {
    location.replace(host + '/login');
}

const resetPasswordForm = $('#resetPasswordForm');
resetPasswordForm.on('submit', forgotPasswordSubmitHandler);

const password1 = getId('password');
const password2 = getId('password2');

function forgotPasswordSubmitHandler(e) {
    e.preventDefault();

    let password_1 = password1.value;
    let password_2 = password2.value;

    if (password_1 === password_2) {
        $.ajax({
            url: window.location.href,
            type: 'POST',
            data: resetPasswordForm.serialize(),
            success: function (res) {
                if (res === 'reset password successfully') {
                    Swal.fire('Success', 'Reset Password Successfully.', 'success');
                    setInterval(function () {
                        location.replace(host + '/login');
                    }, 3000);
                } else {
                    Swal.fire('Warning', 'Something wrong. Contact your administrator', 'warning');
                }
            },
        });
    } else {
        Swal.fire('Warning', 'Confirm Password Failed', 'warning');
    }
}
