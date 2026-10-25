// render.mjs: render a seek(t) page to an OBS stinger with a transparent background.
// Chrome writes opaque frames as RGB PNGs and the rest as RGBA: -reinit_filter 0 keeps one filter graph across both.
//   node render.mjs stinger.html out/stinger [fps=60] [subframes=4] [workers=4]
//     -> out/stinger.webm   VP9 + alpha, Opus audio   (load this in OBS: Transition "Stinger")
//        out/stinger.mov    ProRes 4444 + alpha, PCM  (for editors / OBS on macOS)
//        out/stinger-preview.mp4  the stinger over two demo scenes, to watch anywhere
//   node render.mjs stinger.html sheet.png --stills 0.2,0.5,1   (contact sheet over a checkerboard)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const [, , html, out, a3 = '60', a4 = '4', a5 = '4'] = process.argv;
if (!html || !out) { console.log('usage: node render.mjs page.html out/name [fps] [subframes] [workers]'); process.exit(1); }
const run = (args) => new Promise((res, rej) => { const p = spawn('ffmpeg', args, { stdio: 'inherit' }); p.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()); });
const pageUrl = pathToFileURL(path.resolve(html)).href;
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });

async function openPage(query = '?render') {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(pageUrl + query);
  await page.waitForFunction(() => window.VIDEO && typeof window.seek === 'function');
  const bad = await page.evaluate(async () => {
    await Promise.all([...document.fonts].map(f => f.load().catch(() => {})));
    await document.fonts.ready;
    return [...document.fonts].filter(f => f.status !== 'loaded').map(f => f.family);
  });
  if (bad.length) console.warn('WARNING: fonts did not load:', bad.join(', '));
  return page;
}
const shot = async (page, t) => { await page.evaluate(t => window.seek(t), t); return page.screenshot({ type: 'png', omitBackground: true }); };
const page0 = await openPage();
const V = await page0.evaluate(() => window.VIDEO);

if (a3 === '--stills') {
  const times = a4.split(',').map(Number), dir = out + '.frames';
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < times.length; i++) writeFileSync(`${dir}/${String(i).padStart(3, '0')}.png`, await shot(page0, times[i]));
  await browser.close();
  const cols = Math.min(3, times.length), rows = Math.ceil(times.length / cols);
  await run(['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x9a9a9a:s=1920x1080:r=1,format=rgb24', '-reinit_filter', '0', '-framerate', '1', '-i', `${dir}/%03d.png`, '-filter_complex',
    `[0]geq=lum='if(eq(mod(floor(X/60)+floor(Y/60),2),0),170,120)':cb=128:cr=128[chk];[chk][1]overlay=shortest=1,drawtext=text='%{n}':x=20:y=20:fontsize=60:fontcolor=white:box=1:boxcolor=black,scale=960:-1,tile=${cols}x${rows}:padding=6:color=gray`,
    '-frames:v', '1', out]);
  rmSync(dir, { recursive: true });
  console.log('stills ->', out); process.exit(0);
}

mkdirSync(path.dirname(out), { recursive: true });
const fps = +a3, sub = Math.max(1, +a4), workers = Math.max(1, +a5), N = Math.round(V.duration * fps);
// motion blur with alpha: average premultiplied pixels, then un-premultiply (no dark fringes on the edges)
const vf = ['-vf', 'format=gbrap' + (sub > 1 ? `,premultiply=inplace=1,tmix=frames=${sub},unpremultiply=inplace=1,select='eq(mod(n\\,${sub})\\,${sub - 1})',setpts=N/(${fps}*TB)` : '')];
const t0 = Date.now(); let done = 0;
const per = Math.ceil(N / workers), segs = [];
await Promise.all(Array.from({ length: workers }, async (_, w) => {
  const a = w * per, b = Math.min(N, a + per); if (a >= b) return;
  const seg = `${out}_seg${w}.mkv`; segs[w] = seg;
  const page = await openPage();
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-reinit_filter', '0', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps * sub), '-i', '-', ...vf,
    '-r', String(fps), '-c:v', 'ffv1', '-pix_fmt', 'gbrap', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise(r => ff.on('close', r));
  for (let f = a; f < b; f++) {
    for (let s = 0; s < sub; s++) {             // 180-degree shutter
      const buf = await shot(page, (f + (sub > 1 ? (s / sub) * 0.5 : 0)) / fps);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    if (++done % 10 === 0) process.stdout.write(`\r${done}/${N} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await closed; await page.close();
}));
const list = out + '_segs.txt', master = out + '_master.mkv';
writeFileSync(list, segs.filter(Boolean).map(s => `file '${path.resolve(s)}'`).join('\n'));
await run(['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', master]);
segs.filter(Boolean).forEach(s => rmSync(s)); rmSync(list);
console.log(`\nframes done (${((Date.now() - t0) / 1000).toFixed(0)}s)`);

// soundtrack: the page decodes the bundled recordings and places them on an OfflineAudioContext
const b64 = await page0.evaluate(async (dur) => {
  const sr = 48000, ctx = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
  await window.buildAudio(ctx);
  const b = await ctx.startRendering(), L = b.getChannelData(0), R = b.getChannelData(1);
  const i16 = new Int16Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { i16[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; i16[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
  const u8 = new Uint8Array(i16.buffer); let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}, V.duration);
const pcm = out + '.pcm', wav = out + '_audio.wav';
writeFileSync(pcm, Buffer.from(b64, 'base64'));
// a 2-second clip is too short for loudnorm's integrated gate, so set gain from ebur128 and catch peaks with a limiter
const measure = f => new Promise(res => { const p = spawn('ffmpeg', ['-hide_banner', '-nostats', ...f, '-af', 'ebur128=peak=true', '-f', 'null', '-']); let e = ''; p.stderr.on('data', d => e += d); p.on('close', () => res(+(/I:\s+(-?[\d.]+) LUFS/.exec(e.slice(e.lastIndexOf('Summary')))[1]))); });
const I = await measure(['-f', 's16le', '-ar', '48000', '-ac', '2', '-i', pcm]);
const gain = Math.min(12, -16 - I);
await run(['-v', 'error', '-y', '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', pcm, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.6:level=false:attack=1:release=40,apad`, '-t', String(V.duration), '-c:a', 'pcm_s16le', wav]);
rmSync(pcm);

await run(['-v', 'error', '-y', '-i', master, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '22', '-row-mt', '1', '-auto-alt-ref', '0',
  '-c:a', 'libopus', '-b:a', '160k', '-metadata:s:v:0', 'alpha_mode=1', out + '.webm']);
console.log('webm ->', out + '.webm');
await run(['-v', 'error', '-y', '-i', master, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0',
  '-c:a', 'pcm_s16le', out + '.mov']);
console.log('mov  ->', out + '.mov');

// preview: stinger over demo scene 1 -> scene 2, switching at the transition point
const demo = await openPage('?render&demo');
await demo.evaluate(() => { document.getElementById('svg').style.display = 'none'; });
await demo.evaluate(() => window.seek(0)); writeFileSync(out + '_A.png', await demo.screenshot());
await demo.evaluate(t => window.seek(t), V.duration); writeFileSync(out + '_B.png', await demo.screenshot());
const TP = V.transitionPoint;
await run(['-v', 'error', '-y', '-loop', '1', '-t', '0.6', '-framerate', String(fps), '-i', out + '_A.png', '-loop', '1', '-t', String(TP), '-framerate', String(fps), '-i', out + '_A.png',
  '-loop', '1', '-t', String(V.duration - TP + 0.8), '-framerate', String(fps), '-i', out + '_B.png', '-i', master, '-i', wav,
  '-filter_complex', `[0][1][2]concat=n=3:v=1:a=0,format=yuv420p,fps=${fps}[bg];[3]setpts=PTS+0.6/TB[fg];[bg][fg]overlay=eof_action=pass:format=auto,format=yuv420p[v];[4]adelay=600|600,apad[a]`,
  '-map', '[v]', '-map', '[a]', '-t', String(V.duration + 1.4), '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out + '-preview.mp4']);
rmSync(out + '_A.png'); rmSync(out + '_B.png'); rmSync(master);
console.log('preview ->', out + '-preview.mp4');
await browser.close();
