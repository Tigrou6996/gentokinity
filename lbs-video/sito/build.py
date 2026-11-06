# build.py: inline fonts, logo and photos into sito.html (self-contained page)
import base64, os
D = os.path.dirname(os.path.abspath(__file__))
b = lambda p: base64.b64encode(open(os.path.join(D, 'assets', p), 'rb').read()).decode()
s = open(os.path.join(D, 'sito.src.html')).read()
for k, p in {'PJS': 'pjs.woff2', 'INTER': 'inter.woff2', 'LOGO': 'logo.png', 'IMG_HERO': 'salvatore_hero.jpg', 'IMG_LAVORO': 'salvatore_lavoro.jpg',
             'IMG_SOCIAL': 'ufficio_social.jpg', 'IMG_POST': 'ufficio_postazione.jpg', 'IMG_RECEP': 'ufficio_reception.jpg', 'IMG_OFF': 'offerta.jpg'}.items():
    s = s.replace('{{%s}}' % k, b(p))
open(os.path.join(D, 'sito.html'), 'w').write(s)
print('sito.html', len(s))
