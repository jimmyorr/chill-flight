// --- FACES ---
// Everyone's pixel-art face (people.js), by their name. A face is
// FACE_SIZE rows of FACE_SIZE characters, one per pixel ('.' is clear), with
// a palette giving each character's color, and the rows that change while
// they talk (mouthClosed: row number to row, shown every other beat).
// No DOM at load, so scripts can check faces in Node; drawFace draws one on
// a canvas (the dialog, the People screen, debug/debug-faces.html).

// Faces are this many pixels square
export const FACE_SIZE = 32;

// While talking, the mouth closes and opens again every this many seconds
export const MOUTH_SECONDS = 0.18;

export const FACES = {
  // Drawn after the real Ray: a cap on backwards, long wavy hair, a beard
  // and a big grin
  Ray: {
    rows: [
      '................................',
      '...............kk...............',
      '............kkkCCkkk............',
      '..........kkcccccccckk..........',
      '.........kchhhhhhhcccck.........',
      '........kcchhhhhhhccccck........',
      '.......kcccchhhhhccccccck.......',
      '.......kcccccccccccccccck.......',
      '.......kCCCCCrrggrrCCCCCk.......',
      '.......kCCCCCCrrrrCCCCCCk.......',
      '.......krrrlllllsssssrrrk.......',
      '.......krrlvvvvllvvvvsrrk.......',
      '......krrrlllllllsssssrrrk......',
      '......krrrleellllsseesrrrk......',
      '.....krrrrsdellddssessrrrrk.....',
      '.....krrrssssssddssssssrrrk.....',
      '.....krdrsssssddddsssssrdrk.....',
      '.....krdrssssssddssssssrdrk.....',
      '......krrbssbbbbbbbbssbrrk......',
      '.....kkrrbbbbbbbbbbbbbbrrk......',
      '....krrrrbbbbwwwwwwbbBbrrk......',
      '...krrrrrrbbbmmmmmmbbbrrrrk.....',
      '...krrrrrrbbbbbmmbbbbbrrrrrk....',
      '...krrrrrrrbbbbbbbbbbrrrrrrrk...',
      '....krrrrrrrbbbbbbbbrrrrrrrrk...',
      '.....kkrrrtrrbbbbbbrrtttrrrk....',
      '....kkttrtttttnnnntttttttrtk....',
      '...kttttttttttnnnnttttttttttk...',
      '..ktttttttttttnnnntttttttttttk..',
      '..kttttttttttttnnttttttttttttk..',
      '..ktttttttttttttTttttttttttttk..',
      '.ktttttttttttttnntttttttttttttk.',
    ],
    mouthClosed: {
      20: '....krrrrbbbbmmmmmmbbBbrrk......',
      21: '...krrrrrrbbbbbbbbbbbbrrrrk.....',
      22: '...krrrrrrbbbbbbbbbbbbrrrrrk....',
    },
    palette: {
      k: '#2a1c14', // outline
      c: '#969276', // cap
      C: '#76725a', // cap band
      h: '#b0ac92', // cap highlight
      g: '#aaaaa0', // cap buckle
      r: '#3b2418', // hair
      v: '#342218', // brows
      s: '#e2b28e', // skin
      l: '#f0ccaa', // skin highlight
      d: '#c08e6a', // nose and shadow
      e: '#2a1a10', // eyes
      b: '#3a2a20', // beard
      B: '#6e6054', // grey in the beard
      w: '#f4efe6', // teeth
      m: '#6a2e24', // mouth
      n: '#eeeeea', // undershirt and buttons
      t: '#6f7a86', // henley
      T: '#57616c', // henley placket
    },
  },
  // Drawn after the real Doug: hair swept up from a side part, a long
  // clean-shaven face with a square jaw, a smile and a navy and white raglan
  Doug: {
    rows: [
      '................................',
      '.............kkkkkk.............',
      '............khhhhhhk............',
      '............kHHHHHHhk...........',
      '...........khhhhHHhHhk..........',
      '..........khHhhhhhHhhhk.........',
      '.........khDhhhhhhhHhhhk........',
      '........khhDhhhhhhhhHhhk........',
      '........khhDhhhhhhhhhHhk........',
      '........khhssssssshhhhhk........',
      '........khhsssssssssshhk........',
      '.........ksvvvvssvvvvsk.........',
      '........kdssssssssssssdk........',
      '........kdssEesssseEssdk........',
      '........kdsssssdssssssdk........',
      '........kdsssssdssssssdk........',
      '.........kssssddddssssk.........',
      '.........kssssssssssssk.........',
      '.........kssdssssssdssk.........',
      '.........kdsswwwwwwssdk.........',
      '..........kdssmmmmssdk..........',
      '...........kddddddddk...........',
      '............kddddddk............',
      '..........kkksssssskkk..........',
      '........kkNnnssssssnnNkk........',
      '......kkNNtttnnnnnntttNNkk......',
      '....kkNNNttttttttttttttNNNkk....',
      '..kkNNNNttttttttttttttttNNNNkk..',
      'kkNNNNNttttttttttttttttttNNNNNkk',
      'NNNNNNttttttttttttttttttttNNNNNN',
      'NNNNNttttttttttttttttttttttNNNNN',
      'NNNNttttttttttttttttttttttttNNNN',
    ],
    mouthClosed: {
      19: '.........kdssmmmmmmssdk.........',
      20: '..........kdssssssssdk..........',
    },
    palette: {
      k: '#2a1c14', // outline
      h: '#8a6a48', // hair
      H: '#a88a64', // hair highlight
      D: '#5e4430', // hair shadow and the part
      v: '#6e5038', // brows
      s: '#ecbc9e', // skin
      d: '#cc9a7c', // nose, ears and shadow
      E: '#4e6a80', // eyes
      e: '#2a2a30', // pupils
      w: '#f8f4ec', // teeth
      m: '#6a2e24', // mouth
      n: '#232f4e', // collar
      N: '#2c3a5e', // sleeves
      t: '#f0eeea', // shirt
    },
  },
};

// Problems with FACES, for scripts/test-jobs.js: everyone in names has a
// face, every face belongs to someone, and each is FACE_SIZE square and talks
export function checkFaces(names) {
  const problems = [];
  for (const name of names) {
    if (!FACES[name]) problems.push(`${name}: no face`);
  }
  for (const [name, face] of Object.entries(FACES)) {
    if (!names.includes(name))
      problems.push(`${name}'s face: nobody by that name`);
    const rows = [...face.rows, ...Object.values(face.mouthClosed || {})];
    if (
      face.rows.length !== FACE_SIZE ||
      rows.some((r) => r.length !== FACE_SIZE)
    ) {
      problems.push(`${name}'s face: not ${FACE_SIZE} × ${FACE_SIZE}`);
    }
    if (!Object.keys(face.mouthClosed || {}).length) {
      problems.push(`${name}'s face: no mouthClosed rows`);
    }
    for (const r of rows) {
      for (const c of r) {
        if (c !== '.' && !face.palette[c]) {
          problems.push(`${name}'s face: no color for ${c}`);
        }
      }
    }
  }
  return [...new Set(problems)];
}

// Draws face on canvas (FACE_SIZE square). hidden draws it as a plain
// silhouette, for someone you haven't met.
export function drawFace(
  canvas,
  face,
  {mouthClosed = false, hidden = false} = {}
) {
  const ctx = canvas?.getContext('2d');
  if (!ctx || !face) return;
  const size = FACE_SIZE;
  if (canvas.width !== size) canvas.width = canvas.height = size;
  ctx.clearRect(0, 0, size, size);
  face.rows.forEach((row, y) => {
    const line = (mouthClosed && face.mouthClosed?.[y]) || row;
    for (let x = 0; x < size; x++) {
      const color = face.palette[line[x]];
      if (!color) continue;
      ctx.fillStyle = hidden ? 'rgba(255, 255, 255, 0.18)' : color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
}
