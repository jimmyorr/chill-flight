#!/usr/bin/env node
/**
 * scripts/test-cloud-moods.js
 *
 * Checks the day's cloud mood (cloudMoodForDay in chill-flight-logic.js): the
 * same seed and day always give the same sky, every mood comes up, the
 * amounts stay in range, cloudMood= forces a mood, and cloud-deck domes only
 * rise where the deck fragment is already opaque.
 */
import fs from 'fs';
import {ChillFlightLogic} from '../chill-flight-logic.js';

console.log('Testing cloud moods...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

const {cloudMoodForDay, CLOUD_MOOD_NAMES} = ChillFlightLogic;
const SEED = 20260101;

const a = cloudMoodForDay(SEED, 1234);
const b = cloudMoodForDay(SEED, 1234);
check(
  'a seed and day always give the same mood',
  JSON.stringify(a) === JSON.stringify(b)
);

const days = Array.from({length: 500}, (_, i) => cloudMoodForDay(SEED, i));
const seen = new Set(days.map((m) => m.name));
check(
  'every mood comes up',
  CLOUD_MOOD_NAMES.every((n) => seen.has(n)),
  [...seen].join(',')
);

const inUnit = (v) => v >= 0 && v <= 1;
check(
  'cloud amounts stay between 0 and 1',
  days.every((m) => inUnit(m.cumulus) && inUnit(m.cirrus) && inUnit(m.mackerel))
);

const boosted = days.filter((m) => m.duskBoost > 0).length / days.length;
check(
  'about 60% of days build up cloud at dusk',
  boosted > 0.5 && boosted < 0.7,
  boosted.toFixed(2)
);

let changes = 0;
for (let i = 1; i < days.length; i++) {
  if (days[i].name !== days[i - 1].name) changes++;
}
check(
  'consecutive days vary',
  changes > days.length * 0.5,
  `${changes} changes`
);

check(
  'extra cover stays small, so the weather still leads',
  days.every((m) => Math.abs(m.cover) <= 0.15)
);

check(
  'cloudMood= forces the mood',
  CLOUD_MOOD_NAMES.every((n) => cloudMoodForDay(SEED, 7, n).name === n)
);

// Cloud-deck domes (cloud-deck.js): small sparse clouds keep real 3D dome
// height, while any dome rising past 50 m is optically solid (alpha = 1) even
// under cumulusShape's -0.06 fine-detail dip so domes never turn into hollow
// arches or punch front-to-back depthWrite cutouts.
{
  const deckSrc = fs.readFileSync(
    new URL('../cloud-deck.js', import.meta.url),
    'utf8'
  );
  const domeHeightBody = deckSrc.match(
    /float domeHeight\(vec2 xz\)\s*\{([\s\S]*?)\n {2}\}/
  )?.[1];
  const hereExpr = deckSrc.match(/float here = ([^;]+);/)?.[1];
  const liftHereExpr = deckSrc.match(/here = max\(here, ([^;]+)\);/)?.[1];
  const alphaExpr = deckSrc.match(/float a = ([^*]+)\*/)?.[1];
  check(
    'cloud-deck.js exposes domeHeight, lift opacity, and alpha GLSL expressions',
    Boolean(domeHeightBody && hereExpr && liftHereExpr && alphaExpr)
  );
  if (domeHeightBody && hereExpr && liftHereExpr && alphaExpr) {
    const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
    const smoothstep = (e0, e1, x) => {
      const t = clamp((x - e0) / (e1 - e0), 0, 1);
      return t * t * (3 - 2 * t);
    };
    const jsBody = domeHeightBody
      .replace(/\$\{DOME_HEIGHT\.toFixed\(1\)\}/g, '380.0')
      .replace(/\bfloat\s+/g, 'const ')
      .replace(/cumulusAt\(xz,\s*0\.0\)\s*-\s*cloudEdge\(\)/g, 'dRaw')
      .replace(/fbmMacro\([^)]+\)/g, 'lumpSample')
      .replace(/uCloudTypes\.x/g, 'cumulusType');
    const evalDome = new Function(
      'dRaw',
      'cumulusType',
      'lumpSample',
      'smoothstep',
      'clamp',
      `const max = Math.max;\n${jsBody}`
    );
    const evalAlpha = new Function(
      'edge',
      'n',
      'cumulusType',
      'vLift',
      'smoothstep',
      `const max = Math.max;\nlet here = ${hereExpr.replace(/uCloudTypes\.x/g, 'cumulusType')};\nhere = max(here, ${liftHereExpr});\nreturn ${alphaExpr.trim()};`
    );

    let minLiftedAlpha = 1;
    let worstCase = '';
    for (let cumulusType = 0.15; cumulusType <= 1.001; cumulusType += 0.05) {
      for (let dRaw = -0.05; dRaw <= 0.7; dRaw += 0.01) {
        const h = evalDome(dRaw, cumulusType, 0.8, smoothstep, clamp);
        if (h >= 50) {
          // Worst-case fine detail dip in cumulusShape (detail = 1): -0.06
          const alpha = evalAlpha(
            0.4,
            0.4 + dRaw - 0.06,
            cumulusType,
            h / 380,
            smoothstep
          );
          if (alpha < minLiftedAlpha) {
            minLiftedAlpha = alpha;
            worstCase = `dRaw=${dRaw.toFixed(2)} cumulus=${cumulusType.toFixed(2)} h=${h.toFixed(1)} a=${alpha.toFixed(3)}`;
          }
        }
      }
    }
    check(
      'cloud-deck domes >=50 m tall are fully opaque even at worst-case detail dip',
      minLiftedAlpha >= 0.999,
      worstCase
    );
    const sparseDome = evalDome(0.22, 1.0, 0.65, smoothstep, clamp);
    check(
      'small sparse cumulus puffs stay 3D domes (>120 m) rather than 2D sheets',
      sparseDome > 120,
      `sparseDome=${sparseDome.toFixed(1)}`
    );
    const peak = evalDome(0.65, 1.0, 0.75, smoothstep, clamp);
    check(
      'thick cumulus cores still rise into full 3D domes (>300 m)',
      peak > 300,
      `peak=${peak.toFixed(1)}`
    );
  }
}

if (failed) process.exit(1);
console.log('All cloud mood tests passed.');
