// ?perf=1: a one-line performance readout that fits on a phone (the debug
// panel doesn't). Twice a second: average FPS, the slowest frame, CPU time
// per frame (game update plus issuing the draws), draw calls and triangles of
// the last render, and the render resolution.
import {ChillFlightLogic} from './chill-flight-logic.js';

let el = null;
let frames = 0;
let cpuSum = 0;
let worstMs = 0;
let lastFrameAt = 0;
let windowStart = 0;

export function updatePerfHud(now, cpuMs, renderer) {
  if (!ChillFlightLogic.PERF_HUD) return;
  if (!el) {
    el = document.createElement('div');
    el.id = 'perf-hud';
    el.style.cssText =
      'position:fixed;left:calc(env(safe-area-inset-left, 0px) + 6px);' +
      'top:calc(env(safe-area-inset-top, 0px) + 72px);z-index:100000;' +
      'pointer-events:none;font:11px/1.3 ui-monospace,Menlo,monospace;' +
      'color:#fff;background:rgba(0,0,0,0.55);padding:2px 6px;' +
      'border-radius:4px;white-space:pre';
    document.body.appendChild(el);
    windowStart = now;
  }
  if (lastFrameAt) worstMs = Math.max(worstMs, now - lastFrameAt);
  lastFrameAt = now;
  frames++;
  cpuSum += cpuMs;
  const span = now - windowStart;
  if (span < 500) return;
  const info = renderer.info.render;
  const canvas = renderer.domElement;
  el.textContent =
    `${Math.round((frames * 1000) / span)} fps` +
    ` · worst ${Math.round(worstMs)} ms\n` +
    `cpu ${(cpuSum / frames).toFixed(1)} ms · ${canvas.width}x${canvas.height}\n` +
    `${info.calls} calls · ${(info.triangles / 1e6).toFixed(2)}M tris`;
  frames = 0;
  cpuSum = 0;
  worstMs = 0;
  windowStart = now;
}
