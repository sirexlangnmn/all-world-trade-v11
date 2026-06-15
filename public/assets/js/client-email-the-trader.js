getId('goToClientEmailTheTrader').addEventListener('click', goToClientEmailTheTraderModal);
getId('divContactTheTrader').addEventListener('click', goToClientEmailTheTraderModal);
getId('btnClientEmailTheTrader').addEventListener('click', submitClientEmailToTheTrader);

function goToClientEmailTheTraderModal() {
    const selectionCompanyName = getId('selection-company-name').textContent;
    getId('clientEmailTheTraderModalTitle').textContent = 'Email ' + selectionCompanyName;
    getId('clientEmailTheTraderModalParagraph').textContent = 'Send an email to ' + selectionCompanyName;
    getId('cett_company_name').value = selectionCompanyName;

    const clientEmailTheTraderModal = UIkit.modal('#client-email-the-trader-modal');
    clientEmailTheTraderModal.show();
}

function submitClientEmailToTheTrader(e) {
    e.preventDefault();
    const formSubmit = $('#formClientEmailTheTraderModal');

    $.ajax({
        url: '/api/v3/post/submit-client-email-to-the-trader',
        type: 'POST',
        data: formSubmit.serialize(),
        success: function (res) {
            $('#client-email-the-trader-modal form')[0].reset();
            var modal = UIkit.modal('#client-email-the-trader-modal');
            modal.hide();

            console.log('submitClientEmailToTheTrader res', res);
            if (res.success === true) {
                Swal.fire('Success', 'Message has been submitted successfully.', 'success');
            } else {
                Swal.fire('Warning', 'Something went wrong. Please contact the administrator', 'warning');
            }
        },
    });
}
