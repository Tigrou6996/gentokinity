/**
 * tiktokNormalizer.js
 * -------------------
 * Normalizes TikTok event data payloads to a consistent flat format,
 * regardless of whether the legacy connector or the new API is used.
 */

function normalizeUser(data) {
    if (!data) return data;
    if (data.user && typeof data.user === 'object') {
        data.uniqueId          = data.uniqueId          || data.user.uniqueId         || data.user.displayId;
        data.userId            = data.userId            || data.user.userId            || data.user.idStr;
        data.nickname          = data.nickname          || data.user.nickname;
        data.profilePictureUrl = data.profilePictureUrl || data.user.profilePictureUrl;
        data.isModerator       = data.isModerator       ?? data.user.isModerator;
        data.isSubscriber      = data.isSubscriber      ?? data.user.isSubscriber;
        data.followRole        = data.followRole        ?? data.user.followRole;
        data.userBadges        = data.userBadges        || data.user.userBadges;
    }
    return data;
}

function normalizeLike(data) {
    data = normalizeUser(data);
    data.likeCount = data.likeCount ?? data.like_count ?? data.count ?? 0;
    data.totalLikeCount = data.totalLikeCount ?? data.total_like_count ?? data.totalLikes ?? data.total_likes ?? data.total ?? data.labelLikeCount ?? (data.roomInfo && (data.roomInfo.likeCount ?? data.roomInfo.totalLikeCount)) ?? null;
    return data;
}

function normalizeRoomUser(data) {
    if (!data) return data;
    data.viewerCount = data.viewerCount ?? data.userCount ?? data.viewer_count ?? data.memberCount ?? data.roomUserCount ?? (data.roomInfo && (data.roomInfo.viewerCount ?? data.roomInfo.userCount)) ?? null;
    data.likeCount   = data.likeCount   ?? data.like_count ?? data.totalLikeCount ?? data.total_like_count ?? null;
    return data;
}

function normalizeMember(data) {
    data = normalizeUser(data);
    data.viewerCount = data.viewerCount ?? data.userCount ?? data.viewer_count ?? data.memberCount ?? null;
    return data;
}

function normalizeGift(data) {
    data = normalizeUser(data);
    data.giftId      = data.giftId      ?? data.gift_id      ?? (data.gift && data.gift.gift_id)      ?? null;
    data.repeatCount = data.repeatCount ?? data.repeat_count ?? (data.gift && data.gift.repeat_count) ?? 1;
    data.repeatEnd   = (data.repeatEnd !== undefined && data.repeatEnd !== null) ? !!data.repeatEnd : !!(data.gift && data.gift.repeat_end);
    // 1 = combo gift (sent click by click). Captured from TikTok's gift struct in connector.js
    data.giftType    = data.giftType ?? (data.gift && data.gift.gift_type) ?? null;
    data.groupId     = (data.groupId !== undefined && data.groupId !== null) ? String(data.groupId) : null;
    if (data.createTime && typeof data.createTime === 'string') data.createTime = parseInt(data.createTime, 10) || null;
    return data;
}

function normalizeChat(data) {
    data = normalizeUser(data);
    data.comment = data.comment ?? data.message ?? data.content ?? '';
    if (data.createTime && typeof data.createTime === 'string') data.createTime = parseInt(data.createTime, 10) || null;
    return data;
}

function normalizeSocial(data) { return normalizeUser(data); }
function normalizeSubscribe(data) { return normalizeUser(data); }

module.exports = { normalizeUser, normalizeLike, normalizeRoomUser, normalizeMember, normalizeGift, normalizeChat, normalizeSocial, normalizeSubscribe };
