/**
 * MongoDB / Mongoose maps refuse keys containing "." or starting with "$" (and null bytes).
 * Gift and action names are free text ("Mr. Lion", "Son 1.mp3"...): one such name used to make
 * the whole live history fail to save. Keys are stored with look-alike characters and given back
 * unchanged to the dashboard.
 */
const DOT = '．';    // fullwidth full stop
const DOLLAR = '＄'; // fullwidth dollar sign

function encodeKey(key) {
    return String(key).replace(/\u0000/g, '').replace(/\./g, DOT).replace(/^\$/, DOLLAR) || '_';
}

function decodeKey(key) {
    return String(key).split(DOT).join('.').replace(new RegExp(`^${DOLLAR}`), '$');
}

// numbers are added up when two names end up with the same key; text values (keepValues) are kept as is
function encodeKeys(obj, keepValues = false) {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
        const key = encodeKey(k);
        out[key] = keepValues ? v : (out[key] || 0) + (Number(v) || 0);
    }
    return out;
}

function decodeKeys(obj) {
    const entries = obj instanceof Map ? Array.from(obj.entries()) : Object.entries(obj || {});
    const out = {};
    for (const [k, v] of entries) out[decodeKey(k)] = v;
    return out;
}

module.exports = { encodeKey, decodeKey, encodeKeys, decodeKeys };
