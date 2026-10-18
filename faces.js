// --- FACES ---
// Everyone's pixel-art face (people.js), by their name. A face is
// FACE_SIZE rows of FACE_SIZE characters, one per pixel ('.' is clear), with
// a palette giving each character's color, the rows that change while
// they talk (mouthClosed: row number to row, shown every other beat), the
// rows that change when they blink (eyesClosed) and the color behind them.
// A face can also have outfits: more complete faces of the same person in
// other clothes, by name ({tennis: {...}}). A job in people.js can name one
// for them to wear while they talk about it; everywhere else shows the face
// itself.
// No DOM at load, so scripts can check faces in Node; drawFace draws one on
// a canvas (the dialog, the People screen, debug/debug-faces.html).

// Faces are this many pixels square
export const FACE_SIZE = 32;

// While talking, the mouth closes and opens again every this many seconds
export const MOUTH_SECONDS = 0.14;

// They blink every this many seconds, with their eyes shut this long
export const BLINK_SECONDS = 3.5;
export const BLINK_SHUT_SECONDS = 0.14;

export const FACES = {
  // Drawn after the real Ray: a cap on backwards, long wavy hair, a beard
  // and a big grin
  Ray: {
    background: '#ead0a8',
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
      '.......krrrssllllllssrrrk.......',
      '.......krrsvvvvllvvvvsrrk.......',
      '......krrrssllllllllssrrrk......',
      '......krrrsEessllsseEsrrrk......',
      '.....krrrrsddllddllddsrrrrk.....',
      '.....krrrssssssddssssssrrrk.....',
      '.....krdrsssssddddsssssrdrk.....',
      '.....krdrssssssddssssssrdrk.....',
      '......krrbssbbbbbbbbssbrrk......',
      '.....kkrrbbbbbbbbbbbbbbrrk......',
      '....krrrrbbbbwwwwwwbbbbrrk......',
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
      20: '....krrrrbbbbmmmmmmbbbbrrk......',
      21: '...krrrrrrbbbbbbbbbbbbrrrrk.....',
      22: '...krrrrrrbbbbbbbbbbbbrrrrrk....',
    },
    eyesClosed: {
      13: '......krrrsssssllsssssrrrk......',
    },
    palette: {
      k: '#36201a', // outline
      c: '#969276', // cap
      C: '#76725a', // cap band
      h: '#b0ac92', // cap highlight
      g: '#aaaaa0', // cap buckle
      r: '#3b2418', // hair
      v: '#342218', // brows
      s: '#e2b28e', // skin
      l: '#f0ccaa', // skin highlight
      d: '#c88a68', // nose and shadow
      e: '#2a1a10', // eyes
      E: '#5a3824', // eyes highlight / iris
      b: '#3a2a20', // beard
      w: '#f4efe6', // teeth
      m: '#6a2e24', // mouth
      n: '#eeeeea', // undershirt and buttons
      t: '#6f7a86', // henley
      T: '#57616c', // henley placket
    },
  },
  // Drawn after the real Doug: hair swept up from a side part, a long face
  // with a square jaw and light stubble, a smile and a navy and white raglan
  Doug: {
    background: '#bfd5e8',
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
      '........khhssslllshhhhhk........',
      '........khhssllllllsshhk........',
      '.........ksvvvvllvvvvsk.........',
      '........kdssEsllllsEssdk........',
      '........kdswewsssswewsdk........',
      '........kdssssslssssssdk........',
      '........kdssssslssssssdk........',
      '.........kppssddddssppk.........',
      '.........kppssssssssppk.........',
      '.........kssdssssssdssk.........',
      '.........kdsswwwwwwssdk.........',
      '..........kdSSmmmmSSdk..........',
      '...........kSSSSSSSSk...........',
      '............kSSSSSSk............',
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
      19: '.........kdssMMMMMMssdk.........',
      20: '..........kdSSssssSSdk..........',
    },
    eyesClosed: {
      12: '........kdssllllllllssdk........',
      13: '........kdseeesssseeesdk........',
    },
    palette: {
      k: '#36201a', // outline
      h: '#8a6a48', // hair
      H: '#a88a64', // hair highlight
      D: '#5e4430', // hair shadow and the part
      v: '#6e5038', // brows
      s: '#ecbc9e', // skin
      l: '#f8d8be', // skin highlight
      d: '#d4957a', // nose, ears and shadow
      p: '#e09884', // cheeks
      E: '#4e6a80', // iris
      e: '#2a2a30', // pupils
      w: '#f8f4ec', // teeth
      m: '#6a2e24', // mouth
      M: '#b86858', // lips
      n: '#232f4e', // collar
      N: '#2c3a5e', // sleeves
      t: '#f0eeea', // shirt
      S: '#c49a80', // stubble
    },
  },
  // Drawn after the real Bonnie: long wavy auburn hair, warm smiling eyes,
  // rosy cheeks, cream drop earrings and a navy top with white dots
  Bonnie: {
    background: '#d6e6c4',
    rows: [
      '................................',
      '.............kkkkkk.............',
      '...........kkrrrrrrkk...........',
      '.........kkrrrrrrrrrrkk.........',
      '.......kkrHrRhrRhrRrhrRkk.......',
      '......krRrhrrhrrHrRrhrrRrk......',
      '......krRrrRrrRrhrRrrhrRRk......',
      '.......kRhrhhrrhhrrhhHhRk.......',
      '......kkRhrhhrrhhllssshRkk......',
      '.....kRRhrhrssllllsssshrRRk.....',
      '.....kRrhrsssssssssssshrrRk.....',
      '.....kRrhrvvvvssssvvvvrRrRk.....',
      '.....kRrhrseeesssseeesrRhRk.....',
      '.....kRrHhswEwsssswEwsRrhRk.....',
      '.....kRRrhssssslssssssRrhRk.....',
      '.....kRRRrdssssllssssdRrhRk.....',
      '.....kRrRrdsssdlldsssdRrhRk.....',
      '.....kRrRrhppsssssspprRRrRk.....',
      '....kRhrRrgdssssssssdgrRRrRk....',
      '....kRhrRHGRdMwwwwMdrGrrRrRk....',
      '....kRhRrhrrhdmmmmdRrrHrRrRk....',
      '....kRrRrrRrhrdssdrrRrhrRrRk....',
      '....kRrrhrRrhrdssdhrRrhrRhRk....',
      '....kRRrhrRrHddddddrRrhRrhRk....',
      '....kRRrhrRRrssssssrRrrRrrRk....',
      '....kRRrhrrRrssssssrrhrrHrRk....',
      '...kksRrrHrrRssssssRrhRrhRskk...',
      '.kksssRRrrhttssssssttrRrhRssskk.',
      'ksssssRRRrhtttsssstttrRrhRsssssk',
      'ssssssRrRrhntttsstnttrRrrRssssss',
      'ssssttRrRrhttttntttttrrRrRttssss',
      'sttttnRrRrrtnttttttnthrRRRntttts',
    ],
    mouthClosed: {
      18: '....kRhrRrgdsdssssdsdgrRRrRk....',
      19: '....kRhrRHGRdMMMMMMdrGrrRrRk....',
      20: '....kRhRrhrrhdssssdRrrHrRrRk....',
    },
    eyesClosed: {
      12: '.....kRrhrssssssssssssrRhRk.....',
      13: '.....kRrHhseeesssseeesRrhRk.....',
    },
    palette: {
      k: '#36201a', // outline
      r: '#6e2816', // hair base
      R: '#44160d', // hair shadow
      h: '#a44626', // hair highlight
      H: '#ca6e3a', // hair bright highlight
      s: '#f0c2a4', // skin
      l: '#fae0d0', // skin highlight
      d: '#cd9272', // nose, jaw and shadow
      p: '#e4887a', // cheeks
      v: '#562516', // brows
      e: '#26140c', // pupils and lashes
      E: '#643c22', // eyes
      w: '#faf6ee', // teeth
      m: '#6a221c', // mouth
      M: '#ba5652', // lips
      g: '#f0e6d2', // drop earring
      t: '#1f2440', // navy top
      G: '#c8b8a0', // earring shadow
      n: '#e8e6f0', // white dots
    },
  },
  // Drawn after the real Esther: light brown hair tucked back behind her
  // ears, thin dark glasses, a warm smile and a tie-dye shirt with a collar
  Esther: {
    background: '#e4d4ee',
    rows: [
      '................................',
      '...........kkkkkkkkk............',
      '..........krRrhrrhrrk...........',
      '.........khrrrhrrHRrhk..........',
      '........krhrrhrrHrrrhrk.........',
      '.......krrHrrhrrhrrrHrrk........',
      '.......krrrRrrrrhrrrrhrk........',
      '......krrhRsRRRRhrrrrhhrk.......',
      '......krrRssslllRRRrrrHrk.......',
      '......krRssssssssssRrRhrRk......',
      '......krRssvvvssssvvvsRrrk......',
      '......krRsbbbbbssbbbbbrrrk......',
      '......krbbbaEsbbbbsEabbbhk......',
      '......kRssbwewbssbwewbksRk......',
      '......kRsssbbbssssbbbsksRk......',
      '......krdsssssslsssssskdhk......',
      '......krRssppssddssppskrHk......',
      '......krrkdsssssssssdkkrrk......',
      '.......kkkdssMwwwwMsdk.kk.......',
      '..........kdssMmmMsdk...........',
      '...........kdsssssdk............',
      '............kddddddk............',
      '............kdssssdk............',
      '...........kkdssssdkk...........',
      '........kkkucsssssscjkkk........',
      '.....kkkyuuuccssssccjxzukkk.....',
      '...kkuuuuuuuuccccccjjxzzuyykk...',
      '.kkyuzzxzzuuuuuuuyyjxzzzzuyjxkk.',
      'kyyyuzxjxxzuuzzzzuyjxzzzzzujxzzk',
      'uuuuzxxjjxxxxxxzzuyyjxxzzuujxxzz',
      'uzzxxxxxjjjjjjxzuuyyyjxzuyyjjxxz',
      'uxxjjxxxjyuuuyxzuyyyyyxzyyjjjjxz',
    ],
    mouthClosed: {
      18: '.......kkkdssdMMMMdsdk.kk.......',
      19: '..........kdsssssssdk...........',
    },
    eyesClosed: {
      12: '......krbbbsssbbbbsssbbbhk......',
      13: '......kRssbeeebssbeeebksRk......',
    },
    palette: {
      k: '#3a2418', // outline
      r: '#9a7350', // hair base
      R: '#6e4e34', // hair shadow
      h: '#b48a5e', // hair highlight
      H: '#d2ac78', // hair bright highlight
      s: '#f2caad', // skin
      l: '#fbe4d2', // skin highlight
      d: '#d39c7c', // nose, jaw and shadow
      p: '#eb9a8c', // cheeks
      v: '#7a5838', // brows
      b: '#4e403a', // glasses
      c: '#5e3c80', // collar
      a: '#f4f8fa', // glasses reflection
      e: '#2a1e18', // pupils and lashes
      E: '#6a8070', // eyes
      w: '#fcf8f2', // teeth and whites of the eyes
      m: '#7a2c26', // mouth
      M: '#c66a62', // lips
      y: '#f4d048', // tie-dye yellow
      j: '#e45c78', // tie-dye pink
      x: '#8a5aa6', // tie-dye purple
      z: '#38a6be', // tie-dye turquoise
      u: '#5eb04e', // tie-dye green
    },
  },
  // Drawn after the real Tim: short dark textured hair with faded sides,
  // warm smiling eyes, an open grin and a bright pink hoodie
  Tim: {
    background: '#c4e4dc',
    rows: [
      '................................',
      '.............kkkkkk.............',
      '...........kkrHHrrHkk...........',
      '..........kHrHHrHHrHHk..........',
      '.........krHHrHHHrHHrHk.........',
      '........krrrHrrHHrrHrrrk........',
      '........krrrrrrrrrrrrrrk........',
      '........khhsssssssssshhk........',
      '........khhssllllllsshhk........',
      '........khhsssllllssshhk........',
      '........khhsssssssssshhk........',
      '.........kvvvvssssvvvvk.........',
      '........kdseeesssseeesdk........',
      '........kdswEwsssswEwsdk........',
      '........kdssssslssssssdk........',
      '........kdssssslssssssdk........',
      '........kddsssdlldsssddk........',
      '........kddppssssssppddk........',
      '..........kdsssllsssdk..........',
      '..........kdMwwwwwwMdk..........',
      '...........kddmmmmddk...........',
      '............kkdssdkk............',
      '.............kdssdk.............',
      '............kdssssdk............',
      '..........kkksssssskkk..........',
      '........kkttuuBBBBuuttkk........',
      '......kkttTTTwttttwTTTttkk......',
      '....kktttTTTtwttttwtTTTtttkk....',
      '..kktttttttttwttttwtttttttttkk..',
      'kkttttttttttttttttttttttttttttkk',
      'tttttttttttttttttttttttttttttttt',
      'tttttttttttttttttttttttttttttttt',
    ],
    mouthClosed: {
      19: '..........kddMMMMMMddk..........',
      20: '...........kddssssddk...........',
    },
    eyesClosed: {
      12: '........kdssssssssssssdk........',
      13: '........kdseeesssseeesdk........',
    },
    palette: {
      k: '#36201a', // outline
      r: '#221812', // hair base
      h: '#3a281e', // hair fade
      H: '#583e30', // hair highlight
      s: '#ebc29e', // skin
      l: '#f8dac0', // skin highlight
      d: '#cc8e6e', // skin shadow and jaw contour
      p: '#dc8472', // cheek flush
      v: '#281a14', // brows
      e: '#18100c', // pupils
      E: '#422a1c', // eyes
      w: '#f8f4ec', // teeth, whites of the eyes and drawstrings
      m: '#6a221c', // mouth
      M: '#b6544e', // lips
      t: '#e25c88', // hoodie
      T: '#f078a0', // hoodie highlight
      u: '#be3864', // hood fold
      B: '#222026', // inner tee collar
    },
  },
  // Drawn after the real Erin: big dark curls from a middle part, brown
  // eyes, a wide smile and a speckled purple knit top (purple is her
  // colour). For tennis: a white polo and visor with purple trim
  Erin: {
    background: '#dcd8f4',
    rows: [
      '.........kk.kkrHhkk.kk..........',
      '........khrkhrrhrrhkrhk.........',
      '.......kRrrRrrRrrRrrRrrk........',
      '......krHhrHhrHhrHhrHhrHk.......',
      '......krhrrhrrhrrhrrhrrhk.......',
      '....kkrRrrRrrRrrRrrRrrRrrkk.....',
      '...khrHhrHhsssssssssrHhrHhrk....',
      '...krrhrrhssssssssssshrrhrrk....',
      '...krRrrRrrssllllllssrrRrrRk....',
      '...krHhrHhrsssssssssshrHhrHk....',
      '...krhrrhrsvvvssssvvvsrhrrhk....',
      '...kRrrRrrssssssssssssRrrRrk....',
      '..kHhrHhdsseEesssseEeshdHhrHk...',
      '..khrrhrssswewsssswewsrshrrhk...',
      '..krrRrrssssssssssssssrsrrRrk...',
      '..khrHhrdsssssslssssssrdhrHhk...',
      '...krhrrgssppssddssppsrgrrhk....',
      '....krrRrrdsssssssssdrRrrRk.....',
      '....krHhrHdssMwwwwMsdHhrHhk.....',
      '....krhrrhrdssMmmMsdrhrrhrk.....',
      '....kRrrRrrRdsssssdrRrrRrrk.....',
      '.....khrHhrHhddddddrHhrHhk......',
      '......kkkkrhrdssssdrhkkkk.......',
      '.........kRrrdssssdRrk..........',
      '........kkktcssssssctkkk........',
      '.....kkkttTtccssssccTtttkkk.....',
      '...kktttTttttccccccttttTtttkk...',
      '.kkttTTttttfttttFttttTttttTtfkk.',
      'ktttTTtftTttttTtttFTttttftTttTtk',
      'tFTftTtTttttTttttTttFtTtttTTtttt',
      'TttFtTttttTttttTftttTtFttTTtttTt',
      'tttTtTttTtttfTttttTttttTFtTtTftt',
    ],
    mouthClosed: {
      18: '....krHhrHdssdMMMMdsdHhrHhk.....',
      19: '....krhrrhrdsssssssdrhrrhrk.....',
    },
    eyesClosed: {
      12: '..kHhrHhdssssssssssssshdHhrHk...',
      13: '..khrrhrssseeesssseeesrshrrhk...',
    },
    palette: {
      k: '#3a2418', // outline
      s: '#efc4a4', // skin
      l: '#f9dcc6', // skin highlight
      d: '#d29878', // nose, jaw and shadow
      p: '#e8968a', // cheeks
      v: '#3a2418', // brows
      e: '#24160e', // pupils and lashes
      w: '#fcf8f2', // teeth and whites of the eyes
      m: '#7a2c26', // mouth
      M: '#c4625c', // lips
      g: '#f4f0e8', // earring studs
      r: '#2c1a12', // hair base
      R: '#1a0e0a', // hair shadow
      h: '#4a2e20', // hair highlight
      H: '#6e4a34', // hair bright highlight
      E: '#5a3a26', // eyes
      t: '#a898e0', // purple knit
      T: '#9484cc', // knit texture
      f: '#f8e070', // yellow flecks
      F: '#7ad0e0', // blue flecks
      c: '#7c6ab8', // collar
    },
    outfits: {
      tennis: {
        background: '#dcd8f4',
        rows: [
          '.........kk.kkrHhkk.kk..........',
          '........khrkhrrhrrhkrhk.........',
          '.......kRrrRrrRrrRrrRrrk........',
          '......krHhrHhrHhrHhrHhrHk.......',
          '......krhrrhrrhrrhrrhrrhk.......',
          '....kkrRccccccccccccccccrkk.....',
          '...khrHhVVVVVVVVVVVVVVVVHhrk....',
          '...krrhrrVVVVVVVVVVVVVVrhrrk....',
          '...krRrrRrUUUUUUUUUUUUrRrrRk....',
          '...krHhrHhrsssssssssshrHhrHk....',
          '...krhrrhrsvvvssssvvvsrhrrhk....',
          '...kRrrRrrssssssssssssRrrRrk....',
          '..kHhrHhdsseEesssseEeshdHhrHk...',
          '..khrrhrssswewsssswewsrshrrhk...',
          '..krrRrrssssssssssssssrsrrRrk...',
          '..khrHhrdsssssslssssssrdhrHhk...',
          '...krhrrgssppssddssppsrgrrhk....',
          '....krrRrrdsssssssssdrRrrRk.....',
          '....krHhrHdssMwwwwMsdHhrHhk.....',
          '....krhrrhrdssMmmMsdrhrrhrk.....',
          '....kRrrRrrRdsssssdrRrrRrrk.....',
          '.....khrHhrHhddddddrHhrHhk......',
          '......kkkkrhrdssssdrhkkkk.......',
          '.........kRrrdssssdRrk..........',
          '........kkkqccssssccqkkk........',
          '.....kkkqqqqccssssccqqqqkkk.....',
          '...kkqqqqqqqqqqQqqqqqqqqqqqkk...',
          '.kkQQQQqqqqqqqqQcqqqqqqqqQQQQkk.',
          'kQQQQQQqqqqqqqqQqqqqqqqqqQQQQQQk',
          'QQQQQQQqqqqqqqqQcqqqqqqqqQQQQQQQ',
          'QQQQQQQqqqqqqqqqqqqqqqqqqQQQQQQQ',
          'ccccccQqqqqqqqqqqqqqqqqqqQcccccc',
        ],
        mouthClosed: {
          18: '....krHhrHdssdMMMMdsdHhrHhk.....',
          19: '....krhrrhrdsssssssdrhrrhrk.....',
        },
        eyesClosed: {
          12: '..kHhrHhdssssssssssssshdHhrHk...',
          13: '..khrrhrssseeesssseeesrshrrhk...',
        },
        palette: {
          k: '#3a2418', // outline
          s: '#efc4a4', // skin
          l: '#f9dcc6', // skin highlight
          d: '#d29878', // nose, jaw and shadow
          p: '#e8968a', // cheeks
          v: '#3a2418', // brows
          e: '#24160e', // pupils and lashes
          w: '#fcf8f2', // teeth and whites of the eyes
          m: '#7a2c26', // mouth
          M: '#c4625c', // lips
          g: '#f4f0e8', // earring studs
          q: '#f6f4f0', // white polo
          Q: '#d8d6de', // polo shadow
          V: '#f6f4f0', // visor brim
          U: '#d8a88a', // brim shade on the forehead
          r: '#2c1a12', // hair base
          R: '#1a0e0a', // hair shadow
          h: '#4a2e20', // hair highlight
          H: '#6e4a34', // hair bright highlight
          E: '#5a3a26', // eyes
          c: '#8a78c4', // trim
        },
      },
    },
  },
  // Drawn after the real Lauren: long straight dark hair from a middle
  // part, blue eyes, a wide smile and a pink yoke sweater (pink is her
  // colour). For tennis: a white polo and a white terry headband with a
  // pink stripe
  Lauren: {
    background: '#f6dbe6',
    rows: [
      '..............kkk...............',
      '...........kkkrrrkkk............',
      '..........krrhrrrhrrk...........',
      '.........krrrhrrrhrrrk..........',
      '........khrrrhrrrHrrrhk.........',
      '.......krhrRrHrRrhrRrhrk........',
      '......kRrHrRrhssssrRrhrRk.......',
      '......kRrhrRssssssssrHrRk.......',
      '......kRrhrssllllllsshrRk.......',
      '......kRrhssssssssssssrRk.......',
      '......kRrHsvvvssssvvvsrRk.......',
      '......kRrhssssssssssssrRk.......',
      '......kRdsseEesssseEesrdrk......',
      '......kRssswewsssswewsrsrk......',
      '......kRssssssssssssssRsrk......',
      '.....krRdsssssslssssssRdrhk.....',
      '.....krRgssppssddssppsRgrhk.....',
      '.....krRrRdsssssssssdkrRrhk.....',
      '....khrRrRdssMwwwwMsdkrRrHrk....',
      '....kHrRrhkdssMmmMsdkkrRrhrk....',
      '....khrRrhkkdsssssdk.krRrhrk....',
      '...krhrRrhk.kddddddk.krRrhrRk...',
      '...krhrRrHk.kdssssdk.krRrHrRk...',
      '...krHrRrhkkkdssssdkkkrRrhrRk...',
      '...krhrRrhktcssssssctkrRrhrRk...',
      '...krhrRttotccssssccottBrhrRk...',
      '...krttTBtottcccccctotTBtttRk...',
      '.kktttttBtttotttttotttTttttttkk.',
      'kttttttttBTtttototttBBtttttttttk',
      'TtTtTtTtTtTBBTTtTBBTTtTtTtTtTtTt',
      'TtTtTtTtTtTtTtBBTtTtTtTtTtTtTtTt',
      'TtTtTtTtTtTtTtTtTtTtTtTtTtTtTtTt',
    ],
    mouthClosed: {
      18: '....khrRrRdssdMMMMdsdkrRrHrk....',
      19: '....kHrRrhkdsssssssdkkrRrhrk....',
    },
    eyesClosed: {
      12: '......kRdsssssssssssssrdrk......',
      13: '......kRssseeesssseeesrsrk......',
    },
    palette: {
      k: '#3a2418', // outline
      s: '#efc4a4', // skin
      l: '#f9dcc6', // skin highlight
      d: '#d29878', // nose, jaw and shadow
      p: '#e8968a', // cheeks
      v: '#3a2418', // brows
      e: '#24160e', // pupils and lashes
      w: '#fcf8f2', // teeth and whites of the eyes
      m: '#7a2c26', // mouth
      M: '#c4625c', // lips
      g: '#f4f0e8', // earring studs
      r: '#3a2218', // hair base
      R: '#24140e', // hair shadow
      h: '#56362a', // hair highlight
      H: '#76503a', // hair bright highlight
      E: '#5a7ea8', // eyes
      t: '#e47ac0', // pink knit
      T: '#d062aa', // knit ribs
      o: '#fae0ee', // eyelets
      B: '#c8509a', // bobble band
      c: '#b8448c', // collar
    },
    outfits: {
      tennis: {
        background: '#f6dbe6',
        rows: [
          '..............kkk...............',
          '...........kkkrrrkkk............',
          '..........krrhrrrhrrk...........',
          '.........krrrhrrrhrrrk..........',
          '........khrrrhrrrHrrrhk.........',
          '.......krhrRrHrRrhrRrhrk........',
          '......kRrVVVVVVVVVVVVVrRk.......',
          '......kRrcccccccccccccrRk.......',
          '......kRrVVVVVVVVVVVVVrRk.......',
          '......kRrhssssssssssssrRk.......',
          '......kRrHsvvvssssvvvsrRk.......',
          '......kRrhssssssssssssrRk.......',
          '......kRdsseEesssseEesrdrk......',
          '......kRssswewsssswewsrsrk......',
          '......kRssssssssssssssRsrk......',
          '.....krRdsssssslssssssRdrhk.....',
          '.....krRgssppssddssppsRgrhk.....',
          '.....krRrRdsssssssssdkrRrhk.....',
          '....khrRrRdssMwwwwMsdkrRrHrk....',
          '....kHrRrhkdssMmmMsdkkrRrhrk....',
          '....khrRrhkkdsssssdk.krRrhrk....',
          '...krhrRrhk.kddddddk.krRrhrRk...',
          '...krhrRrHk.kdssssdk.krRrHrRk...',
          '...krHrRrhkkkdssssdkkkrRrhrRk...',
          '...krhrRrhkqccssssccqkrRrhrRk...',
          '...krhrRqqqqccssssccqqqqrhrRk...',
          '...krqqqqqqqqqqQqqqqqqqqqqqRk...',
          '.kkQQQQqqqqqqqqQcqqqqqqqqQQQQkk.',
          'kQQQQQQqqqqqqqqQqqqqqqqqqQQQQQQk',
          'QQQQQQQqqqqqqqqQcqqqqqqqqQQQQQQQ',
          'QQQQQQQqqqqqqqqqqqqqqqqqqQQQQQQQ',
          'ccccccQqqqqqqqqqqqqqqqqqqQcccccc',
        ],
        mouthClosed: {
          18: '....khrRrRdssdMMMMdsdkrRrHrk....',
          19: '....kHrRrhkdsssssssdkkrRrhrk....',
        },
        eyesClosed: {
          12: '......kRdsssssssssssssrdrk......',
          13: '......kRssseeesssseeesrsrk......',
        },
        palette: {
          k: '#3a2418', // outline
          s: '#efc4a4', // skin
          l: '#f9dcc6', // skin highlight
          d: '#d29878', // nose, jaw and shadow
          p: '#e8968a', // cheeks
          v: '#3a2418', // brows
          e: '#24160e', // pupils and lashes
          w: '#fcf8f2', // teeth and whites of the eyes
          m: '#7a2c26', // mouth
          M: '#c4625c', // lips
          g: '#f4f0e8', // earring studs
          q: '#f6f4f0', // white polo
          Q: '#d8d6de', // polo shadow
          V: '#f6f4f0', // terry headband
          r: '#3a2218', // hair base
          R: '#24140e', // hair shadow
          h: '#56362a', // hair highlight
          H: '#76503a', // hair bright highlight
          E: '#5a7ea8', // eyes
          c: '#e47ac0', // trim
        },
      },
    },
  },
};

// face in its outfit named outfit, or the face itself without one
export function outfitOf(face, outfit) {
  return face?.outfits?.[outfit] || face || null;
}

// Problems with FACES, for scripts/test-jobs.js: everyone in names has a
// face, and each is FACE_SIZE square, talks and blinks
export function checkFaces(names) {
  const problems = [];
  for (const name of names) {
    if (!FACES[name]) problems.push(`${name}: no face`);
  }
  const all = Object.entries(FACES).flatMap(([name, face]) => [
    [name, face],
    ...Object.entries(face.outfits || {}).map(([outfit, f]) => [
      `${name} (${outfit})`,
      f,
    ]),
  ]);
  for (const [name, face] of all) {
    const rows = [
      ...face.rows,
      ...Object.values(face.mouthClosed || {}),
      ...Object.values(face.eyesClosed || {}),
    ];
    if (
      face.rows.length !== FACE_SIZE ||
      rows.some((r) => r.length !== FACE_SIZE)
    ) {
      problems.push(`${name}'s face: not ${FACE_SIZE} × ${FACE_SIZE}`);
    }
    if (!Object.keys(face.mouthClosed || {}).length) {
      problems.push(`${name}'s face: no mouthClosed rows`);
    }
    if (!Object.keys(face.eyesClosed || {}).length) {
      problems.push(`${name}'s face: no eyesClosed rows`);
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

// Draws face on canvas (FACE_SIZE square) over its background. hidden
// draws it as a plain silhouette, for someone you haven't met.
export function drawFace(
  canvas,
  face,
  {mouthClosed = false, eyesClosed = false, hidden = false} = {}
) {
  const ctx = canvas?.getContext('2d');
  if (!ctx || !face) return;
  const size = FACE_SIZE;
  if (canvas.width !== size) canvas.width = canvas.height = size;
  ctx.clearRect(0, 0, size, size);
  if (!hidden && face.background) {
    ctx.fillStyle = face.background;
    ctx.fillRect(0, 0, size, size);
  }
  face.rows.forEach((row, y) => {
    const line =
      (eyesClosed && face.eyesClosed?.[y]) ||
      (mouthClosed && face.mouthClosed?.[y]) ||
      row;
    for (let x = 0; x < size; x++) {
      const color = face.palette[line[x]];
      if (!color) continue;
      ctx.fillStyle = hidden ? 'rgba(255, 255, 255, 0.18)' : color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
}
