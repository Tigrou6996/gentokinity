// dumpaudio.mjs: render only the soundtrack of datori.html to a WAV (for checking the mix)
//   node dumpaudio.mjs out.wav
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const out = process.argv[2] || 'mix.wav';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
const p = await b.newPage();
await p.goto('file://' + path.resolve('datori.html') + '?render' + (process.argv[3] || ''));
await p.waitForFunction(() => window.VIDEO && window.buildAudio);
const b64 = await p.evaluate(async () => { const sr = 48000, ctx = new OfflineAudioContext(2, Math.ceil(sr * VIDEO.duration), sr); await buildAudio(ctx); const buf = await ctx.startRendering(); const L = buf.getChannelData(0), R = buf.getChannelData(1); const f = new Float32Array(L.length * 2); for (let i = 0; i < L.length; i++) { f[2 * i] = L[i]; f[2 * i + 1] = R[i]; } const u8 = new Uint8Array(f.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); });
await b.close();
writeFileSync(out + '.f32', Buffer.from(b64, 'base64'));
spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', out + '.f32', out]);
spawnSync('rm', [out + '.f32']);
console.log('->', out);
