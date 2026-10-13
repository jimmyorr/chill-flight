// --- FACES ---
// The pixel-art faces people talk with (people.js, dialog.js). A face is
// a square grid of characters, one per pixel ('.' is clear), with a palette
// giving each character's color, and optionally the rows that change while
// they talk (mouthClosed: row number to row, shown every other beat).
// No DOM, so scripts can check people.js in Node.

// Ray, drawn after the real Ray: a cap on backwards, long wavy hair, a
// beard and a big grin.
export const RAY = {
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
};

// Anyone without a face of their own yet: a plain, friendly one
export const SOMEONE = {
  rows: [
    '................',
    '.....kkkkkk.....',
    '....khhhhhhk....',
    '...khhhhhhhhk...',
    '...khsssssshk...',
    '...kssssssssk...',
    '...kseesseesk...',
    '...kssssssssk...',
    '...ksssddsssk...',
    '...kssmmmmssk...',
    '....kssssssk....',
    '.....kssssk.....',
    '...kkttssttkk...',
    '..kttttttttttk..',
    '.kttttttttttttk.',
    '.kttttttttttttk.',
  ],
  mouthClosed: {9: '...kssssssssk...'},
  palette: {
    k: '#2a1c14', // outline
    h: '#5a3c28', // hair
    s: '#e2b28e', // skin
    d: '#c08e6a', // nose
    e: '#2a1a10', // eyes
    m: '#6a2e24', // mouth
    t: '#4f7a8c', // shirt
  },
};
