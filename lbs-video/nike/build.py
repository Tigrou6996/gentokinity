# build.py: inline fonts and logo into valigia.html (self-contained page)
import base64, os
D = os.path.dirname(os.path.abspath(__file__))
b = lambda p: base64.b64encode(open(os.path.join(D, 'assets', p), 'rb').read()).decode()
s = open(os.path.join(D, 'valigia.src.html')).read()
for k, p in {'BCI': 'bc900i.woff2', 'BC': 'bc800.woff2', 'INTER': 'inter.woff2', 'LOGO': 'logo.png'}.items():
    s = s.replace('{{%s}}' % k, b(p))
open(os.path.join(D, 'valigia.html'), 'w').write(s)
print('valigia.html', len(s))
