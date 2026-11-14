// Unit tests for Purrple Cat music catalog, daily/weekly album rotation, and
// adaptive flight-energy track matching (music-logic.js).
import assert from 'assert';
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {
  BUNDLED_TRACK,
  PURRPLE_CAT_ALBUMS,
  PURRPLE_CAT_TRACKS,
  SCENIC_ALBUM_POOLS,
  albumTrackForProgress,
  computeFlightEnergy,
  dailyAlbumForSeed,
  findAlbumBySlugOrTitle,
  formatTrackDisplay,
  initialTrackIndex,
  nextAlbumProgressOffset,
  nextTrackIndex,
  purrpleCatTracks,
} from '../music-logic.js';

console.log('Testing Purrple Cat music catalog & selection logic...');

function test(name, fn) {
  fn();
  console.log(`  Passed: ${name}`);
}

test('catalog contains 314 tracks across 31 freelofi records plus bundled track (with spooky releases pruned)', () => {
  assert.strictEqual(PURRPLE_CAT_TRACKS.length, 314);
  assert.strictEqual(purrpleCatTracks.length, 314);
  assert.strictEqual(PURRPLE_CAT_ALBUMS.length, 32);
  assert.strictEqual(
    BUNDLED_TRACK,
    'assets/purrple-cat-birds-of-a-feather.mp3'
  );
  assert.strictEqual(PURRPLE_CAT_TRACKS[0].slug, 'birds-of-a-feather');

  const prunedAlbums = new Set([
    'endless-forest',
    'cypress-manor',
    'dino-land',
    'house-in-the-woods',
    'whispers-in-the-dark',
  ]);
  for (const a of PURRPLE_CAT_ALBUMS) {
    assert.ok(
      !prunedAlbums.has(a.slug),
      `spooky album ${a.slug} must not appear`
    );
  }

  const pruned = new Set([
    'bones',
    'chugging-along',
    'come-one-come-all',
    'going-with-the-flow',
    'phantom-waltz',
    'the-lonely-ghost-halloween-2023',
  ]);
  const seenSlugs = new Set();
  for (const t of PURRPLE_CAT_TRACKS) {
    assert.ok(
      !prunedAlbums.has(t.albumSlug),
      `track from spooky album ${t.albumSlug} must not appear`
    );
    assert.ok(!pruned.has(t.slug), `pruned track ${t.slug} must not appear`);
    assert.ok(!seenSlugs.has(t.slug), `duplicate track slug ${t.slug}`);
    seenSlugs.add(t.slug);
    assert.ok(t.title && t.albumTitle);
    assert.ok(t.albumCoverUrl && t.albumCoverUrl.endsWith('-300.webp'));
    assert.ok(t.bpm >= 35 && t.bpm <= 170, `unexpected bpm ${t.bpm}`);
    assert.ok(t.energy >= 0 && t.energy <= 1);
    assert.ok(t.intensity >= 0 && t.intensity <= 1);
  }
});

test('first-time visit starts on the bundled Birds of a Feather track', () => {
  assert.strictEqual(
    initialTrackIndex({playedBefore: false, seed: 20261114, albumParam: null}),
    0
  );
  assert.strictEqual(formatTrackDisplay(0), 'Birds of a Feather');
});

test('32 consecutive calendar days rotate through all 30 multi-track albums paired with daily scenic spawns', () => {
  const startMs = Date.UTC(2026, 0, 1);
  const seenAlbums = new Set();
  for (let d = 0; d < 32; d++) {
    const dt = new Date(startMs + d * 86400000);
    const seed =
      dt.getUTCFullYear() * 10000 +
      (dt.getUTCMonth() + 1) * 100 +
      dt.getUTCDate();
    const corridorIdx = ChillFlightLogic.dailySpawnIndex(seed);
    const corridor = ChillFlightLogic.SCENIC_SPAWNS[corridorIdx];
    const album = dailyAlbumForSeed(seed, null);
    assert.ok(
      SCENIC_ALBUM_POOLS[corridor].includes(album.slug),
      `day ${seed} (${corridor}) picked ${album.slug}, not in ${corridor} pool`
    );
    seenAlbums.add(album.slug);
    const startIdx = initialTrackIndex({
      playedBefore: true,
      seed,
      albumParam: null,
    });
    assert.strictEqual(startIdx, album.startTrackIdx);
    assert.ok(startIdx > 0);
  }
  assert.strictEqual(
    seenAlbums.size,
    30,
    `expected 30 unique albums across 32 days, got ${seenAlbums.size}`
  );
});

test('explicit album parameter overrides the daily seed album', () => {
  const sea = dailyAlbumForSeed(20260101, 'sea-of-stars');
  assert.strictEqual(sea.slug, 'sea-of-stars');
  assert.strictEqual(sea.title, 'Sea of Stars');
  assert.strictEqual(
    initialTrackIndex({
      playedBefore: false,
      seed: 20260101,
      albumParam: 'night-train',
    }),
    findAlbumBySlugOrTitle('night-train').startTrackIdx
  );
});

test('album mode plays tracks sequentially within an album and transitions to the next album in the corridor pool', () => {
  const trails = findAlbumBySlugOrTitle('tranquil-trails');
  let idx = trails.startTrackIdx;
  for (let i = 1; i < trails.trackCount; i++) {
    idx = nextTrackIndex(idx, {mode: 'album', step: 1});
    assert.strictEqual(idx, trails.startTrackIdx + i);
    assert.strictEqual(PURRPLE_CAT_TRACKS[idx].albumSlug, 'tranquil-trails');
  }
  // Advancing past the last track of Tranquil Trails moves to Bloom (next in Falls pool)
  const afterAlbumIdx = nextTrackIndex(idx, {mode: 'album', step: 1});
  assert.strictEqual(PURRPLE_CAT_TRACKS[afterAlbumIdx].albumSlug, 'bloom');
});

test('per-album progress resumes on the next unplayed track and wraps around at album end', () => {
  const nightTrain = findAlbumBySlugOrTitle('night-train');
  const progress = {};

  // First play of Night Train starts at track 0 of the album
  const firstIdx = albumTrackForProgress(nightTrain, progress);
  assert.strictEqual(firstIdx, nightTrain.startTrackIdx);

  // Playing track 0 records offset 1 for next time
  const step1 = nextAlbumProgressOffset(firstIdx);
  assert.deepStrictEqual(step1, {albumSlug: 'night-train', nextOffset: 1});
  progress[step1.albumSlug] = step1.nextOffset;

  // Next visit on a day featuring Night Train starts at track 1 (second track)
  const resumedIdx = initialTrackIndex({
    playedBefore: true,
    seed: 20260101,
    albumParam: 'night-train',
    albumProgress: progress,
  });
  assert.strictEqual(resumedIdx, nightTrain.startTrackIdx + 1);

  // Playing the final track of Night Train wraps saved offset back to 0
  const lastTrackIdx = nightTrain.startTrackIdx + nightTrain.trackCount - 1;
  const wrapStep = nextAlbumProgressOffset(lastTrackIdx);
  assert.deepStrictEqual(wrapStep, {albumSlug: 'night-train', nextOffset: 0});
});

test('computeFlightEnergy scales smoothly from parked/calm to high-speed aerobatics', () => {
  const parked = computeFlightEnergy({
    planeType: 'seaplane',
    flightSpeedMultiplier: 0,
    isOnWater: true,
  });
  const biplaneCalm = computeFlightEnergy({
    planeType: 'biplane',
    flightSpeedMultiplier: 0.9,
  });
  const seaplaneCruise = computeFlightEnergy({
    planeType: 'seaplane',
    flightSpeedMultiplier: 1.0,
  });
  const twinFast = computeFlightEnergy({
    planeType: 'twin',
    flightSpeedMultiplier: 1.4,
    smoothedManeuverFactor: 0.4,
  });
  const jetStunt = computeFlightEnergy({
    planeType: 'jet',
    flightSpeedMultiplier: 2.0,
    smoothedManeuverFactor: 0.8,
    sharpTurnAmount: 0.7,
    isBarrelRolling: true,
  });

  assert.ok(parked < 0.15, `expected parked < 0.15, got ${parked}`);
  assert.ok(biplaneCalm > parked && biplaneCalm < seaplaneCruise);
  assert.ok(seaplaneCruise < twinFast);
  assert.ok(twinFast < jetStunt && jetStunt > 0.85);
});

test('vibe mode matches track intensity to flightEnergy without repeating recent tracks', () => {
  const recent = [];
  let calmIdx = 1;
  let calmSum = 0;
  for (let i = 0; i < 8; i++) {
    calmIdx = nextTrackIndex(calmIdx, {
      mode: 'vibe',
      flightEnergy: 0.12,
      recentIndices: recent,
    });
    assert.ok(!recent.includes(calmIdx), 'must not repeat recent track');
    recent.push(calmIdx);
    calmSum += PURRPLE_CAT_TRACKS[calmIdx].intensity;
  }

  let highIdx = 1;
  const highRecent = [];
  let highSum = 0;
  for (let i = 0; i < 8; i++) {
    highIdx = nextTrackIndex(highIdx, {
      mode: 'vibe',
      flightEnergy: 0.92,
      recentIndices: highRecent,
    });
    assert.ok(!highRecent.includes(highIdx), 'must not repeat recent track');
    highRecent.push(highIdx);
    highSum += PURRPLE_CAT_TRACKS[highIdx].intensity;
  }

  const avgCalm = calmSum / 8;
  const avgHigh = highSum / 8;
  assert.ok(
    avgCalm < 0.25,
    `expected calm vibe tracks to average < 0.25 intensity, got ${avgCalm}`
  );
  assert.ok(
    avgHigh > 0.78,
    `expected high vibe tracks to average > 0.78 intensity, got ${avgHigh}`
  );
});

console.log('All Purrple Cat music tests passed!');
