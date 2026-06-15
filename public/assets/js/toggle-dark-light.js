(function (window, document, undefined) {
    'use strict';
    if (!('localStorage' in window)) return;
    var nightMode = localStorage.getItem('gmtNightMode');

    if (nightMode) {
        document.documentElement.className += ' night-mode';
        darkLogo();
    } else {
        lightLogo();
    }
})(window, document);

(function (window, document, undefined) {
    'use strict';

    // Feature test
    if (!('localStorage' in window)) return;

    // Get our newly insert toggle
    var nightMode = document.querySelector('#night-mode');

    if (!nightMode) return;

    // When clicked, toggle night mode on or off
    nightMode.addEventListener(
        'click',
        function (event) {
            event.preventDefault();
            document.documentElement.classList.toggle('dark');

            if (document.documentElement.classList.contains('dark')) {
                localStorage.setItem('gmtNightMode', true);
                darkLogo();

                return;
            }
            lightLogo();

            localStorage.removeItem('gmtNightMode');
        },
        false,
    );
})(window, document);

function darkLogo() {
    let footerLogo = document.getElementById('footerLogo');
    if (footerLogo) {
        footerLogo.src = '';
        footerLogo.src = host + '/uploads/logo/logo-long-with-text-black2_adobe_express.svg';
    }
}

function lightLogo() {
    let footerLogo = document.getElementById('footerLogo');
    if (footerLogo) {
        footerLogo.src = '';
        footerLogo.src = host + '/uploads/logo/logo-long-with-text_adobe_express.svg';
    }
}

if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    darkLogo();
} else {
    lightLogo();
}
