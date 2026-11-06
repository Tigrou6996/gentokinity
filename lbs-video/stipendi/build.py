# build.py: join src/ parts and inline fonts, logo and voice-over into stipendi.html (self-contained page)
import base64, os, glob
D = os.path.dirname(os.path.abspath(__file__))
b = lambda p: base64.b64encode(open(os.path.join(D, 'assets', p), 'rb').read()).decode()
s = ''.join(open(f).read() for f in sorted(glob.glob(os.path.join(D, 'src', '0*'))))
open(os.path.join(D, 'stipendi.src.html'), 'w').write(s)
for k, p in {'PJS': 'pjs.woff2', 'INTER': 'inter.woff2', 'LOGO': 'logo.png', 'VO': 'vo.mp3'}.items():
    s = s.replace('{{%s}}' % k, b(p))
open(os.path.join(D, 'stipendi.html'), 'w').write(s)
print('stipendi.html', len(s))
