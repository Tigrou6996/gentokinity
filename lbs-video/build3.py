import base64
b=lambda p:base64.b64encode(open(p,'rb').read()).decode()
s=open('lbs3.src.html').read()
for k,p in {'F_BLACK':'/usr/share/fonts/opentype/inter/Inter-Black.otf','F_XBOLD':'/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf','F_MED':'/usr/share/fonts/opentype/inter/Inter-Medium.otf','LOGO':'logo.png'}.items():
    s=s.replace('{{%s}}'%k,b(p))
open('lbs-promo-v3.html','w').write(s)
