/*
 * Ring-call client (Socket.IO) — see RING_CALL_RECOMMENDATION.md
 *
 * Receiver side (any logged-in page):
 *   - listens for "call:incoming" -> plays a ringtone + shows an Accept/Decline modal
 *   - on Accept -> opens https://meet.allworldtrade.com/join/<room> in a new tab
 *
 * Caller side (selection page):
 *   - window.AWTCalls.startCall(traderUuid) -> Promise<{ callId, room }>
 *   - window.AWTCalls.cancelCall()
 *   - window.AWTCalls.on('accepted'|'declined'|'missed'|'cancelled', fn)
 */
(function () {
    'use strict';

    if (typeof io === 'undefined') return;

    var MEET_JOIN_BASE = 'https://meet.allworldtrade.com/join/';

    var socket = io();

    // ---------- ringtone (WebAudio, no audio asset needed) ----------
    var ringAudioCtx = null;
    var ringOscillator = null;
    var ringGain = null;
    var ringInterval = null;

    function startRingtone() {
        try {
            var AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!ringAudioCtx) ringAudioCtx = new AudioCtx();
            if (ringAudioCtx.state === 'suspended') ringAudioCtx.resume();
            stopRingtone();

            ringGain = ringAudioCtx.createGain();
            ringGain.gain.value = 0.0001;
            ringGain.connect(ringAudioCtx.destination);

            ringOscillator = ringAudioCtx.createOscillator();
            ringOscillator.type = 'sine';
            ringOscillator.frequency.value = 425;
            ringOscillator.connect(ringGain);
            ringOscillator.start();

            var on = false;
            ringInterval = setInterval(function () {
                on = !on;
                if (ringGain) {
                    ringGain.gain.setTargetAtTime(on ? 0.08 : 0.0001, ringAudioCtx.currentTime, 0.02);
                }
            }, 400);
        } catch (err) {
            console.log('call-notification: ringtone unavailable', err);
        }
    }

    function stopRingtone() {
        try {
            if (ringInterval) {
                clearInterval(ringInterval);
                ringInterval = null;
            }
            if (ringOscillator) {
                ringOscillator.stop();
                ringOscillator.disconnect();
                ringOscillator = null;
            }
            if (ringGain) {
                ringGain.disconnect();
                ringGain = null;
            }
        } catch (err) {
            /* ignore */
        }
    }

    // Browsers block audio until a user gesture — resume on first interaction.
    document.addEventListener(
        'pointerdown',
        function unlockAudio() {
            if (ringAudioCtx && ringAudioCtx.state === 'suspended') {
                ringAudioCtx.resume();
            }
        },
        { once: true },
    );

    // ---------- incoming-call modal ----------
    var ringModalEl = null;
    var currentIncoming = null; // { callId, room, callerName }

    function hideRingModal() {
        if (ringModalEl && ringModalEl.parentNode) {
            ringModalEl.parentNode.removeChild(ringModalEl);
        }
        ringModalEl = null;
        currentIncoming = null;
    }

    function showRingModal(payload) {
        hideRingModal();

        var wrap = document.createElement('div');
        wrap.id = 'awt-ring-call-modal';
        wrap.style.cssText =
            'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
            'background:rgba(0,0,0,0.55);font-family:Arial,Helvetica,sans-serif;';

        var card = document.createElement('div');
        card.style.cssText =
            'background:#fff;border-radius:12px;padding:28px 32px;max-width:340px;width:90%;' +
            'text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3);';

        var icon = document.createElement('div');
        icon.textContent = '\u{1F4DE}';
        icon.style.cssText = 'font-size:42px;margin-bottom:8px;';

        var title = document.createElement('div');
        title.style.cssText = 'font-size:13px;color:#6b7280;margin-bottom:4px;';
        title.textContent = 'Incoming call';

        var name = document.createElement('div');
        name.style.cssText = 'font-size:18px;font-weight:700;color:#111827;margin-bottom:20px;';
        name.textContent = payload.callerName || 'Someone is calling you';

        var acceptBtn = document.createElement('button');
        acceptBtn.type = 'button';
        acceptBtn.textContent = 'Accept';
        acceptBtn.style.cssText =
            'background:#16a34a;color:#fff;border:0;border-radius:8px;padding:12px 28px;' +
            'font-size:15px;font-weight:600;cursor:pointer;margin-right:10px;';

        var declineBtn = document.createElement('button');
        declineBtn.type = 'button';
        declineBtn.textContent = 'Decline';
        declineBtn.style.cssText =
            'background:#dc2626;color:#fff;border:0;border-radius:8px;padding:12px 28px;' +
            'font-size:15px;font-weight:600;cursor:pointer;';

        acceptBtn.addEventListener('click', function () {
            var incoming = currentIncoming;
            stopRingtone();
            hideRingModal();
            closeBrowserNotification();
            if (incoming) {
                socket.emit('call:accept', { callId: incoming.callId });
                // Server replies with "call:accepted" (room) -> openRoom() below.
            }
        });

        declineBtn.addEventListener('click', function () {
            var incoming = currentIncoming;
            stopRingtone();
            hideRingModal();
            closeBrowserNotification();
            if (incoming) {
                socket.emit('call:decline', { callId: incoming.callId });
            }
        });

        card.appendChild(icon);
        card.appendChild(title);
        card.appendChild(name);
        card.appendChild(acceptBtn);
        card.appendChild(declineBtn);
        wrap.appendChild(card);
        document.body.appendChild(wrap);

        ringModalEl = wrap;
        currentIncoming = payload;
    }

    // ---------- browser notification (optional, only if permission already granted) ----------
    var activeNotification = null;

    function showBrowserNotification(payload) {
        try {
            if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
            activeNotification = new Notification('Incoming call', {
                body: (payload.callerName || 'Someone') + ' is calling you on All World Trade',
                tag: 'awt-call-' + payload.callId,
            });
            activeNotification.onclick = function () {
                window.focus();
                closeBrowserNotification();
            };
        } catch (err) {
            /* ignore */
        }
    }

    function closeBrowserNotification() {
        try {
            if (activeNotification) {
                activeNotification.close();
                activeNotification = null;
            }
        } catch (err) {
            /* ignore */
        }
    }

    function openRoom(room) {
        if (!room) return;
        window.open(MEET_JOIN_BASE + room, '_blank');
    }

    // ---------- receiver events ----------
    socket.on('call:incoming', function (payload) {
        if (!payload || !payload.callId) return;
        if (currentIncoming) return; // already ringing — first call wins
        startRingtone();
        showRingModal(payload);
        showBrowserNotification(payload);
    });

    socket.on('call:accepted', function (data) {
        // Fired on BOTH sides: caller tab and accepting receiver tab open the room.
        stopRingtone();
        hideRingModal();
        closeBrowserNotification();
        pendingOutgoing = null;
        if (data && data.room) {
            openRoom(data.room);
        }
    });

    socket.on('call:cancelled', function (data) {
        // Receiver side: caller cancelled. Also fired on receiver when ring times out.
        stopRingtone();
        hideRingModal();
        closeBrowserNotification();
        emitCallerEvent('cancelled', data);
    });

    // ---------- caller events ----------
    var pendingOutgoing = null; // { callId, room, traderUuid }
    var callerHandlers = { accepted: [], declined: [], missed: [], cancelled: [] };

    function emitCallerEvent(event, data) {
        if (!callerHandlers[event]) return;
        callerHandlers[event].forEach(function (fn) {
            try {
                fn(data);
            } catch (err) {
                console.error('call-notification: caller handler error', err);
            }
        });
    }

    socket.on('call:declined', function (data) {
        if (!pendingOutgoing || (data && data.callId !== pendingOutgoing.callId)) return;
        pendingOutgoing = null;
        emitCallerEvent('declined', data);
    });

    socket.on('call:missed', function (data) {
        if (!pendingOutgoing || (data && data.callId !== pendingOutgoing.callId)) return;
        pendingOutgoing = null;
        emitCallerEvent('missed', data);
    });

    // ---------- public API used by selection.js ----------
    window.AWTCalls = {
        socket: socket,

        isConnected: function () {
            return socket.connected;
        },

        // Rings the trader. Resolves with { callId, room } once the ring is delivered.
        // Rejects with { error } when rate-limited, busy, offline, or not logged in.
        startCall: function (traderUuid) {
            return new Promise(function (resolve, reject) {
                if (!socket.connected) {
                    return reject({ error: 'not_connected' });
                }
                socket.timeout(5000).emit('call:start', { traderUuid: traderUuid }, function (err, res) {
                    if (err) return reject({ error: 'timeout' });
                    if (!res || res.error) return reject(res || { error: 'unknown' });
                    pendingOutgoing = { callId: res.callId, room: res.room, traderUuid: traderUuid };
                    resolve(res);
                });
            });
        },

        cancelCall: function () {
            if (!pendingOutgoing) return;
            socket.emit('call:cancel', { callId: pendingOutgoing.callId });
            pendingOutgoing = null;
        },

        on: function (event, handler) {
            if (!callerHandlers[event]) return;
            callerHandlers[event].push(handler);
        },
    };
})();
