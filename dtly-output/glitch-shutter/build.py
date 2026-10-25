#!/usr/bin/env python3
"""Generates project.json for the "Glitch Shutter" OBS stinger (DT.ly).

1920x1080 @ 60 fps, 1.2 s (72 frames), transparent background.
- 24 horizontal bands grow up/down from their own centre line, centre bands first
  (accordion phase offset), all fully closed at frame 36 (0.600 s).
- The shutter carries a dark-grey RGB glitch glow that fades as it closes and returns as it opens.
- 7 horizontal row glitches (random 3 px shift) around 50% coverage.
- Bands retract in mirrored order from 0.6 s to 1.2 s.
Run:  python3 build.py && node render.mjs
"""
import json
import random

W, H, FPS, DUR = 1920, 1080, 60, 1.2
N = 24
BAND_H = H / N                        # 45 px
OVERLAP = 2                           # px, hides anti-aliasing seams between bands
CUT = 0.6                             # frame 36: screen fully covered
LEAD = 0.02                           # frame 0 stays empty
STAGGER = 0.015                       # phase offset per band ring from the centre
CLOSE = CUT - LEAD - STAGGER * (N // 2 - 1)   # 0.415 s per band
EASE = [0.645, 0.045, 0.355, 1]       # cubic ease-in-out (AE "Easy Ease" cubic)

BAND = '#141417'
GLOW = '#3a3a40'
SPLIT_MAX = 7                         # px of vertical RGB split while a band is thin
GLOW_MAX = 85                         # % glow strength while a band is thin


def bez(x1, y1, x2, y2):
    def bx(s): return 3 * x1 * s * (1 - s) ** 2 + 3 * x2 * s * s * (1 - s) + s ** 3
    def by(s): return 3 * y1 * s * (1 - s) ** 2 + 3 * y2 * s * s * (1 - s) + s ** 3
    def f(x):
        lo, hi = 0.0, 1.0
        for _ in range(60):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if bx(mid) < x else (lo, mid)
        return by((lo + hi) / 2)
    return f


ease = bez(*EASE)


def ring(i):                          # 0 = the two centre bands, 11 = top/bottom edge
    return int(abs(i - (N - 1) / 2) - 0.5)


def times(i):
    c0 = LEAD + STAGGER * ring(i)
    c1 = c0 + CLOSE
    return c0, c1, DUR - c1, DUR - c0   # opening mirrors closing around the cut


def key(points):
    """points: [(t, v)] -> keyframes eased cubic in-out, merging a zero-length hold."""
    out = []
    for t, v in points:
        t = round(t, 4)
        if out and out[-1]['t'] == t:
            continue
        out.append({'t': t, 'v': v, 'ease': EASE})
    return {'keyframes': out}


def coverage(t):
    total = 0.0
    for i in range(N):
        c0, c1, o0, o1 = times(i)
        if t <= c0 or t >= o1: p = 0.0
        elif t < c1: p = ease((t - c0) / (c1 - c0))
        elif t <= o0: p = 1.0
        else: p = 1 - ease((t - o0) / (o1 - o0))
        total += p
    return total / N


bands = []
for i in range(N):
    c0, c1, o0, o1 = times(i)
    bands.append({
        'id': f'band{i:02d}', 'name': f'Band {i + 1}', 'type': 'shape', 'shape': 'rect',
        'size': [W, BAND_H + OVERLAP], 'fill': BAND,
        'transform': {
            'position': [W / 2, BAND_H * (i + 0.5)],
            'scale': key([(c0, [100, 0]), (c1, [100, 100]), (o0, [100, 100]), (o1, [100, 0])]),
        },
    })

# Row glitches: frames where coverage is closest to 50% (closing and opening).
frames = range(int(DUR * FPS))
close50 = min((f for f in frames if f / FPS < CUT), key=lambda f: abs(coverage(f / FPS) - 0.5))
open50 = min((f for f in frames if f / FPS > CUT), key=lambda f: abs(coverage(f / FPS) - 0.5))

rng = random.Random(36)
slots = [close50 - 3, close50 - 1, close50 + 1, close50 + 2, open50 - 2, open50, open50 + 2]
glitches = []
for n, f in enumerate(slots):
    y = rng.randint(40, H - 60)
    h = rng.choice([2, 3, 4, 6, 8, 12])
    dx = rng.choice([-3, 3])
    t_in, t_out = f / FPS, (f + 2) / FPS
    glitches.append({
        'id': f'glitch{n + 1}', 'name': f'Row glitch {n + 1} (f{f}, {dx:+d}px)',
        'type': 'precomp', 'comp': 'bands',
        'inPoint': round(t_in, 4), 'outPoint': round(t_out, 4), 'timeOffset': round(t_in, 4),
        'transform': {'position': [W / 2 + dx, H / 2]},
        'masks': [{'shape': 'rect', 'rect': [0, y, W, h]}],
        'effects': [{'type': 'brightness', 'amount': 230}, {'type': 'rgbSplit', 'amount': 3, 'angle': 0}],
    })

project = {
    'dtly': 1,
    'name': 'Glitch Shutter — OBS stinger',
    'root': 'main',
    'comps': [
        {'id': 'main', 'name': 'Glitch Shutter', 'width': W, 'height': H, 'fps': FPS, 'duration': DUR,
         'markers': [{'t': CUT, 'label': 'Transition point (frame 36)'}],
         'layers': glitches + [{
             'id': 'shutter', 'name': 'Shutter', 'type': 'precomp', 'comp': 'bands',
             # RGB glitch glow: strongest while the bands are thin, gone at the cut, back as they open.
             'effects': [
                 {'type': 'glow', 'color': GLOW, 'radius': 14,
                  'strength': key([(LEAD, GLOW_MAX), (CUT, 0), (DUR - LEAD, GLOW_MAX)])},
                 {'type': 'rgbSplit', 'angle': 90,
                  'amount': key([(LEAD, SPLIT_MAX), (CUT, 0), (DUR - LEAD, SPLIT_MAX)])},
             ]}]},
        {'id': 'bands', 'name': 'Bands', 'width': W, 'height': H, 'fps': FPS, 'duration': DUR,
         'layers': bands},
    ],
}

with open('project.json', 'w') as fh:
    json.dump(project, fh, indent=2, ensure_ascii=False)

print(f'close 50% at frame {close50} ({coverage(close50 / FPS):.2f}), '
      f'open 50% at frame {open50} ({coverage(open50 / FPS):.2f})')
print('coverage f0/f35/f36/f37/f71:',
      ' '.join(f'{coverage(f / FPS):.4f}' for f in (0, 35, 36, 37, 71)))
print('glitch frames:', slots)
