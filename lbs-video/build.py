import base64
b=lambda p:base64.b64encode(open(p,'rb').read()).decode()
s=open('lbs.src.html').read()
for k,p in {'F_BLACK':'/usr/share/fonts/opentype/inter/Inter-Black.otf','F_XBOLD':'/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf','F_MED':'/usr/share/fonts/opentype/inter/Inter-Medium.otf','F_SERIF':'/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf','F_MONO':'/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf','LOGO':'logo.png'}.items():
    s=s.replace('{{%s}}'%k,b(p))
open('lbs-promo.html','w').write(s)
