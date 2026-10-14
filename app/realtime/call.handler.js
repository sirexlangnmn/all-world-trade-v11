'use strict';

const crypto = require('crypto');
const db = require('../db_models');
const ecdc = require('../shared/ecdc');

const RING_TIMEOUT_MS = 30000;
const CALL_START_COOLDOWN_MS = 15000;
const MAX_RINGING_PER_CALLER = 1;
const MAX_RINGING_PER_RECEIVER = 3;

// caller_uuid -> timestamp of last call:start (simple in-memory rate limit)
const lastCallStartedAt = new Map();

const STATUS_RINGING = 0;
const STATUS_ACCEPTED = 1;
const STATUS_DECLINED = 2;
const STATUS_CANCELLED = 3;
const STATUS_MISSED = 4;

module.exports = (io) => {
    io.on('connection', (socket) => {
        const sessionUser = socket.request.session && socket.request.session.user;
        if (!sessionUser || !sessionUser.uuid) {
            return socket.disconnect(true);
        }

        let myUuid;
        try {
            myUuid = ecdc.decryptUuid(sessionUser.uuid);
        } catch (err) {
            console.error('call.handler: failed to decrypt session uuid', err);
            return socket.disconnect(true);
        }
        if (!myUuid) {
            return socket.disconnect(true);
        }

        // One room per user — every tab/device of that user receives rings.
        socket.join(`user:${myUuid}`);

        const callerName =
            `${sessionUser.first_name || ''} ${sessionUser.last_name || ''}`.trim() || 'Anonymous trader';

        socket.on('call:start', async (payload, ack) => {
            try {
                const traderUuid = payload && payload.traderUuid;
                if (!traderUuid || typeof traderUuid !== 'string' || traderUuid === myUuid) {
                    return ack && ack({ error: 'invalid_target' });
                }

                // Cooldown: 1 ring per caller per 15s
                const last = lastCallStartedAt.get(myUuid) || 0;
                if (Date.now() - last < CALL_START_COOLDOWN_MS) {
                    return ack && ack({ error: 'rate_limited' });
                }

                // Receiver must exist
                const receiver = await db.users_accounts.findOne({ where: { uuid: traderUuid } });
                if (!receiver) {
                    return ack && ack({ error: 'invalid_target' });
                }

                // Cap simultaneous ringing calls (mirrors peers_count < 5 rule elsewhere)
                const ringingForCaller = await db.call_requests.count({
                    where: { caller_uuid: myUuid, status: STATUS_RINGING },
                });
                if (ringingForCaller >= MAX_RINGING_PER_CALLER) {
                    return ack && ack({ error: 'already_ringing' });
                }

                const ringingForReceiver = await db.call_requests.count({
                    where: { receiver_uuid: traderUuid, status: STATUS_RINGING },
                });
                if (ringingForReceiver >= MAX_RINGING_PER_RECEIVER) {
                    return ack && ack({ error: 'receiver_busy' });
                }

                lastCallStartedAt.set(myUuid, Date.now());

                // Fresh room per call so two calls never share a MiroTalk room.
                const room = crypto.randomUUID();
                const call = await db.call_requests.create({
                    call_id: crypto.randomUUID(),
                    caller_uuid: myUuid,
                    receiver_uuid: traderUuid,
                    room,
                    status: STATUS_RINGING,
                });

                io.to(`user:${traderUuid}`).emit('call:incoming', {
                    callId: call.call_id,
                    room,
                    callerName,
                });

                if (typeof ack === 'function') {
                    ack({ callId: call.call_id, room });
                }

                // Ring timeout -> mark missed and notify both sides.
                setTimeout(async () => {
                    try {
                        const still = await db.call_requests.findOne({
                            where: { call_id: call.call_id, status: STATUS_RINGING },
                        });
                        if (!still) return;
                        await still.update({ status: STATUS_MISSED, responded_at: new Date() });
                        io.to(`user:${myUuid}`).emit('call:missed', { callId: call.call_id });
                        io.to(`user:${traderUuid}`).emit('call:cancelled', { callId: call.call_id });
                    } catch (err) {
                        console.error('call.handler: ring timeout failed', err);
                    }
                }, RING_TIMEOUT_MS);
            } catch (err) {
                console.error('call.handler: call:start failed', err);
                if (typeof ack === 'function') {
                    ack({ error: 'server_error' });
                }
            }
        });

        socket.on('call:accept', async (payload) => {
            try {
                const callId = payload && payload.callId;
                if (!callId) return;
                const call = await db.call_requests.findOne({
                    where: { call_id: callId, receiver_uuid: myUuid, status: STATUS_RINGING },
                });
                if (!call) return;
                await call.update({ status: STATUS_ACCEPTED, responded_at: new Date() });

                io.to(`user:${call.caller_uuid}`).emit('call:accepted', { callId, room: call.room });
                // Tell the accepting tab too so it opens the room.
                socket.emit('call:accepted', { callId, room: call.room });
            } catch (err) {
                console.error('call.handler: call:accept failed', err);
            }
        });

        socket.on('call:decline', async (payload) => {
            try {
                const callId = payload && payload.callId;
                if (!callId) return;
                const call = await db.call_requests.findOne({
                    where: { call_id: callId, receiver_uuid: myUuid, status: STATUS_RINGING },
                });
                if (!call) return;
                await call.update({ status: STATUS_DECLINED, responded_at: new Date() });
                io.to(`user:${call.caller_uuid}`).emit('call:declined', { callId });
            } catch (err) {
                console.error('call.handler: call:decline failed', err);
            }
        });

        socket.on('call:cancel', async (payload) => {
            try {
                const callId = payload && payload.callId;
                if (!callId) return;
                const call = await db.call_requests.findOne({
                    where: { call_id: callId, caller_uuid: myUuid, status: STATUS_RINGING },
                });
                if (!call) return;
                await call.update({ status: STATUS_CANCELLED, responded_at: new Date() });
                io.to(`user:${call.receiver_uuid}`).emit('call:cancelled', { callId });
            } catch (err) {
                console.error('call.handler: call:cancel failed', err);
            }
        });

        socket.on('disconnect', () => {
            // nothing to clean up — rooms are per-user, calls expire via timeout
        });
    });
};
