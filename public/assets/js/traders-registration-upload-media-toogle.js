let btnWantToUploadCompanyVideo;
let inputWantToUploadCompanyVideo;
let formWantToUploadCompanyVideo;
let btnCancelUploadCompanyVideo;

btnWantToUploadCompanyVideo = getId('btnWantToUploadCompanyVideo');
inputWantToUploadCompanyVideo = getId('inputWantToUploadCompanyVideo');
formWantToUploadCompanyVideo = getId('formWantToUploadCompanyVideo');
btnCancelUploadCompanyVideo = getId('btnCancelUploadCompanyVideo');

let btnWantToUploadCompanyBrochure;
let inputWantToUploadCompanyBrochure;
let formWantToUploadCompanyBrochure;
let btnCancelUploadCompanyBrochure;

btnWantToUploadCompanyBrochure = getId('btnWantToUploadCompanyBrochure');
inputWantToUploadCompanyBrochure = getId('inputWantToUploadCompanyBrochure');
formWantToUploadCompanyBrochure = getId('formWantToUploadCompanyBrochure');
btnCancelUploadCompanyBrochure = getId('btnCancelUploadCompanyBrochure');

let btnWantToUploadCompanyWebinar;
let inputWantToUploadCompanyWebinar;
let formWantToUploadCompanyWebinar;
let btnCancelUploadCompanyWebinar;

btnWantToUploadCompanyWebinar = getId('btnWantToUploadCompanyWebinar');
inputWantToUploadCompanyWebinar = getId('inputWantToUploadCompanyWebinar');
formWantToUploadCompanyWebinar = getId('formWantToUploadCompanyWebinar');
btnCancelUploadCompanyWebinar = getId('btnCancelUploadCompanyWebinar');

btnWantToUploadCompanyVideo.addEventListener('click', displayFormToUploadCompanyVideo);
btnCancelUploadCompanyVideo.addEventListener('click', cancelFormToUploadCompanyVideo);
btnWantToUploadCompanyBrochure.addEventListener('click', displayFormToUploadCompanyBrochure);
btnCancelUploadCompanyBrochure.addEventListener('click', cancelFormToUploadCompanyBrochure);
btnWantToUploadCompanyWebinar.addEventListener('click', displayFormToUploadCompanyWebinar);
btnCancelUploadCompanyWebinar.addEventListener('click', cancelFormToUploadCompanyWebinar);

function displayFormToUploadCompanyVideo() {
    inputWantToUploadCompanyVideo.value = 1;
    formWantToUploadCompanyVideo.style.display = 'block';
    btnCancelUploadCompanyVideo.style.display = 'block';
    btnWantToUploadCompanyVideo.style.display = 'none';
}

function cancelFormToUploadCompanyVideo() {
    inputWantToUploadCompanyVideo.value = '';
    formWantToUploadCompanyVideo.style.display = 'none';
    btnCancelUploadCompanyVideo.style.display = 'none';
    btnWantToUploadCompanyVideo.style.display = 'block';
}

function displayFormToUploadCompanyBrochure() {
    inputWantToUploadCompanyBrochure.value = 1;
    formWantToUploadCompanyBrochure.style.display = 'block';
    btnCancelUploadCompanyBrochure.style.display = 'block';
    btnWantToUploadCompanyBrochure.style.display = 'none';
}

function cancelFormToUploadCompanyBrochure() {
    inputWantToUploadCompanyBrochure.value = '';
    formWantToUploadCompanyBrochure.style.display = 'none';
    btnCancelUploadCompanyBrochure.style.display = 'none';
    btnWantToUploadCompanyBrochure.style.display = 'block';
}

function displayFormToUploadCompanyWebinar() {
    inputWantToUploadCompanyWebinar.value = 1;
    formWantToUploadCompanyWebinar.style.display = 'block';
    btnCancelUploadCompanyWebinar.style.display = 'block';
    btnWantToUploadCompanyWebinar.style.display = 'none';
}

function cancelFormToUploadCompanyWebinar() {
    inputWantToUploadCompanyWebinar.value = '';
    formWantToUploadCompanyWebinar.style.display = 'none';
    btnCancelUploadCompanyWebinar.style.display = 'none';
    btnWantToUploadCompanyWebinar.style.display = 'block';
}
