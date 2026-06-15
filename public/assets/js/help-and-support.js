// document.getElementById("btnCreateHelpAndSupportCommunicatorLink").addEventListener("click", createHelpAndSupportCommunicatorLink);

function goToHelpSuggestionPage() {
    $.ajax({
        url: '/api/v2/post/go-to-help-and-suggestion-page',
        type: 'POST',
        success: function (data) {
            if (data.length > 0) {
                const URL = 'https://meet.allworldtrade.com/join/' + data[0].communicator_link;
                window.open(URL, '_blank');
                occupied(data[0].communicator_link, data[0].support_accounts_uuid);
            } else {
                let emailifHelpAndSuggestLinkNotAvailableModal = UIkit.modal(
                    '#email-if-help-and-suggest-link-not-available-modal',
                );
                emailifHelpAndSuggestLinkNotAvailableModal.show();
            }
        },
    });
}

function occupied(communicator_link, support_accounts_uuid) {
    $.ajax({
        url: '/api/v2/post/update-as-occupied',
        type: 'POST',
        data: {
            communicator_link: communicator_link,
            support_accounts_uuid: support_accounts_uuid,
        },
        success: function (data) {
            console.log(data);
        },
    });
}

document
    .getElementById('btnEmailIfHelpAndSuggestLinkNotAvailable')
    .addEventListener('click', submitEmailIfHelpAndSuggestLinkNotAvailable);
document
    .getElementById('btnHiddenEmailIfHelpAndSuggestLinkNotAvailable')
    .addEventListener('click', submitEmailIfHelpAndSuggestLinkNotAvailable);

function submitEmailIfHelpAndSuggestLinkNotAvailable(e) {
    e.preventDefault();
    const formSubmit = $('#formEmailIfHelpAndSuggestLinkNotAvailable');
    console.log('formEmailIfHelpAndSuggestLinkNotAvailable');

    $.ajax({
        url: '/api/v2/post/submit-email-if-help-and-suggest-link-not-available',
        type: 'POST',
        data: formSubmit.serialize(),
        success: function (res) {
            $('#email-if-help-and-suggest-link-not-available-modal form')[0].reset();
            var modal = UIkit.modal('#email-if-help-and-suggest-link-not-available-modal');
            modal.hide();

            console.log('submit-email-if-help-and-suggest-link-not-available res', res);
            if (res.message === 'message has been submitted successfully') {
                Swal.fire('Success', 'Message has been submitted successfully.', 'success');
            } else {
                Swal.fire('Warning', 'Something went wrong. Please contact the administrator', 'warning');
            }
        },
    });
}
