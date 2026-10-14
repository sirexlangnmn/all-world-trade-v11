# Real-Time "Ring Call" for Selection — Recommendation

**Goal:** When a visitor clicks a company picture in
`<ul class="uk-slideshow-items" id="companiesProfilePicture">` (`public/view/selection/index.ejs:418`),
the company owner (the **trader**) should receive a live **ring notification** ("someone is calling you").
Only after the trader **accepts** should both sides open `https://meet.allworldtrade.com/join/<room>` and start the MiroTalk call.

Today the system only sends an **email** to the trader (`/api/post/emails/notify-trader-on-client-contact`)
and immediately opens the join link in the visitor's tab — the trader gets no real-time signal.

---

## 1. Short answer

**Yes, this is achievable — and the foundation is already in the repo.**

`app/src/server.js:148` / `:152` already creates a Socket.IO server:

```js
io = new Server().listen(server);
```

…but it has **no `io.on('connection')` handler** and **no client** loads `socket.io.js`. So the work is:
1. add a connection/auth handler on the server,
2. load the Socket.IO client in the browser,
3. send a `call:incoming` event to the trader's browser,
4. show an Accept / Decline modal,
5. on Accept, open the MiroTalk join URL on both sides.

This is a **signaling / notification** layer only — the actual audio/video already works via MiroTalk/WebRTC
(`README.md:117-120`). We are not re-implementing WebRTC.

---

## 2. Current flow (what exists today)

Caller side (`public/assets/js/selection.js`):

| Step | Location | What happens |
|------|----------|--------------|
| Click picture | `selection.js:2148` `getActiveImageToDownloadOrContact()` | Reads active slide image |
| Resolve company | `selection.js:2234` `recordTheMeetingOfVisitorAndTrader()` | AJAX `record-the-meeting-of-visitor-and-trader` → returns trader's `communicator` room UUID |
| Ask intent | `selection.js:2239` `downloadOrContact()` | Opens `#selectionQuestion` modal |
| "Contact Directly" | `selection.js:2256` `handleContactTrader()` | — |
| Presence check | `selection.js:2319` → `POST /api/v2/post/check-if-trader-is-active` | Reads `users_accounts.login_status` |
| If active | opens `https://meet.allworldtrade.com/join/<communicator>` + emails trader | `selection.js:2353` |
| If offline | opens AWT room + offline message | `selection.js:2364`, `:2274` |

Relevant server pieces:
- Session user (AES-encrypted uuid) is set at login: `app/models/login.model.js:80-118`.
- `ecdc.decryptUuid()` (`app/shared/ecdc.js:6`) turns it back into a plain uuid.
- Trader's MiroTalk room lives in `users_businesses.communicator` (`app/db_models/users_businesses.model.js:66`).
- Fresh rooms can be minted via `waiting_rooms` (`app/db_controllers/waiting_rooms.controller.js:7`).
- `io = new Server()` is unused.

---

## 2. Recommended architecture

```
Visitor (caller)                     Server (Express + Socket.IO)                 Trader (receiver)
     |                                        |                                         |
     | click company picture                  |                                         |
     |------ socket emit "call:start" ------->|                                         |
     |        { traderUuid }                  |  validate session, create call_requests |
     |                                        |  row (status=ringing), pick room        |
     |<------ ack { callId, room } -----------|                                         |
     |                                        |---- socket emit "call:incoming" ------->|
     |                                        |        { callId, room, callerName }     |
     |                                        |                                         | ring modal + tone
     |                                        |<------- socket emit "call:accept" ------|
     |<------ socket emit "call:accepted" ----|        { callId }                        |
     |  open join/<room>                      |  update call_requests status=accepted    |  open join/<room>
     |                                        |                                         |
     |                      (decline / cancel / timeout paths are symmetrical)           |
```

Key rule: **the server computes/decrypts identities and picks the room; the browser never supplies its own uuid.**

---

## 3. Data model — new `call_requests` table

The app creates tables via `db.sequelize.sync()` on every boot (`app/src/server.js:207`) and has **no migrations**
(`AGENTS.md`). So adding a model file + registering it is enough; no migration tooling required.

Create `app/db_models/call_requests.model.js`:

```js
module.exports = (sequelize, Sequelize) => {
    const Call_requests = sequelize.define('call_requests', {
        call_id: { type: Sequelize.STRING, unique: true },
        caller_uuid: { type: Sequelize.STRING },
        receiver_uuid: { type: Sequelize.STRING },
        room: { type: Sequelize.STRING },
        status: { type: Sequelize.TINYINT }, // 0 ringing, 1 accepted, 2 declined, 3 cancelled, 4 missed, 5 ended
        responded_at: { type: Sequelize.DATE },
    });

    return Call_requests;
};
```

Register in `app/db_models/index.js` (after line 30):

```js
db.call_requests = require('./call_requests.model.js')(sequelize, Sequelize);
```

> Persistence matters: it survives page reloads, lets us log missed calls, and enables multi-instance deploys.

---

## 4. Server: Socket.IO auth + connection registry

In `app/src/server.js`, make the session middleware reusable, then hand it to Socket.IO so the socket
shares the same `req.session` as HTTP routes.

```js
// 1) capture the session middleware instead of using it inline (replace lines 80-92)
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'strict' },
});
app.use(sessionMiddleware);

// 2) after io is created (lines 148 / 152)
io.engine.use(sessionMiddleware); // socket.io >= 4.6
require('../realtime/call.handler.js')(io);
```

Create `app/realtime/call.handler.js`:

```js
const db = require('../db_models');
const ecdc = require('../shared/ecdc');
const { v4: uuidV4 } = require('uuid');

const RING_TIMEOUT_MS = 30000;

module.exports = (io) => {
    io.on('connection', (socket) => {
        const sessionUser = socket.request.session && socket.request.session.user;
        if (!sessionUser) return socket.disconnect(true);

        const myUuid = ecdc.decryptUuid(sessionUser.uuid);
        socket.join(`user:${myUuid}`); // one room per user; all their tabs

        socket.on('call:start', async ({ traderUuid } = {}, ack) => {
            try {
                if (!traderUuid || traderUuid === myUuid) return ack && ack({ error: 'invalid_target' });

                // rate-limit / duplicate guard (see §9)
                const room = uuidV4(); // or reuse Users_businesses.communicator
                const call = await db.call_requests.create({
                    call_id: uuidV4(),
                    caller_uuid: myUuid,
                    receiver_uuid: traderUuid,
                    room,
                    status: 0,
                });

                io.to(`user:${traderUuid}`).emit('call:incoming', {
                    callId: call.call_id,
                    room,
                    callerName: `${sessionUser.first_name || ''} ${sessionUser.last_name || ''}`.trim(),
                });

                ack && ack({ callId: call.call_id, room });

                setTimeout(async () => {
                    const still = await db.call_requests.findOne({ where: { call_id: call.call_id, status: 0 } });
                    if (still) {
                        await still.update({ status: 4, responded_at: new Date() });
                        io.to(`user:${myUuid}`).emit('call:missed', { callId: call.call_id });
                        io.to(`user:${traderUuid}`).emit('call:cancelled', { callId: call.call_id });
                    }
                }, RING_TIMEOUT_MS);
            } catch (err) {
                console.error('call:start failed', err);
                ack && ack({ error: 'server_error' });
            }
        });

        socket.on('call:accept', async ({ callId } = {}) => {
            const call = await db.call_requests.findOne({ where: { call_id: callId, receiver_uuid: myUuid, status: 0 } });
            if (!call) return;
            await call.update({ status: 1, responded_at: new Date() });
            io.to(`user:${call.caller_uuid}`).emit('call:accepted', { callId, room: call.room });
            socket.emit('call:accepted', { callId, room: call.room }); // receiver opens too
        });

        socket.on('call:decline', async ({ callId } = {}) => {
            const call = await db.call_requests.findOne({ where: { call_id: callId, receiver_uuid: myUuid, status: 0 } });
            if (!call) return;
            await call.update({ status: 2, responded_at: new Date() });
            io.to(`user:${call.caller_uuid}`).emit('call:declined', { callId });
        });

        socket.on('call:cancel', async ({ callId } = {}) => {
            const call = await db.call_requests.findOne({ where: { call_id: callId, caller_uuid: myUuid, status: 0 } });
            if (!call) return;
            await call.update({ status: 3, responded_at: new Date() });
            io.to(`user:${call.receiver_uuid}`).emit('call:cancelled', { callId });
        });
    });
};
```

> `socket.join('user:<uuid>')` means every tab/device the trader has open rings. Accepting on any one of them
> can notify the caller.

---

## 5. Client

### 5a. Load the Socket.IO client
Socket.IO serves its browser client automatically at `/socket.io/socket.io.js`. Add it to the shared
`public/view/includes/scripts/index.ejs` (so the receiver works on every page):

```html
<script src="/socket.io/socket.io.js"></script>
<script src="<%= process.env.AWT_HOSTNAME %>assets/js/call-notification.js"></script>
```

### 5b. Receiver logic (new `public/assets/js/call-notification.js`)
```js
(function () {
    if (typeof io === 'undefined') return;

    const socket = io(); // same origin; session cookie is sent automatically

    socket.on('call:incoming', (payload) => {
        playRingtone();
        showRingModal(payload); // Swal / UIkit modal with Accept + Decline
    });

    socket.on('call:accepted', ({ room }) => {
        stopRingtone();
        window.open('https://meet.allworldtrade.com/join/' + room, '_blank');
    });

    socket.on('call:cancelled', () => { stopRingtone(); closeRingModal(); });

    window.answerCall = (payload) => { stopRingtone(); socket.emit('call:accept', { callId: payload.callId }); };
    window.declineCall = (payload) => { stopRingtone(); socket.emit('call:decline', { callId: payload.callId }); };
})();
```

### 5c. Caller changes in `public/assets/js/selection.js`
Inside `handleContactTrader()` (`selection.js:2256`), before falling back to email:

```js
const socket = io();
socket.emit('call:start', { traderUuid: trader_uuid }, (res) => {
    if (res && res.callId) {
        showRingingUI(res.callId); // "Ringing <company>… [Cancel]"
    } else {
        // fall back to current behavior: email + transfer to AWT
        notifyTraderOnClientContact(trader_uuid);
        transferTheCallToAWT(communicator_link);
    }
});

socket.on('call:accepted', ({ room }) => {
    closeRingingUI();
    window.open('https://meet.allworldtrade.com/join/' + room, '_blank');
});
socket.on('call:declined', () => { closeRingingUI(); showTraderOfflineMessage(); });
socket.on('call:missed',   () => { closeRingingUI(); showTraderOfflineMessage(); });
```

Keep the existing email/AWT fallback for when the trader has no socket connected (offline).

---

## 6. Ringtone & browser notifications

- **Ringtone audio:** there are currently **no audio assets** in `public/`. Add one (e.g.
  `public/assets/audio/ringtone.mp3`) and an `<audio loop>` element.
- **Autoplay restriction:** browsers block audio until the page has had a user gesture. Logging in does **not**
  count for later pages. Recommended UX: a one-time, dismissible "Enable call notifications" prompt per session
  that (a) plays a short silent clip on click to unlock audio, and (b) requests `Notification.requestPermission()`.
  Until enabled, still show the visual ring modal.
- **Background tabs:** use the Notification API (`new Notification('Incoming call', ...)`) with a click handler
  that focuses the tab and shows the accept modal.
- **Closed tab / offline** requires Web Push + a service worker + VAPID keys — treat as Phase 3 (see §8).

---

## 7. Presence & fallbacks

- Socket connection is the **best presence signal** (better than `users_accounts.login_status`, which can go
  stale). Use it to decide whether to ring in-app.
- If the trader is not connected → existing flows apply unchanged:
  - email: `/api/post/emails/notify-trader-on-client-contact` (`app/routes/email-marketing.js:36`)
  - off-hours: transfer to AWT room + `showTraderOfflineMessage()`.
- Keep `check-if-trader-is-active` as a secondary check and keep the `peers_count < 5` cap
  (`app/models/visitors-of-traders.model.js:211`).

---

## 7. Room selection

Two options:

| Option | Pros | Cons |
|---|---|---|
| **Reuse `users_businesses.communicator`** (persistent room) | Zero new code; matches current flow | Same room reused; stale participants possible |
| **Mint a fresh room per call** via `waiting_rooms` (`/api/v2/post/generate-waiting-room`) | Clean, isolated calls | One extra insert |

**Recommendation:** fresh room per call (the sketch in §4 uses `uuidV4()`; alternatively call
`waiting_rooms.controller.generateWaitingRoom`). Both parties open `https://meet.allworldtrade.com/join/<room>`.

---

## 8. Scaling (important for production)

- **Single process:** the in-memory `socket.join('user:<uuid>')` approach works as-is.
- **Multiple PM2 instances / load balancer:** Socket.IO requires **sticky sessions**, and you must use the
  **Redis adapter** (`@socket.io/redis-adapter`) so `io.to('user:...')` reaches the right instance. Also switch
  `express-session` from the default MemoryStore to `connect-redis` (README already notes Redis for scale).
- README §13 describes PM2 + Nginx (`app/src/server.js --name allworldtrade`); add the `/socket.io/` WebSocket
  upgrade to that Nginx config.

---

## 9. Security & abuse controls

The app currently has **no auth middleware on API routes** and no rate limiting (`AGENTS.md`). For this feature
specifically:

- **Server-side identity only.** Decrypt the session uuid; never accept a caller/receiver uuid from the client
  body. This is already how `check-if-trader-is-active` works (`app/db_controllers/users-accounts.controller.js:57`).
- **Rate-limit `call:start`** per caller (e.g. 1 ring / 15s) and cap simultaneous ringing calls to mirror the
  existing `peers_count < 5` rule.
- **Validate the receiver** exists and is a business (`users_businesses` / `users_accounts.type` 1–4) before
  ringing; drop silently otherwise.
- **Never email/leak** addresses in socket payloads; send only display name + callId.
- Add a global `io.use()` handshake check that rejects unauthenticated sockets (sketched in §4).

---

## 10. Testing checklist

No test suite exists (`npm test` is a stub); verify manually with two browsers/accounts:

1. Visitor clicks a company picture → trader tab rings within ~1s.
2. Trader **Accept** → both open `join/<room>` and connect in MiroTalk.
3. Trader **Decline** → caller sees "unavailable"; no room opened.
4. Caller **Cancel** → trader's ring stops.
5. **Timeout** (30s, no answer) → both see missed/cancelled; `call_requests.status = 4`.
6. Trader offline (no socket) → falls back to email + AWT transfer exactly as today.
7. Trader logged in on **two tabs** → both ring; accepting on one starts the call once.
8. Visit a non-selection page as trader → still rings (global include works).

---

## 11. Suggested rollout

| Phase | Scope | Effort |
|---|---|---|
| **1 (MVP)** | Socket.IO auth + `call:start/incoming/accept/decline/cancel`, in-app Swal ring modal, fresh room, open join link, `call_requests` table, email fallback | ~1–2 days |
| **2** | Ringtone + autoplay unlock prompt, Browser Notification API, missed-call history UI | ~1 day |
| **3** | Redis adapter + shared session store for multi-instance, Web Push/service worker for closed tabs, MiroTalk webhook to close `call_requests` on hangup | ~2–3 days |

---

## 12. Files to touch (summary)

| Action | File |
|---|---|
| New model | `app/db_models/call_requests.model.js` |
| Register model | `app/db_models/index.js:30` |
| Share session + attach handler | `app/src/server.js:80-92`, `:148`/`:152` |
| New server handler | `app/realtime/call.handler.js` |
| New client receiver | `public/assets/js/call-notification.js` |
| Load socket.io + receiver | `public/view/includes/scripts/index.ejs` |
| Caller wiring | `public/assets/js/selection.js:2256` (`handleContactTrader`) |
| Ringtone asset (new) | `public/assets/audio/ringtone.mp3` |

> After editing any `.ejs`/JS classes, run `npm run lint` (Prettier) as required by `AGENTS.md`.
