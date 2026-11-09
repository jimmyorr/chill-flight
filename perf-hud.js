// ?perf=1: a one-line performance readout, smaller than the debug panel's
// Perf tab. Twice a second: average FPS over the last 10 seconds (and
// the last half second, which bounces), the slowest frame in the last half
// second, CPU time per frame (game update plus issuing the draws), draw calls
// and triangles of the last render, and the render resolution.
//
// Tapping it (or the debug panel's Share perf report) shares (or copies) a
// perf report: those numbers over the last 10 seconds, the device and quality
// settings, and a link back to the same spot, so a phone reading can be pasted
// into a chat and measured again elsewhere.
import {ChillFlightLogic} from './chill-flight-logic.js';
import {performanceMonitor} from './game-performance.js';
import {state} from './state.js';

let el = null;
let frames = 0;
let cpuSum = 0;
let worstMs = 0;
let lastFrameAt = 0;
let windowStart = 0;
let flashUntil = 0;
// The last TRAIL_MS of half-second windows, as [frames, ms, cpu ms, worst ms]
const TRAIL_MS = 10000;
const trail = [];
// The last render's numbers, for the report
let last = null;
// Builds the link back to the plane's spot (debug-ui.js, which loads later)
let planeUrl = () => window.location.href;

export function setPerfReportUrl(build) {
  planeUrl = build;
}

export function updatePerfHud(now, cpuMs, renderer) {
  // The numbers are kept without ?perf=1 too, for the debug panel's report
  if (!windowStart) windowStart = now;
  if (ChillFlightLogic.PERF_HUD && !el) {
    el = document.createElement('div');
    el.id = 'perf-hud';
    el.title = 'Tap to share a perf report';
    el.style.cssText =
      'position:fixed;left:calc(env(safe-area-inset-left, 0px) + 6px);' +
      'top:calc(env(safe-area-inset-top, 0px) + 72px);z-index:100000;' +
      'cursor:pointer;user-select:none;-webkit-user-select:none;' +
      'font:11px/1.3 ui-monospace,Menlo,monospace;' +
      'color:#fff;background:rgba(0,0,0,0.55);padding:2px 6px;' +
      'border-radius:4px;white-space:pre';
    el.addEventListener('click', sharePerfReport);
    document.body.appendChild(el);
  }
  if (lastFrameAt) worstMs = Math.max(worstMs, now - lastFrameAt);
  lastFrameAt = now;
  frames++;
  cpuSum += cpuMs;
  const span = now - windowStart;
  if (span < 500) return;
  trail.push([frames, span, cpuSum, worstMs]);
  let trailFrames = 0;
  let trailMs = 0;
  for (const [f, ms] of trail) {
    trailFrames += f;
    trailMs += ms;
  }
  while (trailMs - trail[0][1] >= TRAIL_MS) {
    trailFrames -= trail[0][0];
    trailMs -= trail.shift()[1];
  }
  const info = renderer.info.render;
  const canvas = renderer.domElement;
  last = {
    calls: info.calls,
    triangles: info.triangles,
    width: canvas.width,
    height: canvas.height,
    pixelRatio: renderer.getPixelRatio(),
  };
  if (el && now >= flashUntil) {
    el.textContent =
      `${Math.round((trailFrames * 1000) / trailMs)} fps (10s)` +
      ` · now ${Math.round((frames * 1000) / span)}` +
      ` · worst ${Math.round(worstMs)} ms\n` +
      `cpu ${(cpuSum / frames).toFixed(1)} ms · ${canvas.width}x${canvas.height}\n` +
      `${info.calls} calls · ${(info.triangles / 1e6).toFixed(2)}M tris`;
  }
  frames = 0;
  cpuSum = 0;
  worstMs = 0;
  windowStart = now;
}

// The report's text: plain lines that read fine pasted into a chat.
export function buildPerfReport() {
  let f = 0;
  let ms = 0;
  let cpu = 0;
  let worst = 0;
  let lowest = Infinity;
  for (const [wf, wms, wcpu, wworst] of trail) {
    f += wf;
    ms += wms;
    cpu += wcpu;
    worst = Math.max(worst, wworst);
    lowest = Math.min(lowest, (wf * 1000) / wms);
  }
  // Whole numbers, with a decimal below 10 fps so a crawl isn't read as 0
  const fmt = (x) => (x < 10 ? x.toFixed(1) : String(Math.round(x)));
  const fps = ms ? fmt((f * 1000) / ms) : '0';
  const version = window.__APP_VERSION__ || 'dev';
  const commit =
    (window.__COMMIT_HASH__ || '') + (window.__IS_DIRTY__ ? ' dirty' : '');
  const memory = performance.memory
    ? ` · heap ${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB`
    : '';
  const lines = [
    `Chill Flight perf report · v${version}${commit ? ` (${commit})` : ''}`,
    `${fps} fps avg over ${Math.round(ms / 1000)} s · lowest half second ` +
      `${Number.isFinite(lowest) ? fmt(lowest) : '0'} fps · ` +
      `worst frame ${Math.round(worst)} ms · cpu ${f ? (cpu / f).toFixed(1) : 0} ms/frame`,
  ];
  if (last) {
    lines.push(
      `${last.calls} calls · ${(last.triangles / 1e6).toFixed(2)}M tris · ` +
        `${last.width}x${last.height} at pixel ratio ${last.pixelRatio.toFixed(2)}` +
        ` (adaptive x${performanceMonitor.pixelRatioMultiplier.toFixed(2)})${memory}`
    );
  }
  lines.push(
    `preset ${state.graphicsPreset || 'auto'} · ${state.planeType || 'plane'} · ` +
      `camera ${state.cameraMode} · screen ${screen.width}x${screen.height} ` +
      `@${window.devicePixelRatio}x · ${navigator.hardwareConcurrency || '?'} cores`,
    navigator.userAgent,
    planeUrl()
  );
  return lines.join('\n');
}

// Shares the report (the share sheet on phones) or copies it; resolves to
// what happened, for the button that asked
export async function sharePerfReport() {
  const text = buildPerfReport();
  let done = 'Copied';
  try {
    if (navigator.share) {
      await navigator.share({title: 'Chill Flight perf report', text});
      done = 'Shared';
    } else {
      await navigator.clipboard.writeText(text);
    }
  } catch (err) {
    // Closing the share sheet throws AbortError: nothing to report
    if (err && err.name === 'AbortError') return null;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      done = "Couldn't copy";
    }
  }
  if (el) {
    el.textContent = `${done} perf report`;
    flashUntil = performance.now() + 1500;
  }
  return done;
}
