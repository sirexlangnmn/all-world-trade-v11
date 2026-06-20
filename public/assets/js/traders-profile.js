$(function () {
    getUsersLogoAndBanner();
    getCompanyDetails();
    getUser();
    getUsersAccount();
    getUsersAddress();
    getUsersBusinessCharacteristics();
    getUsersBusinessBrochures();

    // NOTE:  I have to halt in calling this function. This function will be modified in the future.
    // getUsersBusinessVideos();
});

let liTabCompanyDetails;
let liTabMediaFiles;
let liTabVideos;
let liTabSettings;
let liTabPaymentAccount;

let tabCompanyDetails;
let tabMediaFiles;
let tabVideos;
let tabSettings;
let tabPaymentAccount;

let divCompanyDetails;
let divMediaFiles;
let divVideos;
let divSettings;
let divPaymentAccount;

let videoLists;
let videoPlay;
let iframeVideoPlay;

let btnCompanyDetailsEdit;
let btnForUpdateCompanyDetails;
let btnCompanyDetailsCancelEdit;
let divCompanyRepresentative;
let formCompanyDetails;
let showCompanyDetails;

let displayLanguageOfComm;

let companyLogoPreview;
let companyBannerPreview;
let companyLogoId;
let companyBannerId;

let displayBusinessNameH1;
let displayBusinessTagLineH1;
let displayBusinessContact;
let displayBusinessSocialMediaContact;
let displayBusinessEmail;
let displayBusinessAddress;
let displayBusinessRegionOfOperation;
let displayBusinessCountryOfOperation;
let displayBusinessStatesOfOperation;
let displayBusinessCityOfOperation;

let displayBusinessTradeCategory;
let displayBusinessSubCategory;
let displayBusinessMinorCategory;
let displayBusinessScale;
let displayBusinessTags;

let videoInput;
let videoName;
let thumbnailInput;
let thumbnailName;
let btnUploadFile;

let businessVideosList;

let businessBrochureList;
let brochure;
let brochureFilename;
let btnUploadBrochure;

let editBrochure;
let editBrochureFilename;
let btnEditUploadBrochure;

let userImage;
let isAvatar;

liTabCompanyDetails = getId('liTabCompanyDetails');
liTabMediaFiles = getId('liTabMediaFiles');
liTabVideos = getId('liTabVideos');
liTabSettings = getId('liTabSettings');
liTabPaymentAccount = getId('liTabPaymentAccount');

tabCompanyDetails = getId('tabCompanyDetails');
tabMediaFiles = getId('tabMediaFiles');
tabVideos = getId('tabVideos');
tabSettings = getId('tabSettings');
tabPaymentAccount = getId('tabPaymentAccount');

divCompanyDetails = getId('divCompanyDetails');
divMediaFiles = getId('divMediaFiles');
divVideos = getId('divVideos');
divSettings = getId('divSettings');
divPaymentAccount = getId('divPaymentAccount');

videoLists = getId('videoLists');
videoPlay = getId('videoPlay');
iframeVideoPlay = getId('iframeVideoPlay');

btnCompanyDetailsEdit = getId('btnCompanyDetailsEdit');
formCompanyDetails = getId('formCompanyDetails');
showCompanyDetails = getId('showCompanyDetails');
btnForUpdateCompanyDetails = getId('btnForUpdateCompanyDetails');
btnCompanyDetailsCancelEdit = getId('btnCompanyDetailsCancelEdit');
divCompanyRepresentative = getId('divCompanyRepresentative');

displayLanguageOfComm = getId('displayLanguageOfComm');

companyLogoPreview = getId('companyLogoPreview');
companyBannerPreview = getId('companyBannerPreview');
companyLogoId = getId('companyLogoId');
companyBannerId = getId('companyBannerId');

displayBusinessNameH1 = getId('displayBusinessNameH1');
displayBusinessTagLineH1 = getId('displayBusinessTagLineH1');
displayBusinessContact = getId('displayBusinessContact');
displayBusinessSocialMediaContact = getId('displayBusinessSocialMediaContact');
displayBusinessAddress = getId('displayBusinessAddress');

displayBusinessRegionOfOperation = getId('displayBusinessRegionOfOperation');
displayBusinessCountryOfOperation = getId('displayBusinessCountryOfOperation');
displayBusinessStatesOfOperation = getId('displayBusinessStatesOfOperation');
displayBusinessCityOfOperation = getId('displayBusinessCityOfOperation');

displayBusinessTradeCategory = getId('displayBusinessTradeCategory');
displayBusinessSubCategory = getId('displayBusinessSubCategory');
displayBusinessMinorCategory = getId('displayBusinessMinorCategory');
displayBusinessScale = getId('displayBusinessScale');
displayBusinessTags = getId('displayBusinessTags');

videoInput = getId('videoInput');
videoName = getId('videoName');
thumbnailInput = getId('thumbnailInput');
thumbnailName = getId('thumbnailName');

businessVideosList = getId('businessVideosList');

businessBrochureList = getId('businessBrochureList');
brochure = getId('brochure');
brochureFilename = getId('brochureFilename');
btnUploadBrochure = getId('btnUploadBrochure');

editBrochure = getId('editBrochure');
editBrochureFilename = getId('editBrochureFilename');
btnEditUploadBrochure = getId('btnEditUploadBrochure');

userImage = getId('user-image');
isAvatar = getId('is_avatar');

tabCompanyDetails.addEventListener('click', (e) => {
    liTabVideos.classList.remove('active');
    liTabMediaFiles.classList.remove('active');
    liTabSettings.classList.remove('active');
    liTabPaymentAccount.classList.remove('active');
    liTabCompanyDetails.classList.add('active');

    divCompanyDetails.style.display = 'block';
    divCompanyRepresentative.style.display = 'block';
    divMediaFiles.style.display = 'none';
    divVideos.style.display = 'none';
    videoLists.style.display = 'none';
    videoPlay.style.display = 'none';
    divSettings.style.display = 'none';
    divPaymentAccount.style.display = 'none';
});

btnCompanyDetailsEdit.addEventListener('click', (e) => {
    showCompanyDetails.style.display = 'none';
    formCompanyDetails.style.display = 'block';
    btnCompanyDetailsEdit.style.display = 'none';
    btnForUpdateCompanyDetails.style.display = 'block';
});

btnCompanyDetailsCancelEdit.addEventListener('click', (e) => {
    showCompanyDetails.style.display = 'block';
    formCompanyDetails.style.display = 'none';
    btnCompanyDetailsEdit.style.display = 'block';
    btnForUpdateCompanyDetails.style.display = 'none';
});

function getCompanyDetails() {
    $.ajax({
        url: '/api/get/company-details',
        type: 'POST',
        success: function (data) {
            displayBusinessAddress.innerHTML = data[0].business_address;
            getCityNameToBeDisplayUsingCode(data[0].business_city, 'displayBusinessAddressCity');
            getStatesNameToBeDisplayUsingCode(data[0].business_states, 'displayBusinessAddressStates');
            getCountryNameUsingCode(data[0].business_country, 'displayBusinessAddressCountry');
            displayBusinessNameH1.innerHTML = data[0].business_name;
            displayBusinessTagLineH1.innerHTML = data[0].business_tagline;
            displayBusinessContact.innerHTML = data[0].business_contact;
            displayBusinessSocialMediaContact.innerHTML = data[0].business_social_media_contact_number;
            displayBusinessEmail.innerHTML = data[0].business_email;
            getRegionNameUsingCode(data[0].region_of_operation);
            getCityOfOperationNameUsingCode(data[0].city_of_operation, 'displayBusinessCityOfOperation');
            getStatesOfOperationNameUsingCode(data[0].states_of_operation, 'displayBusinessStatesOfOperation');
            getCountryOfOperationNameUsingCode(data[0].country_of_operation, 'displayBusinessCountryOfOperation');
            getLanguageName(data[0].business_language_of_communication);
        },
    });
}

function getRegionNameUsingCode(string) {
    if (string) {
        let data = string.split(',');
        for (var i = 0; i < data.length; i++) {
            displayBusinessRegionOfOperation.innerHTML =
                displayBusinessRegionOfOperation.innerHTML +
                '<a href="#" class="bg-gray-200 py-1.5 px-4 rounded-full">' +
                data[i] +
                '</a>';
        }
    } else {
        displayBusinessRegionOfOperation.innerHTML = 'N/A';
    }
}

function getUsersBusinessCharacteristics() {
    $.ajax({
        url: '/api/get/user-business-characteristics',
        type: 'POST',
        success: function (data) {
            displayBusinessTradeCategory.innerHTML = getTradeCategoriesTitleById(data[0].business_major_category);
            displayBusinessSubCategory.innerHTML = getSubCategoriesTitleById(
                data[0].business_sub_category,
                data[0].business_sub_category_str,
            );
            displayBusinessMinorCategory.innerHTML = getMinorSubCategoriesTitleById(
                data[0].business_minor_sub_category,
                data[0].business_minor_sub_category_str,
            );
            displayBusinessScale.innerHTML = getBusinessScaleTitle(data[0].business_scale);
            formattingBusinessTags(data[0].business_industry_belong_to);
        },
    });
}

function formattingBusinessTags(string) {
    if (string) {
        let data = string.split(',');
        for (var i = 0; i < data.length; i++) {
            displayBusinessTags.innerHTML =
                displayBusinessTags.innerHTML +
                '<a href="#" class="bg-gray-200 py-1.5 px-4 rounded-full">' +
                data[i] +
                '</a>';
        }
    } else {
        displayBusinessTags.innerHTML = 'N/A';
    }
}

tabMediaFiles.addEventListener('click', (e) => {
    divCompanyDetails.style.display = 'none';
    divCompanyRepresentative.style.display = 'none';
    divVideos.style.display = 'none';
    videoLists.style.display = 'none';
    videoPlay.style.display = 'none';
    divSettings.style.display = 'none';
    divPaymentAccount.style.display = 'none';
    divMediaFiles.style.display = 'block';

    liTabCompanyDetails.classList.remove('active');
    liTabVideos.classList.remove('active');
    liTabSettings.classList.remove('active');
    liTabPaymentAccount.classList.remove('active');
    liTabMediaFiles.classList.add('active');
});

tabSettings.addEventListener('click', (e) => {
    liTabSettings.classList.add('active');
    liTabCompanyDetails.classList.remove('active');
    liTabVideos.classList.remove('active');
    liTabMediaFiles.classList.remove('active');
    liTabPaymentAccount.classList.remove('active');

    divCompanyDetails.style.display = 'none';
    divCompanyRepresentative.style.display = 'none';
    divVideos.style.display = 'none';
    videoLists.style.display = 'none';
    videoPlay.style.display = 'none';
    divMediaFiles.style.display = 'none';
    divPaymentAccount.style.display = 'none';
    divSettings.style.display = 'block';
});

tabPaymentAccount.addEventListener('click', (e) => {
    liTabPaymentAccount.classList.add('active');
    liTabSettings.classList.remove('active');
    liTabCompanyDetails.classList.remove('active');
    liTabVideos.classList.remove('active');
    liTabMediaFiles.classList.remove('active');

    divCompanyDetails.style.display = 'none';
    divCompanyRepresentative.style.display = 'none';
    divVideos.style.display = 'none';
    videoLists.style.display = 'none';
    videoPlay.style.display = 'none';
    divMediaFiles.style.display = 'none';
    divSettings.style.display = 'none';
    divPaymentAccount.style.display = 'block';
});

tabVideos.addEventListener('click', (e) => {
    liTabPaymentAccount.classList.remove('active');
    liTabSettings.classList.remove('active');
    liTabCompanyDetails.classList.remove('active');
    liTabMediaFiles.classList.remove('active');
    liTabVideos.classList.add('active');

    divSettings.style.display = 'none';
    divPaymentAccount.style.display = 'none';
    divMediaFiles.style.display = 'none';
    divCompanyDetails.style.display = 'none';
    divCompanyRepresentative.style.display = 'none';
    divVideos.style.display = 'block';
    videoLists.style.display = 'block';
    videoPlay.style.display = 'none';
});

function playVideos(link) {
    divVideos.style.display = 'block';
    videoLists.style.display = 'none';
    videoPlay.style.display = 'block';

    iframeVideoPlay.src = link;
}

videoInput.addEventListener('change', videoInputFileName);
thumbnailInput.addEventListener('change', thumbnailInputFileName);

function videoInputFileName() {
    let fileName = videoInput.value;
    videoName.innerHTML = fileName;
}
function thumbnailInputFileName() {
    let fileName = thumbnailInput.value;
    thumbnailName.innerHTML = fileName;
}

btnUploadFile = getId('btnUploadFile');

// NOTE:  I have to halt in calling this function. This function will be modified in the future.
// btnUploadFile.addEventListener('click', (e) => {
//     //stop submit the form, we will post it manually.
//     e.preventDefault();

//     // Get form
//     let form = $('#uploadFileForm')[0];

//     // Create an FormData object
//     let data = new FormData(form);

//     $.ajax({
//         type: 'POST',
//         enctype: 'multipart/form-data',
//         url: '/api/post/upload-video2',
//         data: data,
//         processData: false,
//         contentType: false,
//         cache: false,
//         timeout: 800000,
//         success: function (data) {
//             if (data === 'success') {
//                 var modal = UIkit.modal('#create-post-modal');
//                 modal.hide();

//                 // NOTE:  I have to halt in calling this function. This function will be modified in the future.
//                 // getUsersBusinessVideos();
//             }
//         },
//         error: function (e) {
//             // some code here
//         },
//     });
// });

// display all users business videos in frontend profiles
// NOTE:  I have to halt in calling this function. This function will be modified in the future.
function getUsersBusinessVideos() {
    $('#businessVideosList').empty();

    $.ajax({
        url: '/api/get/users-business-videos',
        type: 'GET',
        success: function (data) {
            for (var i = 0; i < data.length; i++) {
                if (data[i]['video'] !== null) {
                    businessVideosList.innerHTML =
                        businessVideosList.innerHTML +
                        "<li class='mb-10' onclick='playVideos(\"" +
                        host +
                        '/uploads/users_upload_files/' +
                        data[i]['video'] +
                        '")\'>' +
                        '<a href="#" class="w-full md:h-44 h-28 overflow-hidden rounded-lg relative block">' +
                        '<img src="' +
                        host +
                        '/uploads/users_upload_files/' +
                        data[i]['video_thumbnail'] +
                        '" alt="" class="w-full h-full absolute inset-0 object-cover" />' +
                        '<span class=" absolute bg-black bg-opacity-60 bottom-1 font-semibold px-1.5 py-0.5 right-1 rounded text-white text-xs">12:21</span>' +
                        '<img src="assets/images/icon-play.svg" class="w-12 h-12 uk-position-center" alt="" /></a>' +
                        '<div class="pt-3">' +
                        '<a href="#" class="font-semibold line-clamp-2">' +
                        data[i]['video_title'] +
                        '</a>' +
                        '<div class="pt-2">' +
                        '<a href="#" href="#" class="text-sm">' +
                        data[i]['video_description'] +
                        '</a>' +
                        '</div>' +
                        '</div>' +
                        '</li>';
                }
            }
        },
    });
}

// display all users logo and banners in frontend profiles
function getUsersLogoAndBanner() {
    $.ajax({
        url: '/api/get/users-logo-and-banners',
        type: 'GET',
        success: function (data) {
            if (data.length > 0) {
                if (data[0].banner) {
                    companyBannerPreview.src = host + '/uploads/users_upload_files/' + data[0].banner;
                } else {
                    companyBannerPreview.src = host + '/uploads/placeholder/banner-placeholder.png';
                }
                if (data[0].logo) {
                    companyLogoPreview.src = host + '/uploads/users_upload_files/' + data[0].logo;
                    userImage.src = host + '/uploads/users_upload_files/' + data[0].logo;
                    isAvatar.src = host + '/uploads/users_upload_files/' + data[0].logo;
                } else {
                    companyLogoPreview.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                    userImage.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                    isAvatar.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                }
                companyLogoId.value = data[0].id;
                companyBannerId.value = data[0].id;
            } else {
                companyBannerPreview.src = host + '/uploads/placeholder/banner-placeholder.png';
                companyLogoPreview.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                userImage.src = host + '/uploads/placeholder/logo-placeholder.jpg';
                isAvatar.src = host + '/uploads/placeholder/logo-placeholder.jpg';
            }
        },
    });
}

companyLogo.onchange = (evt) => {
    const [file] = companyLogo.files;
    if (file) {
        companyLogoPreview.src = URL.createObjectURL(file);
        editcompanyLogo();
    }
};

companyBanner.onchange = (evt) => {
    const [file] = companyBanner.files;
    if (file) {
        companyBannerPreview.src = URL.createObjectURL(file);
        editcompanyBanner();
    }
};

function getLanguageName(string) {
    let data = string.split(',');
    for (var i = 0; i < data.length; i++) {
        displayLanguageOfComm.innerHTML =
            displayLanguageOfComm.innerHTML +
            '<a href="#" class="bg-gray-200 py-1.5 px-4 rounded-full">' +
            getLanguageNameByCode(data[i]) +
            '</a>';
    }
}

function getLanguageNameByCode(code) {
    let value;
    $.ajax({
        url: host + '/api/get/language-name-by-code/' + code,
        async: false,
        success: function (data) {
            value = data[0].name;
        },
    });
    return value;
}

function getTradeCategoriesTitleById(id) {
    let value;
    $.ajax({
        url: host + '/api/get/trade-category-title-by-id/' + id,
        async: false,
        success: function (data) {
            value = data[0].title;
        },
    });
    return value;
}

function getSubCategoriesTitleById(id, str) {
    if (id) {
        let value;
        $.ajax({
            url: host + '/api/get/sub-category-title-by-id/' + id,
            async: false,
            success: function (data) {
                value = data[0].title;
            },
        });
        return value;
    }

    if (str) {
        return str;
    }
}

function getMinorSubCategoriesTitleById(id, str) {
    if (id || str) {
        if (id) {
            let value;
            $.ajax({
                url: host + '/api/get/minor-sub-category-title-by-id/' + id,
                async: false,
                success: function (data) {
                    value = data[0].title;
                },
            });
            return value;
        }

        if (str) {
            return str;
        }
    } else {
        return 'N/A';
    }
}

function getBusinessScaleTitle(id) {
    let value;

    switch (id) {
        case 1:
            value = 'Small Scale';
            break;
        case 2:
            value = 'Medium Scale';
            break;
        case 3:
            value = 'Large Scale';
            break;
        default:
            value = 'N/A';
    }

    return value;
}

// display all users business brochure in frontend profiles
function getUsersBusinessBrochures() {
    $('#businessBrochureList').empty();

    $.ajax({
        url: '/api/get/users-business-brochures',
        type: 'GET',
        success: function (data) {
            for (var i = 0; i < data.length; i++) {
                if (data[i]['brochure'] !== null) {
                    let id = data[i]['id'];
                    let brochure_title = data[i]['brochure_title'];
                    let brochure = data[i]['brochure'];
                    let fields = brochure.split('.');
                    let fileExtension = fields[1];

                    let display;

                    if (fileExtension === 'pdf') {
                        display =
                            '<a href="' +
                            host +
                            '/uploads/users_upload_files/' +
                            data[i]['brochure'] +
                            '" target="_blank">' +
                            '<img src="uploads/brochure/pdf-placeholder.png" class="h-96 object-cover rounded-t-md shadow-sm w-full">' +
                            '</a>';
                    } else {
                        display =
                            '<div uk-lightbox>' +
                            '<a href="' +
                            host +
                            '/uploads/users_upload_files/' +
                            data[i]['brochure'] +
                            '">' +
                            '<img src="' +
                            host +
                            '/uploads/users_upload_files/' +
                            data[i]['brochure'] +
                            '" alt="" class="h-96 w-full object-cover">' +
                            '</a>' +
                            '</div>';
                    }

                    businessBrochureList.innerHTML =
                        businessBrochureList.innerHTML +
                        '<li class="mb-2.5">' +
                        '<div class="card">' +
                        display +
                        '<div class="p-3" id="">' +
                        '<div class="p-3">' +
                        '<h4 class="text-base font-semibold mb-0.5">' +
                        brochure_title +
                        '</h4>' +
                        '<br />' +
                        "<a href='#' class='bg-blue-600 flex flex-1 h-8 items-center justify-center rounded-md text-white capitalize blue-white-hover' onclick='editUploadBrochureModal(\"" +
                        id +
                        ',' +
                        brochure_title +
                        '")\'> Edit </a>' +
                        '</div>' +
                        '</div>' +
                        '</div>' +
                        '</li>';
                }
            }
        },
    });
}

function editUploadBrochureModal(param) {
    let fields = param.split(',');
    let id = fields[0];
    let title = fields[1];

    let uploadBrochureHeadTitle;
    let editBrochureTitle;
    let editBrochureId;

    uploadBrochureHeadTitle = getId('uploadBrochureHeadTitle');
    editBrochureTitle = getId('editBrochureTitle');
    editBrochureId = getId('editBrochureId');
    uploadBrochureHeadTitle.innerHTML = 'Edit' + ' ' + title;
    editBrochureTitle.value = title;
    editBrochureId.value = id;

    var modal = UIkit.modal('#edit-upload-brochure-modal');
    modal.show();
}

function getUser() {
    $.ajax({
        url: '/api/get/user',
        type: 'POST',
        success: function (data) {
            document.getElementById('displayReprestativeFullname').innerHTML =
                data[0].first_name + ' ' + data[0].last_name;
        },
    });
}

function getUsersAccount() {
    $.ajax({
        url: '/api/get/users-account',
        type: 'POST',
        success: function (data) {
            document.getElementById('displayReprestativeEmailAddress').innerHTML = data[0].email_or_social_media;
            document.getElementById('displayReprestativeContactNumber').innerHTML = data[0].contact_number;
        },
    });
}

function getUsersAddress() {
    $.ajax({
        url: '/api/get/users-address',
        type: 'POST',
        success: function (data) {
            document.getElementById('displayReprestativeAddress').innerHTML = data[0].address;
            getCityNameToBeDisplayUsingCode(data[0].city, 'displayReprestativeAddressCity');
            getStatesNameToBeDisplayUsingCode(data[0].state_or_province, 'displayReprestativeAddressStates');
            getCountryNameUsingCode(data[0].country, 'displayReprestativeAddressCountry');
        },
    });
}

function getCountryNameUsingCode(code, elementId) {
    if (code) {
        fetch('assets/json/countries.json')
            .then(function (resp) {
                return resp.json();
            })
            .then(function (data) {
                let filtered = data.filter((d) => d.iso2 == code);
                document.getElementById(elementId).innerHTML = filtered[0].name;
            });
    } else {
        document.getElementById(elementId).innerHTML = 'N/A';
    }
}

function getCountryOfOperationNameUsingCode(code, elementId) {
    if (code) {
        let data = code.split(',');
        for (var i = 0; i < data.length; i++) {
            document.getElementById(elementId).innerHTML =
                document.getElementById(elementId).innerHTML +
                '<a href="#" class="bg-gray-200 py-1.5 px-4 rounded-full">' +
                data[i] +
                '</a>';
        }
    } else {
        document.getElementById(elementId).innerHTML = 'N/A ';
    }
}

function getStatesOfOperationNameUsingCode(code, elementId) {
    if (code) {
        if (code === 'No States Found') {
            document.getElementById(elementId).innerHTML = 'N/A';
        } else {
            fetch('assets/json/states.json')
                .then(function (resp) {
                    return resp.json();
                })
                .then(function (data) {
                    let filtered = data.filter((d) => d.id == code);
                    document.getElementById(elementId).innerHTML = filtered[0].name;
                });
        }
    } else {
        document.getElementById(elementId).innerHTML = 'N/A';
    }
}

function getCityOfOperationNameUsingCode(code, elementId) {
    if (code) {
        fetch('assets/json/cities.json')
            .then(function (resp) {
                return resp.json();
            })
            .then(function (data) {
                let filtered = data.filter((d) => d.id == code);
                document.getElementById(elementId).innerHTML = filtered[0].name + ', ';
            });
    } else {
        document.getElementById(elementId).innerHTML = 'N/A ';
    }
}

brochure.addEventListener('change', brochureInputFileName);
function brochureInputFileName() {
    let fileName = brochure.value;
    brochureFilename.innerHTML = fileName;
}

btnUploadBrochure.addEventListener('click', (e) => {
    //stop submit the form, we will post it manually.
    e.preventDefault();

    // Get form
    let form = $('#uploadBrochureForm')[0];

    // Create an FormData object
    let data = new FormData(form);

    $.ajax({
        type: 'POST',
        enctype: 'multipart/form-data',
        url: '/api/post/upload-brochure',
        data: data,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        success: function (data) {
            if (data === 'success') {
                brochureFilename.innerHTML = 'Choose File';
                $('#upload-brochure-modal form')[0].reset();
                var modal = UIkit.modal('#upload-brochure-modal');
                modal.hide();
                getUsersBusinessBrochures();
            }
        },
        error: function (e) {},
    });
});

editBrochure.addEventListener('change', editBrochureInputFileName);
function editBrochureInputFileName() {
    let fileName = editBrochure.value;
    editBrochureFilename.innerHTML = fileName;
}

btnEditUploadBrochure.addEventListener('click', (e) => {
    //stop submit the form, we will post it manually.
    e.preventDefault();

    // Get form
    let form = $('#editUploadBrochureForm')[0];

    // Create an FormData object
    let data = new FormData(form);

    $.ajax({
        type: 'POST',
        enctype: 'multipart/form-data',
        url: '/api/post/update-upload-brochure',
        data: data,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        success: function (data) {
            if (data === 'success') {
                editBrochureFilename.innerHTML = 'Choose File';
                $('#edit-upload-brochure-modal form')[0].reset();
                var modal = UIkit.modal('#edit-upload-brochure-modal');
                modal.hide();
                getUsersBusinessBrochures();
            }
        },
        error: function (e) {},
    });
});

function editcompanyLogo() {
    // Get form
    let form = $('#editcompanyLogo')[0];

    // Create an FormData object
    let data = new FormData(form);

    $.ajax({
        type: 'POST',
        enctype: 'multipart/form-data',
        url: '/api/post/update-trader-company-logo',
        data: data,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        success: function (data) {
            // some code here
        },
        error: function (jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 413) {
                console.error('Request Entity Too Large');
                console.log('Request Entity Too Large');
                Swal.fire('Warning', 'Try to upload file image lower than 1mb', 'warning');
                // Handle error response
            }
        },
    });
}

function editcompanyBanner() {
    // Get form
    let form = $('#editcompanyBanner')[0];

    // Create an FormData object
    let data = new FormData(form);

    $.ajax({
        type: 'POST',
        enctype: 'multipart/form-data',
        url: '/api/post/update-trader-company-banner',
        data: data,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 800000,
        async: true,
        success: function (data) {
            // some code here
        },
        // error: function (e) {},
        error: function (jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 413) {
                console.error('Request Entity Too Large');
                console.log('Request Entity Too Large');
                Swal.fire('Warning', 'Try to upload file image lower than 1mb', 'warning');
                // Handle error response
            }
        },
    });
}

function createCommunicatorLink() {
    $.ajax({
        url: '/api/get/create-communicator-link',
        type: 'POST',
        success: function (data) {
            if (data.communicator) {
                // const domainLink = 'https://meet2.allworldtrade.com/groupcall/' //old
                const domainLink = 'https://meet.allworldtrade.com/join/'; //new
                window.open(domainLink + data.communicator, '_blank');
            } else {
            }
        },
    });
}

function editProfile() {
    // location.replace(host + '/edit-traders-profile');
    location.href = '/edit-traders-profile';
}

function backProfile() {
    location.replace(host + '/profile');
}

function downloadCurrentVisitorData() {
    $.ajax({
        url: '/api/post/get-current-visitor',
        type: 'POST',
        success: function (res) {
            if (res.length > 0) {
                Swal.fire({
                    title: 'Download?',
                    text: 'Do you want to download visitor details?',
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Yes, download!',
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.location = host + '/download-current-visitor-data';
                    }
                });
            } else {
                Swal.fire('Success', 'Currently No Visitors', 'success');
            }
        },
    });
}
