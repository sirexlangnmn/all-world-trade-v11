$(function () {
    generate_communicator_link();
});

function generate_communicator_link() {
    let nonce = generate_nonce();
    let server_info = generate_server_info();
    let room_id = generate_room_id();
    let peer_id = generate_peer_id();
    let call_id = generate_call_id();
    let communicator_host = 'https://meet.allworldtrade.com/groupcall/';

    let communicator_link_1 =
        communicator_host + 'room_id=' + room_id + '/' + 'call_id=' + call_id + '/' + 'section_id=';

    let communicator_link_2 =
        '/&has_video=true&initialize_video=true&nonce=' +
        nonce +
        '&thread_type=1&use_joining_context=true&peer_id=' +
        peer_id +
        '&server_info_data=' +
        server_info;

    // https://www.facebook.com      /groupcall/ROOM:4874020562697125/?call_id=2306301154&users_to_ring[0]=100080239255232&has_video=true&initialize_video=true&nonce=mjfxgxqokkw9&thread_type=1&use_joining_context=true&peer_id=100080239255232&server_info_data=GANwcm4YFVJPT006NDg3NDAyMDU2MjY5NzEyNRgQcGlORGdJaG9pdGFZeGZCUwA%3D
    // https://meet.allworldtrade.com/groupcall/call_id=5de75af7-d40d-4947-baff-7416f0d01a44/room_id=331088/section_id=angel_sent

    document.getElementById('link_1').value = communicator_link_1;
    document.getElementById('link_2').value = communicator_link_2;
}

function generate_nonce() {
    let nonce = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 12; i++) nonce += possible.charAt(Math.floor(Math.random() * possible.length));
    return nonce;
}

function generate_server_info() {
    let server_info = '';
    let server_info_possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 66; i++)
        server_info += server_info_possible.charAt(Math.floor(Math.random() * server_info_possible.length));
    return server_info;
}

function generate_room_id() {
    return Math.floor(Math.random() * 9000000000000000) + 1000000000000000;
}

function generate_peer_id() {
    return Math.floor(Math.random() * 900000000000000) + 100000000000000;
}

function generate_call_id() {
    return Math.floor(Math.random() * 9000000000) + 1000000000;
}
