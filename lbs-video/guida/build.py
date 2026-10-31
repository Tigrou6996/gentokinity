# build.py: inline fonts, logo and voice-over into guida.html (self-contained page)
import base64, os
D = os.path.dirname(os.path.abspath(__file__))
b = lambda p: base64.b64encode(open(os.path.join(D, 'assets', p), 'rb').read()).decode()
s = open(os.path.join(D, 'guida.src.html')).read()
for k, p in {'PJS': 'pjs.woff2', 'INTER': 'inter.woff2', 'LOGO': 'logo.png', 'VO': 'vo.mp3'}.items():
    s = s.replace('{{%s}}' % k, b(p))
open(os.path.join(D, 'guida.html'), 'w').write(s)
print('guida.html', len(s))
