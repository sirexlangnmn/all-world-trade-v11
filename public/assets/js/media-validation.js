function uploadCompanyMediaValidation(elementID, mediaType) {
    var input = document.getElementById(elementID);
    var file = input.files[0];

    var fileReader = new FileReader();
    fileReader.onloadend = function () {
        var arr = new Uint8Array(fileReader.result).subarray(0, 4);
        var header = '';
        for (var i = 0; i < arr.length; i++) {
            header += arr[i].toString(16);
        }
        var type = '';
        switch (header) {
            case '89504e47':
                type = 'image/png';
                break;
            // case "47494638":
            //     type = "image/gif";
            //     break;
            case 'ffd8ffe0':
            case 'ffd8ffe1':
            case 'ffd8ffe2':
                type = 'image/jpeg';
                break;
            default:
                console.log('Not a valid image file');
                if (mediaType === companyLogoValidation) {
                    mediaType.style.display = 'block';
                    mediaType.innerHTML = 'Not a valid image file';
                    mediaType.style.backgroundColor = 'black';
                    mediaType.style.position = 'relative';
                    mediaType.style.top = 0;
                    mediaType.style.bottom = '100px';
                    mediaType.style.left = 0;
                    mediaType.style.right = 0;
                    mediaType.style.opacity = 0.5;
                } else if (mediaType === companyBannerValidation) {
                    mediaType.style.display = 'block';
                    mediaType.innerHTML = 'Not a valid image file';
                }
                return;
        }

        // Check for double extensions
        var fileName = file.name;
        if (/\.(jpe?g|png|gif)\.\1$/.test(fileName)) {
            console.log('Double Extensions are not allowed');
            if (mediaType === companyLogoValidation) {
                mediaType.style.display = 'block';
                mediaType.innerHTML = 'Double Extensions are not allowed';
                mediaType.style.backgroundColor = 'black';
                mediaType.style.position = 'relative';
                mediaType.style.top = 0;
                mediaType.style.bottom = '100px';
                mediaType.style.left = 0;
                mediaType.style.right = 0;
                mediaType.style.opacity = 0.5;
            } else if (mediaType === companyBannerValidation) {
                mediaType.style.display = 'block';
                mediaType.innerHTML = 'Double Extensions are not allowed';
            }
            return;
        }

        // Check for file size
        var sizeLimit = 1 * 1024 * 1024; // 1 MB in bytes
        if (file.size > sizeLimit) {
            console.log('File size must be less than 1 MB');
            if (mediaType === companyLogoValidation) {
                mediaType.style.display = 'block';
                mediaType.innerHTML = 'File size limited to 1 MB';
                mediaType.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                mediaType.style.position = 'absolute';
                mediaType.style.top = 0;
                mediaType.style.bottom = 0;
                mediaType.style.left = 0;
                mediaType.style.right = 0;
                mediaType.style.pointerEvents = 'none'; //https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events
            } else if (mediaType === companyBannerValidation) {
                mediaType.style.display = 'block';
                mediaType.innerHTML = 'File size limited to 1 MB';
            }
            return;
        }
    };
    fileReader.readAsArrayBuffer(file);
}
