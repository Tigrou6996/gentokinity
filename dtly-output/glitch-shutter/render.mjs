// Renders project.json with DT.ly's renderer to a transparent VP9 WebM (yuva420p) for OBS.
// DT.ly's own `render` command always encodes opaque H.264, so this pipes its RGBA frames to FFmpeg.
//   node render.mjs                     -> glitch-shutter.webm
//   node render.mjs --preview           -> work/preview-fNN.png on a checkerboard (frames below)
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {Renderer} from '@dnyantra/dtly';
import {loadProject, NodeHost, registerFonts, newCanvas, checkFfmpeg} from '@dnyantra/dtly/node';

const projectFile = path.resolve('project.json');
const out = 'glitch-shutter.webm';
const preview = process.argv.includes('--preview');
const PREVIEW_FRAMES = [6, 12, 15, 18, 24, 30, 35, 36, 37, 48, 53, 60, 66, 71];

const project = loadProject(projectFile);
registerFonts(project, path.dirname(projectFile));
const host = new NodeHost(path.dirname(projectFile));
const renderer = new Renderer(project, host);
const comp = renderer.comp(project.root);
const total = Math.round(comp.duration * comp.fps);
const canvas = newCanvas(comp.width, comp.height);
const ctx = canvas.getContext('2d');

const frame = async (f) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, comp.width, comp.height);
  await renderer.renderComp(ctx, comp, f / comp.fps);
};

if (preview) {
  fs.mkdirSync('work', {recursive: true});
  const board = newCanvas(comp.width, comp.height);
  const b = board.getContext('2d');
  for (const f of PREVIEW_FRAMES) {
    await frame(f);
    for (let y = 0; y < comp.height; y += 40) for (let x = 0; x < comp.width; x += 40) {
      b.fillStyle = ((x + y) / 40) % 2 ? '#cfd3da' : '#9aa1ab';
      b.fillRect(x, y, 40, 40);
    }
    b.drawImage(canvas, 0, 0);
    await board.toFile(`work/preview-f${String(f).padStart(2, '0')}.png`);
  }
  console.log(`Wrote ${PREVIEW_FRAMES.length} previews to work/`);
} else {
  checkFfmpeg();
  const ff = spawn('ffmpeg', [
    '-y', '-v', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${comp.width}x${comp.height}`, '-r', String(comp.fps), '-i', '-',
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '18',
    '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-auto-alt-ref', '0',
    '-metadata:s:v:0', 'alpha_mode=1', '-frames:v', String(total), out,
  ], {stdio: ['pipe', 'inherit', 'inherit']});
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
  for (let f = 0; f < total; f++) {
    await frame(f);
    if (!ff.stdin.write(canvas.toBufferSync('raw'))) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  console.log(`Wrote ${out} (${total} frames, ${comp.width}x${comp.height} @ ${comp.fps} fps)`);
}
host.close();
