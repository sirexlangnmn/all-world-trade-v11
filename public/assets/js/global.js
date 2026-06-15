'use strict'; // https://www.w3schools.com/js/js_strict.asp

let location_hostname = location.hostname;
let host = '';
if (location_hostname === 'localhost') {
    host = 'http://' + location_hostname + ':' + 3000;
}
if (location.hostname === 'allworldtrade.com' || location.hostname.endsWith('.allworldtrade.com')) {
    host = 'https://' + location_hostname;
}

/**
 * Get Html element by Id
 * @param {*} id
 */
function getId(id) {
    return document.getElementById(id);
}

/**
 * Get Html element by selector
 * @param {*} selector
 */
function getSl(selector) {
    return document.querySelector(selector);
}

/**
 * Get Html element by class name
 * @param {*} className
 */
function getEcN(className) {
    return document.getElementsByClassName(className);
}

// Show an element
function showElement(element) {
    element.style.display = 'block';
}

// Hide an element
function hideElement(element) {
    element.style.display = 'none';
}

// function preventBack() { window.history.forward(); }
//     setTimeout("preventBack()", 0);
// window.onunload = function () { null };
