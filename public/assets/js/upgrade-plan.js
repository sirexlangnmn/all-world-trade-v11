$(function () {
    getUser();
    getUsersAccount();
});

function getUser() {
    $.ajax({
        url: '/api/get/user',
        type: 'POST',
        success: function (data) {
            document.getElementById('text-xl-name').innerHTML = 'Pick your Plan, ' + data[0].first_name;
        },
    });
}

function getUsersAccount() {
    $.ajax({
        url: '/api/get/users-account',
        type: 'POST',
        success: function (data) {
            if (data[0].type === 1) {
                $('#mediumScale').prop('disabled', true);
                document.getElementById('mediumScale').style.display = 'none';
                $('#largeScale').prop('disabled', true);
                document.getElementById('largeScale').style.display = 'none';
                $('#tradersScale').prop('disabled', true);
                document.getElementById('tradersScale').style.display = 'none';
            }
            if (data[0].type === 2) {
                $('#mediumScale').prop('disabled', true);
                document.getElementById('mediumScale').style.display = 'none';
                $('#largeScale').prop('disabled', true);
                document.getElementById('largeScale').style.display = 'none';
            }
            if (data[0].type === 3) {
                $('#mediumScale').prop('disabled', true);
                document.getElementById('mediumScale').style.display = 'none';
            }
        },
    });
}

document.getElementById('mediumScale').addEventListener('click', (e) => {
    location.replace(host + '/upgrade-to-medium-scale');
});

document.getElementById('largeScale').addEventListener('click', (e) => {
    location.replace(host + '/upgrade-to-large-scale');
});

document.getElementById('tradersScale').addEventListener('click', (e) => {
    location.replace(host + '/upgrade-to-traders');
});
