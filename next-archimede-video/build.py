# Inline layers, manifest and CC0 sound effects into one self-contained HTML page.
import base64, json
b = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
SFXDIR = '../.agents/skills/sound-effects/sfx/'
m = json.load(open('layers/manifest.json'))
imgs = {n: b(f'layers/{n}.png') for n in m['layers']}
imgs['plate'] = b('layers/plate.jpg')
sfx = {k: b(SFXDIR + p) for k, p in {
    'whoosh': 'kit/whoosh.ogg', 'pop': 'kit/pop.ogg', 'impact': 'kit/impact.ogg', 'tick': 'kit/tick.ogg', 'click': 'kit/click.ogg',
    'swoosh': 'transition/fs-786514-swoosh-v2.ogg', 'swipe': 'transition/fs-702773-swipe-wav.ogg',
    'hit': 'impact/fs-177242-cinematic-impact.ogg'}.items()}
s = open('next.src.html').read()
s = s.replace('{{MANIFEST}}', json.dumps(m)).replace('{{IMAGES}}', json.dumps(imgs)).replace('{{SFX}}', json.dumps(sfx))
open('next-archimede.html', 'w').write(s)
print('ok', len(s) // 1024, 'KB')
