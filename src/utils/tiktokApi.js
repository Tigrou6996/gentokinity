const axios = require('axios');
const logger = require('./logger');

const userCache = new Map();
const pendingRequests = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes (Increased)

async function getUserInfo(uniqueId, existingData = null) {
    if (!uniqueId) return null;

    // Use existing data if it has what we need
    if (existingData && existingData.nickname && existingData.profilePictureUrl) {
        return {
            nickname: existingData.nickname,
            profilePictureUrl: existingData.profilePictureUrl
        };
    }

    // Check cache
    const now = Date.now();
    if (userCache.has(uniqueId)) {
        const { data, timestamp } = userCache.get(uniqueId);
        if (now - timestamp < CACHE_TTL) {
            return data;
        }
    }

    // Check if a request for this user is already in progress
    if (pendingRequests.has(uniqueId)) {
        return pendingRequests.get(uniqueId);
    }

    const request = (async () => {
        try {
            const url = `https://tikfinity.zerody.one/api/tiktok/user-room?uniqueId=${uniqueId}`;
            const response = await axios.get(url, { timeout: 5000 });

            if (response.data && response.data.data && response.data.data.user) {
                const user = response.data.data.user;
                const stats = response.data.stats || {};

                const userInfo = {
                    uniqueId: user.uniqueId,
                    nickname: user.nickname,
                    profilePictureUrl: user.avatarThumb || user.avatarMedium || user.avatarLarger,
                    followerCount: stats.followerCount || 0
                };

                userCache.set(uniqueId, { data: userInfo, timestamp: Date.now() });
                return userInfo;
            }
            return null;
        } catch (error) {
            if (error.response && error.response.status === 429) {
                // Return a temporary fake info to avoid repeated attempts
                return { uniqueId, nickname: uniqueId, profilePictureUrl: null };
            }
            return null;
        } finally {
            pendingRequests.delete(uniqueId);
        }
    })();

    pendingRequests.set(uniqueId, request);
    return request;
}

module.exports = { getUserInfo };
