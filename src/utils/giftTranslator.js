const giftTranslations = {
    'Rose': 'Rose',
    'Popular Vote': 'Vote Populaire',
    'I love you': "Je t'aime",
    'Finger Heart': 'Cœur avec les doigts',
    'TOFU Cat': 'Chat TOFU',
    'Perfume': 'Parfum',
    'Wishing Bottle': 'Bouteille de vœux',
    'Ice Cream': 'Glace',
    'Weights': 'Poids',
    'Confetti': 'Confettis',
    'Paper Crane': 'Grue en papier',
    'Heart Balloon': 'Ballon cœur',
    'Rosa': 'Rosa',
    'Hand Hearts': 'Cœurs avec les mains',
    'Win': 'Victoire',
    'Double': 'Double',
    'TikTok': 'TikTok',
    'Diamond': 'Diamant',
    'Basketball': 'Basketball',
    'Football': 'Football',
    'Gamepad': 'Manette',
    'Gift Box': 'Cadeau',
    'Ice Cream Cone': 'Cornet de glace',
    'Lollipop': 'Sucette',
    'Mini Fridge': 'Mini Frigo',
    'Notebook': 'Carnet',
    'Panda': 'Panda',
    'Pizza': 'Pizza',
    'Sunglasses': 'Lunettes de soleil',
    'Tea': 'Thé'
};

function translateGift(englishName) {
    return giftTranslations[englishName] || englishName;
}

module.exports = { translateGift };
