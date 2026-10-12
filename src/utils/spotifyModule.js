const SpotifyWebApi = require('spotify-web-api-node');
const config = require('../config');
const logger = require('./logger');

const instances = new Map();

function getInstance(token) {
    if (!token) return null;
    if (!instances.has(token)) {
        instances.set(token, {
            api: null,
            userTracksCount: new Map(),
            localQueue: [],
            currentTrack: { id: null, title: null, requester: null, requesterId: null },
            skipVotes: new Set(),
            lastRefresh: 0,
            lastErrorLogTime: 0
        });
    }
    return instances.get(token);
}

async function initSpotify(token) {
    const inst = getInstance(token);
    if (!inst) return;

    const settings = await config.getSettings(token);
    const spotifySettings = settings.spotify;

    if (!spotifySettings.clientId || !spotifySettings.clientSecret) {
        inst.api = null;
        return;
    }

    inst.api = new SpotifyWebApi({
        clientId: spotifySettings.clientId,
        clientSecret: spotifySettings.clientSecret,
        refreshToken: spotifySettings.refreshToken,
        redirectUri: `${config.remoteDashboardUrl}/api/spotify/callback`
    });
}

async function safeRefresh(token, force = false) {
    const inst = getInstance(token);
    if (!inst) return false;

    if (!inst.api) await initSpotify(token);
    if (!inst.api) return false;

    const settings = await config.getSettings(token);
    const spotifySettings = settings.spotify;

    if (!spotifySettings.refreshToken) return false;

    const REFRESH_COOLDOWN = 30 * 60 * 1000;
    if (!force && inst.lastRefresh > 0 && (Date.now() - inst.lastRefresh < REFRESH_COOLDOWN)) {
        return true;
    }

    try {
        const data = await inst.api.refreshAccessToken();
        inst.api.setAccessToken(data.body['access_token']);
        inst.lastRefresh = Date.now();
        return true;
    } catch (err) {
        if (Date.now() - inst.lastErrorLogTime > 60000) {
            logger.error(`[Spotify:${String(token).substring(0, 8)}] Refresh Error: ${err.message}`);
            inst.lastErrorLogTime = Date.now();
        }
        return false;
    }
}

module.exports = {
    getApi(token) {
        const inst = getInstance(token);
        return inst ? inst.api : null;
    },
    safeRefresh,
    initSpotify,

    // State management
    getQueue(token) {
        const inst = getInstance(token);
        return inst ? inst.localQueue : [];
    },
    getUserTracksCount(token) {
        const inst = getInstance(token);
        return inst ? inst.userTracksCount : new Map();
    },
    getSkipVotes(token) {
        const inst = getInstance(token);
        return inst ? inst.skipVotes : new Set();
    },

    getCurrentTrackInfo(token) {
        const inst = getInstance(token);
        return inst ? inst.currentTrack : { id: null, title: null, requester: null, requesterId: null };
    },

    setCurrentTrack(token, id, title, requester, requesterId) {
        const inst = getInstance(token);
        if (inst) {
            inst.currentTrack = { id, title, requester, requesterId };
        }
    },

    clearVotes(token) {
        const inst = getInstance(token);
        if (inst) inst.skipVotes.clear();
    },

    // Handlers
    async playTrack(token, query, userId, userName, isModerator, isSubscriber) {
        const inst = getInstance(token);
        if (!inst) return { success: false, reason: 'internal_error' };

        const settings = await config.getSettings(token);
        const spotifySettings = settings.spotify;
        if (!spotifySettings.enabled || !inst.api) return { success: false, reason: 'disabled' };

        const currentCount = inst.userTracksCount.get(userId) || 0;
        if (!isModerator && !isSubscriber && currentCount >= spotifySettings.maxTracksPerUser) {
            logger.info(`[Spotify:${String(token).substring(0, 8)}] Limite atteinte pour ${userName}`);
            return { success: false, reason: 'limit_reached' };
        }

        if (!query || query.length < 2) return { success: false, reason: 'query_too_short' };

        try {
            await safeRefresh(token);
            let track = null;

            // Handle Spotify Link or URI
            const trackIdMatch = query.match(/track[/:]([a-zA-Z0-9]+)/);
            if (trackIdMatch) {
                const trackId = trackIdMatch[1];
                const res = await inst.api.getTrack(trackId);
                track = res.body;
            } else {
                const search = await inst.api.searchTracks(query, { limit: 1 });
                track = search.body.tracks.items[0];
            }

            if (!track) return { success: false, reason: 'not_found' };
            
            // [FIX] Duplicate check
            const isDuplicate = inst.localQueue.some(t => t.id === track.id);
            if (isDuplicate) {
                return { success: false, reason: 'duplicate' };
            }

            inst.localQueue.push({
                id: track.id,
                uri: track.uri,
                title: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                duration: track.duration_ms,
                requestedBy: userName,
                userId: userId,
                isQueuedInSpotify: false
            });

            inst.userTracksCount.set(userId, currentCount + 1);
            logger.info(`[Spotify:${String(token).substring(0, 8)}] ${userName} a ajouté : ${track.name}`);
            return { success: true, track };
        } catch (err) {
            logger.error(`[Spotify:${String(token).substring(0, 8)}] Error search/play: ${err.message}`);
            return { success: false, reason: 'api_error' };
        }
    },

    async skipTrack(token, userId, userName, isModerator, isSubscriber, followRole) {
        // console.log(`⏭️ [DEBUG] Appel skipTrack: Utilisateur=${userName}, Modo=${isModerator}, Sub=${isSubscriber}, Rôle=${followRole} (Type: ${typeof followRole})`);
        const inst = getInstance(token);
        if (!inst || !inst.api) return { success: false, reason: 'api_unavailable' };

        const settings = await config.getSettings(token);
        const spotifySettings = settings.spotify;
        const currentInfo = inst.currentTrack;

        // Instant Skip Logic
        const skipInstant = {
            moderators: true,
            subscribers: false,
            followers: false,
            ...(spotifySettings.skipInstant || {})
        };
        let canSkipInstantly = false;

        if (isModerator && skipInstant.moderators) canSkipInstantly = true;
        if (isSubscriber && skipInstant.subscribers) canSkipInstantly = true;
        // followRole standard: 0=none, 1=follower, 2=friend/followBack
        if ((followRole == 1 || followRole == 2) && skipInstant.followers) canSkipInstantly = true;

        if (userId === currentInfo.requesterId) canSkipInstantly = true;

        // console.log(`⏭️ [DEBUG] Skip Instantané Possible=${canSkipInstantly}, Demandeur=${currentInfo.requesterId}, Utilisateur=${userId}`);

        if (inst.localQueue.length === 0 && !currentInfo.requester && !canSkipInstantly) {
            return { success: false, reason: 'streamer_music' };
        }

        let shouldSkip = false;
        let skipType = 'vote';

        if (canSkipInstantly) {
            shouldSkip = true;
            skipType = isModerator ? 'moderator' :
                (userId === currentInfo.requesterId ? 'requester' :
                    (isSubscriber ? 'subscriber' : 'follower'));
        } else {
            inst.skipVotes.add(userId);
            const votesRequired = spotifySettings.skipVotes || 3;
            if (inst.skipVotes.size >= votesRequired) {
                shouldSkip = true;
                skipType = 'vote_goal';
            } else {
                return { success: false, reason: 'vote_added', current: inst.skipVotes.size, required: votesRequired };
            }
        }

        if (shouldSkip) {
            try {
                await safeRefresh(token);
                let trackToPlay = null;

                if (inst.localQueue.length > 0) {
                    const isTopCurrent = inst.localQueue[0].id === currentInfo.id ||
                        inst.localQueue[0].title.toLowerCase().trim() === (currentInfo.title || '').toLowerCase().trim();

                    if (isTopCurrent) {
                        if (inst.localQueue.length > 1) trackToPlay = inst.localQueue[1];
                    } else {
                        trackToPlay = inst.localQueue[0];
                    }
                }

                try {
                    const devices = await inst.api.getMyDevices();
                    const hasActive = devices.body.devices.some(d => d.is_active);

                    if (!hasActive) return { success: false, reason: 'no_active_device' };

                    if (trackToPlay) {
                        await inst.api.play({ uris: [trackToPlay.uri] });
                        trackToPlay.isQueuedInSpotify = true;
                    } else {
                        await inst.api.skipToNext();
                    }

                    inst.skipVotes.clear();
                    return { success: true, skipType };
                } catch (apiErr) {
                    if (apiErr.statusCode === 403) return { success: false, reason: 'premium_required' };
                    throw apiErr;
                }
            } catch (err) {
                logger.error(`[Spotify:${String(token).substring(0, 8)}] Skip Error: ${err.message}`);
                return { success: false, reason: 'api_error', message: err.message };
            }
        }
    },

    removeLastTrack(token, userId, userName) {
        const inst = getInstance(token);
        if (!inst) return { success: false };
        const index = [...inst.localQueue].reverse().findIndex(t => t.userId === userId);

        if (index !== -1) {
            const actualIndex = inst.localQueue.length - 1 - index;
            inst.localQueue.splice(actualIndex, 1);
            const count = inst.userTracksCount.get(userId) || 0;
            inst.userTracksCount.set(userId, Math.max(0, count - 1));
            return { success: true };
        }
        return { success: false, reason: 'not_found' };
    },
    async pausePlayback(token) {
        const inst = getInstance(token);
        if (!inst || !inst.api) return false;
        try {
            await safeRefresh(token);
            await inst.api.pause();
            return true;
        } catch (err) {
            // Silently fail if nothing playing or other API errors
            return false;
        }
    },

    clearQueue(token) {
        const inst = getInstance(token);
        if (inst) {
            inst.localQueue = [];
            inst.userTracksCount.clear();
            inst.skipVotes.clear();
            inst.currentTrack = { id: null, title: null, requester: null, requesterId: null };
            return true;
        }
        return false;
    }
};
