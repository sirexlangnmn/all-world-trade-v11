let userImageOutsideProfile = getId('user-image');
let isAvatarOutsideProfile = getId('is_avatar');

window.onload = function () {
    getUsersLogoAndBanner();
};

function getUsersLogoAndBanner() {
    $.ajax({
        url: '/api/get/users-logo-and-banners',
        type: 'GET',
        success: function (data) {
            if (data.length > 0) {
                if (data[0].logo) {
                    userImageOutsideProfile.src = host + '/uploads/users_upload_files/' + data[0].logo;
                    isAvatarOutsideProfile.src = host + '/uploads/users_upload_files/' + data[0].logo;
                } else {
                    userImageOutsideProfile.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                    isAvatarOutsideProfile.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                }
            } else {
                userImageOutsideProfile.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                isAvatarOutsideProfile.src = host + '/uploads/placeholder/logo-placeholder.jpg';
            }
        },
    });
}

function goToProfilePage() {
    location.replace(host + '/profile');
}

function goToUpgradeAccountPage() {
    location.replace(host + '/upgrade-plan');
}
