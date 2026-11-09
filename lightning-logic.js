// Lightning flashes as real strokes rather than a random strobe (weather-
// manager.js draws them). After the Nightscape demo (github.com/WeebLabs/
// Nightscape): a ground strike is a short leader, then one to four return
// strokes 50-140 ms apart, each a sharp peak that fades in a few tens of
// milliseconds, some with a glowing continuing current. A flash deep in the
// cloud is a softer train of pulses. Pure functions, so the timing is the
// same at any frame rate and can be tested in Node (scripts/test-weather.js).

// A flash's timeline: {strokes: [{t, peak, tau, cc, ccDur}], dur} in seconds.
// rnd() returns 0..1. With reduceMotion (the player's system setting) a flash
// is one slow, dim pulse with no flicker.
export function lightningTimeline(rnd, reduceMotion = false) {
  const strokes = [];
  if (reduceMotion) {
    strokes.push({t: 0, peak: 0.5, tau: 0.2, cc: 0, ccDur: 0});
    return {strokes, dur: 1.2};
  }
  if (rnd() < 0.55) {
    // Ground strike
    const r = rnd();
    const n = r < 0.3 ? 1 : r < 0.6 ? 2 : r < 0.85 ? 3 : 4;
    let t = 0.08 + rnd() * 0.12; // the stepped leader on its way down
    for (let k = 0; k < n; k++) {
      const cc = rnd() < 0.4 ? 0.1 + rnd() * 0.15 : 0;
      const ccDur = cc ? 0.06 + rnd() * 0.2 : 0;
      strokes.push({
        t,
        peak: k ? 0.45 + rnd() * 0.45 : 1,
        tau: 0.035 + rnd() * 0.035,
        cc,
        ccDur,
      });
      t += 0.05 + rnd() * 0.09 + ccDur;
    }
    return {strokes, dur: t + 0.5};
  }
  // In-cloud flash: softer pulses wandering through the cloud
  const n = 2 + Math.floor(rnd() * 4);
  const spread = 0.3 + rnd() * 0.7;
  for (let k = 0; k < n; k++) {
    strokes.push({
      t: k === 0 ? 0.02 : 0.03 + rnd() * spread,
      peak: 0.25 + rnd() * 0.45,
      tau: 0.06 + rnd() * 0.1,
      cc: 0,
      ccDur: 0,
    });
  }
  strokes.sort((a, b) => a.t - b.t);
  return {strokes, dur: strokes[strokes.length - 1].t + 0.5};
}

// Brightness (0..~1.2) of a flash `age` seconds in. dt is the frame time:
// every stroke gets one frame at full brightness even at a low frame rate,
// so a 35 ms stroke is never skipped between two frames.
export function lightningBrightness(timeline, age, dt = 0) {
  let v = 0;
  for (const st of timeline.strokes) {
    let a = age - st.t;
    if (a < 0) continue;
    if (a < dt) a = 0;
    v += st.peak * Math.exp(-a / st.tau);
    if (st.cc) {
      v += st.cc * (a < st.ccDur ? 1 : Math.exp(-(a - st.ccDur) / 0.06));
    }
  }
  return v;
}
