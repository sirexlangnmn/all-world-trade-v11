function paymentAccount() {
    $.ajax({
        url: '/api/post/email-payment-account',
        type: 'POST',
        data: {
            email: sessionEmail,
        },
        success: function (data) {
            if (data === 'email sent') {
                Swal.fire('Success', 'Email Sent. Kindly check you email address inbox or spam folder', 'success');
            } else {
                Swal.fire('Warning', 'Email not sent. Report to customer service', 'warning');
            }
        },
        error: function (e) {
            // some code here
        },
    });
}
