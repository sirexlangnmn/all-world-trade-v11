const forgotPasswordForm = $('#forgotPasswordForm');
forgotPasswordForm.on('submit', forgotPasswordSubmitHandler);

function forgotPasswordSubmitHandler(e) {
    e.preventDefault();

    $.ajax({
        url: '/api/post/forgot-password-process',
        type: 'POST',
        data: forgotPasswordForm.serialize(),
        success: function (res) {
            Swal.fire('Success', 'Email Send Successfully', 'success');
            if (res.message === 'found') {
                createResetToken(res.email_or_social_media, res.password, res.uuid);
            } else {
                Swal.fire('Warning', 'Email not found', 'warning');
            }
        },
    });
}

function createResetToken(email, password, uuid) {
    $.ajax({
        url: '/api/post/create-reset-token',
        type: 'POST',
        data: {
            uuid: uuid,
            password: password,
            email_or_social_media: email,
        },
        success: function (data) {
            if (data.message == 'reset tokens saved') {
                sendEmailForChangePasswordRequest(data);
            } else {
            }
        },
        error: function (e) {
            // some code here
        },
    });
}

function sendEmailForChangePasswordRequest(data) {
    $.ajax({
        url: '/api/post/send-email-for-change-password',
        type: 'POST',
        data: {
            uuid: data.uuid,
            link: data.link,
            receiverEmailAddress: data.receiverEmailAddress,
        },
        success: function (data) {
            if (data == 'email sent') {
                // location.replace(host + '/login');
            } else {
            }
        },
        error: function (e) {
            // some code here
        },
    });
}
