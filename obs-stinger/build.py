# Inline the font and the CC0 sound effects into one self-contained HTML page.
import base64, json
b = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
SFXDIR = '../.agents/skills/sound-effects/sfx/'
sfx = {k: b(SFXDIR + p) for k, p in {
    'whoosh': 'kit/whoosh.ogg', 'quickwoosh': 'whoosh/fs-683101-quick-woosh.ogg', 'swoosh': 'transition/fs-786514-swoosh-v2.ogg',
    'thump': 'impact/kenney-impact-impactsoft-heavy-000.ogg', 'pluck': 'pop/kenney-interface-pluck-001.ogg', 'pop': 'kit/pop.ogg',
    'riser': 'riser/fs-685256-riser-sound-effect-short-wav.ogg', 'gulp': 'pop/fs-258269-mouth-pop.ogg', 'impact': 'kit/impact.ogg',
    'longwoosh': 'transition/fs-683096-woosh.ogg', 'chop': 'whoosh/fs-127197-fast-simple-chop-5-aif.ogg', 'plop': 'pop/fs-447910-plop.ogg'}.items()}
s = open('stinger.src.html').read()
s = s.replace('{{FONT}}', b('fonts/bangers-latin.woff2')).replace('{{SFX}}', json.dumps(sfx))
open('stinger.html', 'w').write(s)
print('ok', len(s) // 1024, 'KB')
