async function initializeEmbeddedPreviews() {
    const token = localStorage.getItem('gentok_token');
    if (!token) return;

    // 1. Get current User TikTok Info to populate previews
    let userInfo = {
        nickname: 'Vous',
        profilePictureUrl: ''
    };

    try {
        // First get the user's TikTok uniqueId from their config
        const configResponse = await fetch(`/api/config?token=${token}`);

        if (configResponse.ok) {
            const configData = await configResponse.json();
            const uniqueId = configData.username; // This contains tiktokUsername

            if (uniqueId) {
                // Now fetch their actual TikTok profile info
                const tiktokResponse = await fetch(`https://tikfinity.zerody.one/api/tiktok/user-room?uniqueId=${uniqueId}`);

                if (tiktokResponse.ok) {
                    const tiktokData = await tiktokResponse.json();

                    if (tiktokData.data && tiktokData.data.user) {
                        userInfo.nickname = tiktokData.data.user.nickname || tiktokData.data.user.uniqueId;
                        userInfo.profilePictureUrl = tiktokData.data.user.avatarMedium || tiktokData.data.user.avatarThumb || tiktokData.data.user.avatarLarger || '';
                    }
                }
            }
        }
    } catch (e) {
        // Silent fail - use default values
    }

    const iframes = document.querySelectorAll('iframe[src^="/overlay/"]');
    iframes.forEach(iframe => {
        const currentSrc = iframe.getAttribute('src');

        // 2. Connect Real Socket
        if (!currentSrc.includes('token=')) {
            const separator = currentSrc.includes('?') ? '&' : '?';
            iframe.src = `${currentSrc}${separator}token=${token}`;
        }

        // 3. Send Fallback/Example Data (delayed to let socket try first)
        iframe.onload = () => {
            setTimeout(() => {
                let mockData = {};
                // Base user info
                const baseInfo = {
                    nickname: userInfo.nickname,
                    uniqueId: userInfo.nickname,
                    profilePictureUrl: userInfo.profilePictureUrl
                };

                if (currentSrc.includes('last-follower')) {
                    mockData = { ...baseInfo };
                } else if (currentSrc.includes('last-gifter')) {
                    mockData = { ...baseInfo, giftName: 'Rose', giftId: 5655, repeatCount: 1, giftIcon: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.webp' };
                } else if (currentSrc.includes('last-subscriber')) {
                    mockData = { ...baseInfo, subMonth: 1 };
                } else if (currentSrc.includes('last-share')) {
                    mockData = { ...baseInfo };
                } else if (currentSrc.includes('last-like')) {
                    mockData = { ...baseInfo, likeCount: 10 };
                } else if (currentSrc.includes('last-chatter')) {
                    mockData = { ...baseInfo, comment: 'Ceci est un message de test.' };
                } else if (currentSrc.includes('top-gift')) {
                    mockData = { ...baseInfo, coins: 100, giftName: 'Rose' };
                } else if (currentSrc.includes('top-streak')) {
                    mockData = { ...baseInfo, count: 5, giftName: 'Rose' };
                }

                iframe.contentWindow.postMessage({ type: 'simulation', data: mockData }, '*');
            }, 1000);
        };
    });
}

// Call on init
document.addEventListener('DOMContentLoaded', initializeEmbeddedPreviews);
