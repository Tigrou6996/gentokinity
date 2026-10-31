# build.py: inline fonts, logo, voice-over, captions and speech ranges into truffe.html (self-contained page)
import base64, os
D = os.path.dirname(os.path.abspath(__file__))
A = lambda p: os.path.join(D, 'assets', p)
b = lambda p: base64.b64encode(open(A(p), 'rb').read()).decode()
s = open(os.path.join(D, 'truffe.src.html')).read()
for k, p in {'PJS': 'pjs.woff2', 'INTER': 'inter.woff2', 'LOGO': 'logo.png', 'VO': 'vo.mp3'}.items():
    s = s.replace('{{%s}}' % k, b(p))
s = s.replace('{{CAPS}}', open(A('caps.json')).read()).replace('{{SPEECH}}', open(A('speech.json')).read())
open(os.path.join(D, 'truffe.html'), 'w').write(s)
print('truffe.html', len(s))
