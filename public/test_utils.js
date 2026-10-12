
function testOverlay(type) {
    let mockData = {
        uniqueId: 'Gentok_Test',
        nickname: 'Test User',
        profilePictureUrl: 'https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/7331590487373332485~c5_100x100.jpeg?lk3s=a5d48078&x-expires=1708466400&x-signature=8L%2F%2B8'
    };

    if (type === 'gift') {
        mockData.giftName = 'Devenez populaire';
        mockData.repeatCount = Math.floor(Math.random() * 10) + 1;
        mockData.url = 'https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/b342e28d73dac6547e0b3be2ad57f697.png~tplv-obj.webp';
        mockData.giftIcon = { url_list: [mockData.url] };
    } else if (type === 'chat') {
        mockData.comment = 'Ceci est un message de test ! 🚀';
    } else if (type === 'like') {
        mockData.likeCount = Math.floor(Math.random() * 500) + 1;
    }

    if (window.socket && window.socket.connected) {
        window.socket.emit('simulate_event', { type, data: mockData });
        showToast(`Simulation ${type} envoyée !`, 'success');
    } else {
        showToast('Serveur non connecté. Lancez le bot d\'abord.', 'error');
    }
}
