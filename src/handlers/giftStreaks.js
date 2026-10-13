/**
 * Gift streak engine
 * ------------------
 * TikTok sends a gift message for EVERY click of a combo ("streak"): repeatCount 1, 2, 3...
 * and a last one with repeatEnd = true. Messages can also be repeated, arrive late, or the
 * final one can be missing. This module turns that stream into exact "N new gifts" batches,
 * so every gift is counted (stats, leaderboard, actions) exactly once.
 *
 *  - Non-combo gifts (giftType !== 1) are emitted immediately.
 *  - Combo gifts are emitted progressively (at most every FLUSH_MS) with only the NEW gifts
 *    since the previous batch, and a final "streak ended" callback carries the total.
 *  - Exact duplicate messages are filtered earlier with their msgId (see eventManager).
 */

const FLUSH_MS = 800;           // batch combo clicks to avoid flooding actions/sockets
const IDLE_END_MS = 8000;       // no packet for 8s and no repeatEnd: consider the combo finished
const TOMBSTONE_MS = 60000;     // remember finished combos to recognise late packets

class GiftStreakTracker {
    /**
     * @param {(data: object, count: number) => void} onGifts   called with the number of NEW gifts
     * @param {(data: object, total: number) => void} onStreakEnd called once per finished combo
     */
    constructor(onGifts, onStreakEnd) {
        this.onGifts = onGifts;
        this.onStreakEnd = onStreakEnd;
        this.streaks = new Map();
    }

    static isCombo(data) {
        if (data.giftType !== undefined && data.giftType !== null) return Number(data.giftType) === 1;
        if (typeof data.giftCombo === 'boolean') return data.giftCombo;
        return true; // unknown: the combo logic also works for single gifts
    }

    static keyOf(data) {
        const user = data.userId || data.uniqueId || 'unknown';
        const group = data.groupId && data.groupId !== '0' ? data.groupId : 'nogroup';
        return `${user}_${data.giftId}_${group}`;
    }

    push(data) {
        const repeatCount = Math.max(1, parseInt(data.repeatCount, 10) || 1);

        if (!GiftStreakTracker.isCombo(data)) {
            this.onGifts(data, repeatCount);
            this.onStreakEnd(data, repeatCount);
            return;
        }

        const key = GiftStreakTracker.keyOf(data);
        let st = this.streaks.get(key);

        const hasGroupId = !key.endsWith('_nogroup');

        if (st && st.closed) {
            // TikTok gives every combo its own groupId: a packet for a finished combo is either a
            // repeat (ignored) or more clicks of the same combo (continuation).
            if (hasGroupId && repeatCount <= st.counted) return;

            // A combo closed by inactivity can still receive its real end packet a bit later
            const isContinuation = (hasGroupId || !st.explicitEnd) && repeatCount >= st.counted && Date.now() - st.closedAt < TOMBSTONE_MS;
            if (isContinuation) {
                st.closed = false;
            } else {
                this.drop(key, st);
                st = null;
            }
        } else if (st && repeatCount < st.counted) {
            // Counter restarted without an end packet: it is a new combo
            this.close(key, st, false);
            this.drop(key, st);
            st = null;
        }

        if (!st) {
            st = { counted: 0, pending: 0, alerted: 0, last: data, closed: false, explicitEnd: false, closedAt: 0, flushTimer: null, idleTimer: null, dropTimer: null };
            this.streaks.set(key, st);
        }

        const delta = repeatCount - st.counted;
        if (delta > 0) {
            st.counted = repeatCount;
            st.pending += delta;
        }
        st.last = data;

        if (data.repeatEnd) {
            this.close(key, st, true);
            return;
        }

        if (!st.flushTimer && st.pending > 0) {
            st.flushTimer = setTimeout(() => {
                st.flushTimer = null;
                this.flush(st);
            }, FLUSH_MS);
        }
        if (st.idleTimer) clearTimeout(st.idleTimer);
        st.idleTimer = setTimeout(() => this.close(key, st, false), IDLE_END_MS);
    }

    flush(st) {
        if (st.pending <= 0) return;
        const count = st.pending;
        st.pending = 0;
        this.onGifts(st.last, count);
    }

    close(key, st, explicit) {
        if (st.flushTimer) clearTimeout(st.flushTimer);
        if (st.idleTimer) clearTimeout(st.idleTimer);
        st.flushTimer = null;
        st.idleTimer = null;
        this.flush(st);

        // Only one "combo finished" notification per combo, even if closed twice
        if (st.counted > st.alerted) {
            st.alerted = st.counted;
            this.onStreakEnd(st.last, st.counted);
        }

        st.closed = true;
        st.explicitEnd = st.explicitEnd || explicit;
        st.closedAt = Date.now();
        if (st.dropTimer) clearTimeout(st.dropTimer);
        st.dropTimer = setTimeout(() => this.drop(key, st), TOMBSTONE_MS);
    }

    drop(key, st) {
        if (st.flushTimer) clearTimeout(st.flushTimer);
        if (st.idleTimer) clearTimeout(st.idleTimer);
        if (st.dropTimer) clearTimeout(st.dropTimer);
        if (this.streaks.get(key) === st) this.streaks.delete(key);
    }

    /** Flushes everything (used when the live stops) */
    closeAll() {
        for (const [key, st] of Array.from(this.streaks.entries())) {
            if (!st.closed) this.close(key, st, true);
            this.drop(key, st);
        }
    }
}

module.exports = { GiftStreakTracker, FLUSH_MS, IDLE_END_MS };
