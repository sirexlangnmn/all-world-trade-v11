document
    .getElementById('btnCreateHelpAndSupportCommunicatorLink')
    .addEventListener('click', createHelpAndSupportCommunicatorLink);

function createHelpAndSupportCommunicatorLink() {
    $.ajax({
        url: '/api/v2/get/create-help-and-support-communicator-link',
        type: 'POST',
        success: function (data) {
            if (data.communicator_link) {
                // const domainLink = 'https://meet2.allworldtrade.com/groupcall/' //old
                const domainLink = 'https://meet.allworldtrade.com/join/'; //new
                window.open(domainLink + data.communicator_link, '_blank');
            } else {
                Swal.fire('Warning', 'Something went wrong. Please contact the administrator.', 'warning');
            }
        },
    });
}

document
    .getElementById('btnDropHelpAndSupportCommunicatorLink')
    .addEventListener('click', btnDropHelpAndSupportCommunicatorLink);

function btnDropHelpAndSupportCommunicatorLink() {
    $.ajax({
        url: '/api/v2/get/drop-help-and-support-communicator-link',
        type: 'POST',
        success: function (data) {
            if (data === 'drop successfully') {
                Swal.fire('Sucess', 'Succesfully drop communicator link.', 'success');
            } else if (data === 'no created link found') {
                Swal.fire('Sucess', 'No created link found', 'success');
            } else {
                Swal.fire('Warning', 'Something went wrong. Please contact the administrator.', 'warning');
            }
        },
    });
}

document.getElementById('btnSendEmailMarketing').addEventListener('click', sendEmailMarketing);

function sendEmailMarketing() {
    $.ajax({
        url: '/api/post/emails/introduction',
        type: 'POST',
        success: function (data) {
            console.log('sendEmailMarketing data: ', data);
        },
    });
}
