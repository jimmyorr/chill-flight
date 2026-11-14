// --- PURRPLE CAT MUSIC CATALOG & SELECTION LOGIC ---
// Pure catalog and selection helpers for Purrple Cat's 31 CC BY 4.0 albums from
// freelofi.com after pruning spooky/Halloween releases (313 tracks, plus the
// bundled 'Birds of a Feather' track at index 0) with audio metrics from
// purr.to/sim.json.
import {ChillFlightLogic} from './chill-flight-logic.js';

export const R2_MUSIC_BASE =
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat';

// Bundled with the app so first-time play and offline fallback need no network.
export const BUNDLED_TRACK = 'assets/purrple-cat-birds-of-a-feather.mp3';

// [slug, title, year]
const RAW_ALBUMS = [
  ['birds-of-a-feather', 'Birds of a Feather', 2021],
  ['city-nights-3', 'City Nights 3', 2026],
  ['sleep-tight', 'Sleep Tight', 2025],
  ['multiverse-2', 'Multiverse 2', 2025],
  ['memories', 'Memories', 2025],
  ['ice-palace', 'Ice Palace', 2025],
  ['eye-of-the-storm', 'Eye of the Storm', 2024],
  ['happy-place', 'Happy Place', 2024],
  ['sands-of-time', 'Sands of Time', 2024],
  ['city-nights-2', 'City Nights 2', 2024],
  ['sea-of-stars-2', 'Sea of Stars 2', 2023],
  ['tranquil-trails', 'Tranquil Trails', 2023],
  ['night-train', 'Night Train', 2023],
  ['please-hold-me', 'Please Hold Me', 2023],
  ['multiverse', 'Multiverse', 2023],
  ['signs-of-life', 'Signs of Life', 2022],
  ['sea-of-stars', 'Sea of Stars', 2022],
  ['oasis', 'Oasis', 2022],
  ['city-nights', 'City Nights', 2022],
  ['above-the-clouds', 'Above the Clouds', 2021],
  ['mellow-skies', 'Mellow Skies', 2021],
  ['bloom', 'Bloom', 2021],
  ['snowbound', 'Snowbound', 2021],
  ['cat-nap', 'Cat Nap', 2020],
  ['pelagic-journey', 'Pelagic Journey', 2020],
  ['a-good-book', 'A Good Book', 2020],
  ['just-relax', 'Just Relax', 2020],
  ['nostalgia-and-moving-on', 'Nostalgia and Moving On', 2020],
  ['brain-fog', 'Brain Fog', 2019],
  ['indigo-dreams', 'Indigo Dreams', 2019],
  ['now-or-never', 'Now or Never', 2019],
  ['up-all-night', 'Up All Night', 2019],
];

// [slug, title, albumIdx, energyPct, bpm, valencePct, intensityPct]
const RAW_TRACKS = [
  ['birds-of-a-feather', 'Birds of a Feather', 0, 13, 83, 26, 33],
  ['fog-blanket', 'Fog Blanket', 1, 57, 66, 27, 52],
  ['downtown', 'Downtown', 1, 54, 66, 30, 50],
  ['window-seat', 'Window Seat', 1, 77, 60, 1, 58],
  ['corner-store', 'Corner Store', 1, 87, 60, 19, 64],
  ['skyscrapers', 'Skyscrapers', 1, 94, 66, 45, 76],
  ['cable-car', 'Cable Car', 1, 32, 90, 26, 49],
  ['insomnia', 'Insomnia', 1, 52, 67, 11, 50],
  ['half-awake', 'Half Awake', 1, 54, 60, 16, 42],
  ['cruisin', "Cruisin'", 1, 71, 66, 36, 61],
  ['stray', 'Stray', 1, 75, 64, 28, 62],
  ['missing-pieces', 'Missing Pieces', 1, 65, 90, 13, 71],
  ['3-a-m-radio', '3 A.M. Radio', 1, 46, 60, 47, 37],
  ['empty-sidewalks', 'Empty Sidewalks', 1, 64, 67, 22, 57],
  ['starry-night', 'Starry Night', 1, 53, 112, 33, 69],
  ['comfy', 'Comfy', 2, 72, 56, 20, 52],
  ['everchanging', 'Everchanging', 2, 67, 60, 20, 51],
  ['still-of-the-night', 'Still of the Night', 2, 9, 55, 3, 9],
  ['fading', 'Fading', 2, 30, 90, 28, 48],
  ['zzz', 'Zzz...', 2, 36, 98, 6, 55],
  ['dream-state', 'Dream State', 2, 64, 60, 15, 49],
  ['breathing-underwater', 'Breathing Underwater', 2, 69, 63, 29, 57],
  ['night-light', 'Night Light', 2, 69, 48, 30, 45],
  ['out-of-place', 'Out of Place', 2, 58, 52, 20, 39],
  ['soft', 'Soft', 2, 52, 59, 18, 40],
  ['weird-dream', 'Weird Dream', 2, 54, 55, 20, 38],
  ['astral-projection', 'Astral Projection', 2, 56, 55, 12, 39],
  ['all-curled-up', 'All Curled Up', 2, 50, 82, 44, 57],
  ['weightless', 'Weightless', 2, 41, 60, 15, 34],
  ['familiar-faces', 'Familiar Faces', 2, 54, 50, 20, 36],
  ['awakenings', 'Awakenings', 3, 57, 81, 19, 61],
  ['ethereal', 'Ethereal', 3, 38, 113, 24, 59],
  ['transformation', 'Transformation', 3, 36, 105, 36, 57],
  ['egress', 'Egress', 3, 62, 63, 16, 52],
  ['refractions', 'Refractions', 3, 80, 100, 15, 84],
  ['nexus', 'Nexus', 3, 75, 54, 29, 51],
  ['rewind', 'Rewind', 3, 91, 96, 26, 90],
  ['unreality', 'Unreality', 3, 60, 87, 28, 66],
  ['upside-down', 'Upside Down', 3, 81, 90, 21, 81],
  ['in-between', 'In Between', 3, 47, 60, 24, 38],
  ['paradox', 'Paradox', 3, 89, 75, 32, 78],
  ['convergence', 'Convergence', 3, 67, 70, 27, 61],
  ['intertwined', 'Intertwined', 3, 56, 92, 25, 67],
  ['memories', 'Memories', 4, 71, 87, 39, 73],
  ['with-you', 'With You', 4, 48, 80, 20, 54],
  ['stay-with-me', 'Stay With Me', 4, 51, 62, 28, 44],
  ['take-me-to-the-moon', 'Take Me to the Moon', 4, 27, 54, 35, 20],
  ['dreaming-of-you', 'Dreaming of You', 4, 81, 62, 26, 64],
  ['remember', 'Remember', 4, 49, 60, 28, 39],
  ['frozen-flowers', 'Frozen Flowers', 5, 58, 67, 37, 53],
  ['snow-pillow', 'Snow Pillow', 5, 35, 68, 23, 39],
  ['icicles', 'Icicles', 5, 59, 54, 25, 41],
  ['aurora', 'Aurora', 5, 40, 110, 28, 60],
  ['peppermint-mocha', 'Peppermint Mocha', 5, 27, 108, 24, 51],
  ['the-toymaker', 'The Toymaker', 5, 41, 70, 38, 45],
  ['wonderland', 'Wonderland', 5, 87, 69, 40, 74],
  ['chasing-snowflakes', 'Chasing Snowflakes', 5, 33, 90, 17, 50],
  ['toasty', 'Toasty', 5, 38, 56, 12, 29],
  ['ice-palace', 'Ice Palace', 5, 75, 68, 23, 66],
  ['frosted-evergreen', 'Frosted Evergreen', 5, 53, 61, 21, 45],
  ['gingerbread-house', 'Gingerbread House', 5, 45, 66, 13, 44],
  ['sirens-song', "Siren's Song", 6, 74, 68, 33, 65],
  ['downpour', 'Downpour', 6, 95, 74, 32, 82],
  ['maelstrom', 'Maelstrom', 6, 73, 59, 37, 54],
  ['lighthouse', 'Lighthouse', 6, 93, 63, 54, 72],
  ['thunderous-waves', 'Thunderous Waves', 6, 83, 53, 27, 56],
  ['sunken-secrets', 'Sunken Secrets', 6, 23, 62, 37, 26],
  ['ebb-and-flow', 'Ebb and Flow', 6, 60, 70, 39, 57],
  ['eye-of-the-storm', 'Eye of the Storm', 6, 62, 70, 7, 58],
  ['leviathan', 'Leviathan', 6, 59, 80, 18, 61],
  ['shelter', 'Shelter', 6, 69, 80, 30, 67],
  ['cave-of-solace', 'Cave of Solace', 6, 85, 80, 52, 77],
  ['sea-foam', 'Sea Foam', 6, 65, 82, 32, 67],
  ['undertow', 'Undertow', 6, 86, 73, 8, 76],
  ['lost-at-sea', 'Lost at Sea', 6, 90, 89, 9, 86],
  ['adrift', 'Adrift', 6, 68, 82, 20, 69],
  ['daydreams', 'Daydreams', 7, 31, 58, 30, 26],
  ['strawberry-lemonade', 'Strawberry Lemonade', 7, 90, 54, 9, 60],
  ['double-rainbow', 'Double Rainbow', 7, 70, 98, 7, 77],
  ['vibin', "Vibin'", 7, 35, 80, 77, 45],
  ['golden-hour', 'Golden Hour', 7, 51, 82, 25, 58],
  ['beach-club', 'Beach Club', 7, 93, 72, 89, 80],
  ['somewhere-new', 'Somewhere New', 7, 73, 93, 41, 78],
  ['earl-grey', 'Earl Grey', 7, 19, 60, 33, 20],
  ['cloud-9', 'Cloud 9', 7, 72, 65, 15, 61],
  ['wildflowers', 'Wildflowers', 7, 44, 52, 11, 30],
  ['butterfly', 'Butterfly', 7, 88, 75, 14, 78],
  ['sunshine-boulevard', 'Sunshine Boulevard', 7, 54, 64, 23, 49],
  ['hibiscus', 'Hibiscus', 7, 63, 66, 36, 56],
  ['bubble-wand', 'Bubble Wand', 7, 77, 60, 49, 57],
  ['sandstorm', 'Sandstorm', 8, 24, 66, 37, 30],
  ['echoes-of-yesterday', 'Echoes of Yesterday', 8, 29, 63, 43, 31],
  ['dance-of-the-cacti', 'Dance of the Cacti', 8, 30, 59, 7, 26],
  ['mirage', 'Mirage', 8, 71, 76, 6, 67],
  ['desert-rain', 'Desert Rain', 8, 40, 57, 55, 31],
  ['tumbleweeds', 'Tumbleweeds', 8, 54, 70, 15, 53],
  ['desolate', 'Desolate', 8, 37, 56, 19, 29],
  ['artifact', 'Artifact', 8, 73, 65, 9, 61],
  ['mesas-edge', "Mesa's Edge", 8, 42, 90, 10, 56],
  ['dune-drifter', 'Dune Drifter', 8, 38, 67, 17, 41],
  ['epiphany', 'Epiphany', 8, 47, 58, 22, 36],
  ['on-the-brink', 'On the Brink', 8, 95, 89, 19, 90],
  ['the-portal', 'The Portal', 8, 60, 65, 28, 53],
  ['what-lies-beyond', 'What Lies Beyond', 8, 81, 77, 18, 74],
  ['twilight-market', 'Twilight Market', 9, 19, 62, 4, 24],
  ['rooftop-rendezvous', 'Rooftop Rendezvous', 9, 15, 60, 22, 17],
  ['rainy-streets', 'Rainy Streets', 9, 50, 60, 8, 40],
  ['in-the-moment', 'In the Moment', 9, 42, 58, 19, 33],
  ['the-midnight-diner', 'The Midnight Diner', 9, 84, 64, 4, 68],
  ['exploration', 'Exploration', 9, 12, 49, 21, 8],
  ['lonely', 'Lonely', 9, 9, 56, 11, 10],
  ['torn', 'Torn', 9, 43, 108, 19, 62],
  ['night-owls', 'Night Owls', 9, 19, 56, 4, 17],
  ['fragments', 'Fragments', 9, 39, 64, 17, 38],
  ['sonder', 'Sonder', 9, 37, 62, 11, 35],
  ['oddity', 'Oddity', 10, 59, 63, 51, 50],
  ['luminous', 'Luminous', 10, 23, 59, 20, 21],
  ['once-in-a-lifetime', 'Once in a Lifetime', 10, 56, 60, 18, 44],
  ['glowing-tides', 'Glowing Tides', 10, 77, 83, 25, 75],
  ['elevated', 'Elevated', 10, 78, 56, 24, 55],
  ['distant-ships', 'Distant Ships', 10, 85, 61, 19, 66],
  ['celestial-sands', 'Celestial Sands', 10, 43, 104, 5, 61],
  ['nightfall', 'Nightfall', 10, 36, 59, 17, 30],
  ['magical-moments', 'Magical Moments', 10, 78, 76, 49, 72],
  ['starlit-beach', 'Starlit Beach', 10, 20, 52, 12, 14],
  ['satellite', 'Satellite', 10, 88, 81, 17, 81],
  ['fallen', 'Fallen', 10, 34, 58, 12, 28],
  ['constellations', 'Constellations', 10, 9, 85, 7, 31],
  ['serenity-now', 'Serenity Now', 11, 30, 92, 24, 50],
  ['under-the-canopy', 'Under the Canopy', 11, 25, 61, 9, 27],
  ['birdhouse', 'Birdhouse', 11, 51, 88, 21, 61],
  ['changes', 'Changes', 11, 92, 78, 12, 82],
  ['cool-breeze', 'Cool Breeze', 11, 14, 70, 11, 27],
  ['lush', 'Lush', 11, 63, 70, 13, 59],
  ['verdant', 'Verdant', 11, 28, 59, 12, 24],
  ['looking-up', 'Looking Up', 11, 21, 97, 30, 45],
  ['wanderlust', 'Wanderlust', 11, 28, 60, 48, 25],
  ['morning-dew', 'Morning Dew', 11, 54, 62, 9, 46],
  ['night-train', 'Night Train', 12, 26, 62, 7, 28],
  ['passing-time', 'Passing Time', 12, 67, 90, 4, 72],
  ['after-hours', 'After Hours', 12, 33, 77, 25, 43],
  ['crossroads', 'Crossroads', 12, 80, 70, 16, 70],
  ['tunnels', 'Tunnels', 12, 64, 64, 6, 55],
  ['mysterious-passenger', 'Mysterious Passenger', 12, 46, 69, 4, 47],
  ['time-loop', 'Time Loop', 12, 15, 60, 12, 17],
  ['tracks-to-nowhere', 'Tracks to Nowhere', 12, 62, 90, 7, 68],
  ['running-late', 'Running Late', 12, 85, 63, 22, 67],
  ['end-of-the-line', 'End of the Line', 12, 70, 60, 19, 53],
  ['please-hold-me', 'Please Hold Me', 13, 14, 57, 12, 14],
  ['starseed', 'Starseed', 14, 7, 115, 9, 40],
  ['creation', 'Creation', 14, 47, 68, 51, 47],
  ['otherworldly', 'Otherworldly', 14, 50, 75, 13, 53],
  ['fourth-dimension', 'Fourth Dimension', 14, 44, 88, 48, 57],
  ['rift-in-time', 'Rift in Time', 14, 19, 90, 29, 40],
  ['stasis', 'Stasis', 14, 25, 90, 5, 45],
  ['exhale', 'Exhale', 14, 63, 65, 51, 55],
  ['planetary-alignment', 'Planetary Alignment', 14, 78, 80, 42, 73],
  ['cosmic-echoes', 'Cosmic Echoes', 14, 10, 60, 5, 14],
  ['ufo', 'UFO', 14, 86, 74, 58, 76],
  ['embrace', 'Embrace', 15, 9, 59, 23, 12],
  ['bird-bath', 'Bird Bath', 15, 29, 60, 21, 26],
  ['lost-and-found', 'Lost and Found', 15, 11, 67, 12, 23],
  ['in-the-past', 'In the Past', 15, 5, 60, 12, 10],
  ['dream-machine', 'Dream Machine', 15, 6, 89, 7, 32],
  ['serendipity', 'Serendipity', 15, 52, 70, 17, 52],
  ['contact', 'Contact', 15, 64, 59, 10, 47],
  ['lazy-afternoon', 'Lazy Afternoon', 15, 35, 80, 4, 45],
  ['wonderment', 'Wonderment', 15, 44, 106, 36, 62],
  ['signs-of-life', 'Signs of Life', 15, 41, 61, 12, 37],
  ['meteorites', 'Meteorites', 16, 56, 63, 9, 49],
  ['wishes', 'Wishes', 16, 15, 65, 46, 24],
  ['take-me-with-you', 'Take Me With You', 16, 22, 104, 4, 47],
  ['sea-of-stars', 'Sea of Stars', 16, 18, 66, 9, 27],
  ['aether', 'Aether', 16, 29, 48, 33, 19],
  ['supernova', 'Supernova', 16, 22, 60, 12, 21],
  ['stars-collide', 'Stars Collide', 16, 33, 60, 16, 28],
  ['out-of-the-blue', 'Out of the Blue', 16, 25, 90, 7, 44],
  ['timeless', 'Timeless', 16, 35, 100, 23, 55],
  ['deja-vu', 'Deja Vu', 16, 57, 64, 9, 50],
  ['heart-of-the-ocean', 'Heart of the Ocean', 17, 17, 63, 6, 23],
  ['palm-tree', 'Palm Tree', 17, 39, 90, 33, 53],
  ['happy-trails', 'Happy Trails', 17, 28, 69, 26, 36],
  ['beautiful-day', 'Beautiful Day', 17, 8, 50, 15, 6],
  ['pineapple-popsicle', 'Pineapple Popsicle', 17, 4, 83, 21, 28],
  ['message-in-a-bottle', 'Message in a Bottle', 17, 27, 104, 16, 50],
  ['rocky-shores', 'Rocky Shores', 17, 17, 59, 4, 17],
  ['drifting', 'Drifting', 17, 1, 92, 7, 31],
  ['underwater-cavern', 'Underwater Cavern', 17, 6, 82, 7, 28],
  ['low-tide', 'Low Tide', 17, 15, 54, 18, 12],
  ['seashells', 'Seashells', 17, 2, 90, 18, 29],
  ['crescent-moon', 'Crescent Moon', 18, 2, 55, 10, 5],
  ['star-bright', 'Star Bright', 18, 32, 65, 60, 35],
  ['solitude', 'Solitude', 18, 0, 65, 38, 14],
  ['wish-you-were-here', 'Wish You Were Here', 18, 12, 65, 11, 22],
  ['visions', 'Visions', 18, 34, 60, 23, 29],
  ['cant-sleep', "Can't Sleep", 18, 7, 50, 9, 6],
  ['dark-corners', 'Dark Corners', 18, 25, 62, 14, 27],
  ['streetlights', 'Streetlights', 18, 7, 63, 27, 17],
  ['time-to-think', 'Time to Think', 18, 23, 55, 7, 18],
  ['alley-cat', 'Alley Cat', 18, 24, 56, 28, 20],
  ['dancing-shadows', 'Dancing Shadows', 18, 21, 56, 15, 18],
  ['flying', 'Flying', 19, 6, 55, 7, 7],
  ['windy', 'Windy', 19, 41, 71, 52, 46],
  ['balloon', 'Balloon', 19, 4, 66, 28, 18],
  ['fluffy', 'Fluffy', 19, 39, 49, 34, 26],
  ['peace', 'Peace', 19, 1, 55, 10, 4],
  ['bliss', 'Bliss', 19, 20, 90, 59, 42],
  ['nocturne', 'Nocturne', 19, 25, 75, 33, 37],
  ['unknown', 'Unknown', 19, 10, 91, 11, 37],
  ['turbulence', 'Turbulence', 19, 12, 55, 6, 11],
  ['somnium', 'Somnium', 19, 22, 53, 39, 16],
  ['warm-horizon', 'Warm Horizon', 20, 46, 55, 39, 33],
  ['dancing-dandelions', 'Dancing Dandelions', 20, 29, 60, 17, 26],
  ['gentle-breeze', 'Gentle Breeze', 20, 1, 90, 19, 29],
  ['days-end', "Day's End", 20, 44, 72, 37, 48],
  ['secret-of-the-forest', 'Secret of the Forest', 20, 46, 62, 8, 41],
  ['moving-landscapes', 'Moving Landscapes', 20, 45, 90, 24, 58],
  ['lost-paradise', 'Lost Paradise', 20, 33, 73, 64, 41],
  ['field-of-fireflies', 'Field of Fireflies', 20, 17, 112, 54, 45],
  ['calm-waters', 'Calm Waters', 20, 7, 90, 48, 33],
  ['flourish', 'Flourish', 21, 58, 86, 40, 64],
  ['bloom', 'Bloom', 21, 8, 60, 4, 12],
  ['wild-strawberry', 'Wild Strawberry', 21, 15, 60, 6, 17],
  ['spring-showers', 'Spring Showers', 21, 2, 60, 13, 9],
  ['green-tea', 'Green Tea', 21, 28, 80, 38, 41],
  ['equinox', 'Equinox', 21, 16, 87, 4, 37],
  ['forget-me-not', 'Forget-Me-Not', 21, 91, 61, 11, 70],
  ['frolic', 'Frolic', 21, 95, 68, 49, 78],
  ['wishing-well', 'Wishing Well', 21, 13, 62, 30, 20],
  ['lullaby', 'Lullaby', 21, 4, 65, 58, 17],
  ['festival-of-lights', 'Festival of Lights', 22, 81, 74, 6, 73],
  ['sweater-weather', 'Sweater Weather', 22, 61, 73, 64, 60],
  ['ice-skating', 'Ice Skating', 22, 34, 86, 28, 48],
  ['freezing-winds', 'Freezing Winds', 22, 84, 74, 25, 75],
  ['cold-hands', 'Cold Hands', 22, 30, 80, 11, 42],
  ['hot-chocolate', 'Hot Chocolate', 22, 57, 88, 87, 64],
  ['snow-angels', 'Snow Angels', 22, 41, 95, 31, 58],
  ['frigid', 'Frigid', 22, 48, 60, 46, 39],
  ['shopping-spree', 'Shopping Spree', 22, 99, 85, 33, 90],
  ['cozy-fireplace', 'Cozy Fireplace', 22, 22, 72, 38, 34],
  ['cat-nap', 'Cat Nap', 23, 47, 80, 29, 53],
  ['treat-time', 'Treat Time', 23, 49, 77, 61, 53],
  ['purr-box', 'Purr Box', 23, 91, 60, 23, 66],
  ['cat-nip-daze', 'Cat Nip Daze', 23, 65, 68, 75, 59],
  ['cardboard-box-adventure', 'Cardboard Box Adventure', 23, 26, 115, 7, 52],
  ['empty-food-bowl', 'Empty Food Bowl', 23, 1, 63, 8, 13],
  ['bird-watching', 'Bird Watching', 23, 27, 55, 14, 20],
  ['the-red-dot', 'The Red Dot', 23, 93, 63, 24, 73],
  ['ball-of-yarn', 'Ball of Yarn', 23, 83, 80, 21, 76],
  ['wispy-whiskers', 'Wispy Whiskers', 23, 60, 70, 19, 57],
  ['sunlit-shore', 'Sunlit Shore', 24, 94, 102, 13, 94],
  ['beach-bonfire', 'Beach Bonfire', 24, 90, 80, 83, 80],
  ['pelagic-journey', 'Pelagic Journey', 24, 96, 50, 6, 63],
  ['bubbles', 'Bubbles', 24, 79, 84, 42, 77],
  ['swimming-with-whales', 'Swimming With Whales', 24, 79, 100, 54, 84],
  ['bookworm', 'Bookworm', 25, 75, 85, 27, 75],
  ['coffee-jelly', 'Coffee Jelly', 25, 80, 90, 71, 80],
  ['tiny-ballerina', 'Tiny Ballerina', 25, 64, 78, 16, 64],
  ['i-have-too-many-feelings', 'I Have Too Many Feelings', 25, 74, 100, 12, 80],
  ['summer-crush', 'Summer Crush', 25, 71, 56, 25, 51],
  ['another-dimension', 'Another Dimension', 25, 60, 87, 55, 66],
  ['wait-what', 'Wait What', 25, 29, 90, 40, 47],
  ['happy', 'Happy', 25, 99, 90, 57, 93],
  ['fake-mustache', 'Fake Mustache', 25, 75, 90, 37, 77],
  ['sad-ending', 'Sad Ending', 25, 90, 55, 26, 62],
  ['beach-resort', 'Beach Resort', 26, 92, 80, 37, 82],
  ['just-relax', 'Just Relax', 26, 59, 67, 21, 54],
  ['road-trip', 'Road Trip', 26, 12, 80, 18, 30],
  ['disassociate', 'Disassociate', 26, 18, 83, 42, 37],
  ['foggy-window', 'Foggy Window', 26, 62, 80, 30, 63],
  ['quiet-night', 'Quiet Night', 26, 47, 77, 5, 52],
  ['getting-a-haircut', 'Getting a Haircut', 26, 36, 72, 69, 43],
  ['the-golden-ratio', 'The Golden Ratio', 26, 77, 84, 84, 75],
  [
    'riding-my-bike-to-the-end-of-the-world',
    'Riding My Bike to the End of the World',
    26,
    68,
    84,
    81,
    70,
  ],
  ['look-on-the-bright-side', 'Look on the Bright Side', 26, 69, 60, 69, 52],
  [
    'remembering-all-the-good-times',
    'Remembering All the Good Times',
    27,
    17,
    80,
    40,
    33,
  ],
  [
    'hiding-in-my-room-until-everyone-leaves',
    'Hiding in My Room Until Everyone Leaves',
    27,
    11,
    82,
    66,
    32,
  ],
  ['loading-screen', 'Loading Screen', 27, 61, 55, 24, 43],
  ['sigh', 'Sigh', 27, 52, 87, 32, 60],
  ['turtle-sandbox', 'Turtle Sandbox', 27, 21, 71, 39, 33],
  [
    'taking-a-bath-and-jumping-into-bed',
    'Taking a Bath and Jumping Into Bed',
    27,
    40,
    77,
    64,
    47,
  ],
  ['i-cant-breathe', "I Can't Breathe", 27, 35, 81, 24, 47],
  ['i-miss-you', 'I Miss You', 27, 32, 48, 8, 21],
  [
    'goodbye-i-hope-we-meet-again',
    'Goodbye, I Hope We Meet Again',
    27,
    5,
    90,
    45,
    32,
  ],
  [
    'manifestations-of-the-heart',
    'Manifestations of the Heart',
    27,
    37,
    80,
    22,
    46,
  ],
  ['entering-the-dream-world', 'Entering the Dream World', 28, 14, 89, 25, 37],
  ['brain-fog', 'Brain Fog', 28, 3, 65, 35, 16],
  [
    'stale-cookies-still-taste-pretty-good',
    'Stale Cookies Still Taste Pretty Good',
    28,
    6,
    84,
    63,
    30,
  ],
  [
    'flickering-light-in-the-dark',
    'Flickering Light in the Dark',
    28,
    84,
    55,
    14,
    57,
  ],
  ['box-of-kittens', 'Box of Kittens', 28, 29, 50, 41, 19],
  ['questioning-the-universe', 'Questioning the Universe', 28, 24, 87, 71, 42],
  [
    'sometimes-i-feel-like-im-stuck-in-limbo',
    "Sometimes I Feel Like I'm Stuck in Limbo",
    28,
    10,
    54,
    45,
    9,
  ],
  ['indigo-dreams', 'Indigo Dreams', 29, 74, 55, 29, 51],
  ['this-feeling', 'This Feeling', 29, 81, 60, 37, 60],
  ['cloud-watching', 'Cloud Watching', 29, 83, 86, 45, 80],
  ['saturday-morning', 'Saturday Morning', 29, 65, 55, 28, 45],
  ['im-lost-but-thats-ok', "I'm Lost but That's Ok", 29, 70, 93, 48, 77],
  [
    'opening-the-window-for-some-fresh-air',
    'Opening the Window for Some Fresh Air',
    29,
    41,
    98,
    37,
    58,
  ],
  [
    'walking-to-the-park-at-3-a-m',
    'Walking to the Park at 3 A.M.',
    29,
    14,
    100,
    35,
    41,
  ],
  ['squeaky-computer-chair', 'Squeaky Computer Chair', 30, 99, 87, 94, 91],
  ['now-or-never', 'Now or Never', 30, 96, 81, 23, 86],
  [
    'remembering-something-i-forgot',
    'Remembering Something I Forgot',
    30,
    17,
    80,
    67,
    33,
  ],
  [
    'its-going-to-be-a-good-day',
    "It's Going to Be a Good Day",
    30,
    43,
    80,
    28,
    50,
  ],
  ['learning-to-love-myself', 'Learning to Love Myself', 30, 86, 70, 16, 74],
  ['trying-something-new', 'Trying Something New', 30, 97, 54, 36, 65],
  ['the-last-day-i-saw-you', 'The Last Day I Saw You', 30, 100, 83, 41, 90],
  [
    'there-was-nothing-i-could-do',
    'There Was Nothing I Could Do',
    30,
    96,
    60,
    56,
    70,
  ],
  ['a-short-walk-with-you', 'A Short Walk With You', 31, 88, 77, 26, 78],
  [
    'i-thought-wed-be-friends-forever',
    "I Thought We'd Be Friends Forever",
    31,
    68,
    110,
    4,
    78,
  ],
  ['lets-go-shopping', "Let's Go Shopping", 31, 100, 60, 82, 72],
  ['it-was-just-a-dream', 'It Was Just a Dream', 31, 10, 60, 24, 14],
  ['my-cookie-fell-apart', 'My Cookie Fell Apart', 31, 0, 86, 34, 26],
  ['cold-rainy', 'Cold & Rainy', 31, 86, 90, 7, 84],
  ['up-all-night', 'Up All Night', 31, 3, 100, 28, 34],
];

// Each of the 8 daily scenic spawn corridors rotates weekly across its paired
// albums/EPs (30 multi-track records), matched by atmosphere and biome.
export const SCENIC_ALBUM_POOLS = {
  Falls: ['tranquil-trails', 'bloom', 'mellow-skies', 'memories'],
  Volcano: [
    'eye-of-the-storm',
    'now-or-never',
    'up-all-night',
    'city-nights-3',
  ],
  Lighthouse: [
    'sea-of-stars',
    'sea-of-stars-2',
    'pelagic-journey',
    'happy-place',
  ],
  Canyon: [
    'night-train',
    'nostalgia-and-moving-on',
    'a-good-book',
    'city-nights-2',
  ],
  Pyramids: ['sands-of-time', 'oasis', 'multiverse', 'multiverse-2'],
  Skeleton: ['ice-palace', 'snowbound', 'signs-of-life', 'sleep-tight'],
  Swamp: ['cat-nap', 'brain-fog', 'indigo-dreams', 'city-nights'],
  'Rock Arch': [
    'above-the-clouds',
    'just-relax',
    'mellow-skies',
    'happy-place',
  ],
};

export const PURRPLE_CAT_ALBUMS = RAW_ALBUMS.map(
  ([slug, title, year], index) => ({
    index,
    slug,
    title,
    year,
    coverUrl: `${R2_MUSIC_BASE}/covers/${slug}-300.webp`,
    startTrackIdx: -1,
    trackCount: 0,
  })
);

export const PURRPLE_CAT_TRACKS = RAW_TRACKS.map(
  ([slug, title, albumIdx, energy, bpm, valence, intensity], index) => {
    const album = PURRPLE_CAT_ALBUMS[albumIdx];
    if (album.startTrackIdx === -1) album.startTrackIdx = index;
    album.trackCount++;
    const fileName = `purrple-cat-${slug}.mp3`;
    return {
      index,
      slug,
      title,
      fileName,
      url: `${R2_MUSIC_BASE}/${fileName}`,
      albumIdx,
      albumSlug: album.slug,
      albumTitle: album.title,
      albumYear: album.year,
      albumCoverUrl: album.coverUrl,
      energy: energy / 100,
      bpm,
      valence: valence / 100,
      intensity: intensity / 100,
    };
  }
);

export const purrpleCatTracks = PURRPLE_CAT_TRACKS.map((t) => t.url);

export function findAlbumBySlugOrTitle(query) {
  if (!query || typeof query !== 'string') return null;
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return (
    PURRPLE_CAT_ALBUMS.find(
      (a) => a.slug === q || a.title.toLowerCase() === q
    ) ||
    PURRPLE_CAT_ALBUMS.find(
      (a) => a.slug.includes(q) || a.title.toLowerCase().includes(q)
    ) ||
    null
  );
}

function seedDays(seed) {
  if (Number.isInteger(seed) && seed >= 10000101 && seed <= 99991231) {
    const y = Math.floor(seed / 10000);
    const m = Math.floor(seed / 100) % 100;
    const d = seed % 100;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
    }
  }
  return Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 0;
}

// Picks the featured album for a world seed (or explicit ?album= override):
// matches today's scenic spawn corridor and rotates through its album pool each
// 8-day cycle so consecutive visits across 32 days play 32 different albums.
export function dailyAlbumForSeed(
  seed = ChillFlightLogic.WORLD_SEED,
  albumParam = ChillFlightLogic.ALBUM_PARAM
) {
  const explicit = findAlbumBySlugOrTitle(albumParam);
  if (explicit && explicit.startTrackIdx >= 0) return explicit;

  const corridorIdx = ChillFlightLogic.dailySpawnIndex(seed);
  const corridor =
    ChillFlightLogic.SCENIC_SPAWNS[corridorIdx] ||
    ChillFlightLogic.SCENIC_SPAWNS[0];
  const pool = SCENIC_ALBUM_POOLS[corridor] || SCENIC_ALBUM_POOLS.Falls;
  const days = seedDays(seed);
  const cycleIdx =
    ((Math.floor(days / ChillFlightLogic.SCENIC_SPAWNS.length) % pool.length) +
      pool.length) %
    pool.length;
  const slug = pool[cycleIdx];
  return findAlbumBySlugOrTitle(slug) || PURRPLE_CAT_ALBUMS[1];
}

export function albumTrackForProgress(album, albumProgress = null) {
  if (!album || album.startTrackIdx < 0) return 0;
  const count = Math.max(1, album.trackCount || 1);
  const raw =
    albumProgress && typeof albumProgress === 'object'
      ? Number(albumProgress[album.slug])
      : 0;
  const offset =
    Number.isInteger(raw) && raw >= 0 ? ((raw % count) + count) % count : 0;
  return album.startTrackIdx + offset;
}

export function nextAlbumProgressOffset(trackIdx) {
  const track = PURRPLE_CAT_TRACKS[trackIdx];
  if (!track || track.albumIdx <= 0) return null;
  const album = PURRPLE_CAT_ALBUMS[track.albumIdx];
  if (!album || album.trackCount <= 0) return null;
  const offset = track.index - album.startTrackIdx;
  return {
    albumSlug: album.slug,
    nextOffset: (offset + 1) % album.trackCount,
  };
}

export function initialTrackIndex({
  playedBefore = ChillFlightLogic.PLAYED_BEFORE,
  seed = ChillFlightLogic.WORLD_SEED,
  albumParam = ChillFlightLogic.ALBUM_PARAM,
  albumProgress = null,
} = {}) {
  const explicit = findAlbumBySlugOrTitle(albumParam);
  if (explicit && explicit.startTrackIdx >= 0) {
    return albumTrackForProgress(explicit, albumProgress);
  }
  if (!playedBefore) return 0;
  const album = dailyAlbumForSeed(seed, null);
  return albumTrackForProgress(album, albumProgress);
}

// Computes a normalized [0, 1] flight energy score from live vehicle, speed,
// and maneuver state so 'vibe' mode can match track intensity and BPM to how
// the player is flying.
export function computeFlightEnergy(flightState = {}) {
  const {
    planeType = 'seaplane',
    flightSpeedMultiplier = 1,
    smoothedManeuverFactor = 0,
    sharpTurnAmount = 0,
    isBarrelRolling = false,
    isLooping = false,
    isDoingImmelmann = false,
    isOnGround = false,
    isOnWater = false,
    buggySlide = 0,
  } = flightState;

  const speed = Number.isFinite(flightSpeedMultiplier)
    ? Math.max(0, flightSpeedMultiplier)
    : 1;

  if ((isOnGround || isOnWater) && speed < 0.15) {
    return 0.08;
  }

  const baseByVehicle = {
    biplane: 0.24,
    seaplane: 0.38,
    buggy: 0.42,
    twin: 0.52,
    jet: 0.68,
  };
  const base = baseByVehicle[planeType] ?? 0.38;
  const speedDelta = (speed - 1.0) * 0.28;
  const maneuverBoost =
    Math.max(0, Math.min(1, smoothedManeuverFactor || 0)) * 0.18 +
    Math.max(0, Math.min(1, sharpTurnAmount || 0)) * 0.14 +
    Math.max(0, Math.min(1, buggySlide || 0)) * 0.18 +
    (isBarrelRolling || isLooping || isDoingImmelmann ? 0.22 : 0);

  return Math.max(0, Math.min(1, base + speedDelta + maneuverBoost));
}

// Advances to the next (or previous) track in either 'album' mode (sequentially
// through the record, then into the next record in the corridor pool) or 'vibe'
// mode (matching track intensity/BPM to flightEnergy with smooth transitions).
export function nextTrackIndex(
  currentIdx,
  {
    mode = 'album',
    flightEnergy = 0.4,
    recentIndices = [],
    albumProgress = null,
    step = 1,
  } = {}
) {
  const total = PURRPLE_CAT_TRACKS.length;
  const safeCurrent = ((Math.trunc(currentIdx || 0) % total) + total) % total;

  if (step < 0) {
    if (mode === 'vibe' && recentIndices.length > 0) {
      const prev = recentIndices[recentIndices.length - 1];
      if (
        Number.isInteger(prev) &&
        prev >= 0 &&
        prev < total &&
        prev !== safeCurrent
      ) {
        return prev;
      }
    }
    return safeCurrent <= 1 ? total - 1 : safeCurrent - 1;
  }

  if (mode === 'vibe') {
    const target = Math.max(0, Math.min(1, Number(flightEnergy) || 0.4));
    const current = PURRPLE_CAT_TRACKS[safeCurrent];
    const recentSet = new Set(recentIndices.slice(-24));
    recentSet.add(safeCurrent);

    let bestIdx = (safeCurrent + 1) % total;
    let bestScore = Infinity;

    for (let i = 1; i < total; i++) {
      if (recentSet.has(i)) continue;
      const cand = PURRPLE_CAT_TRACKS[i];
      const intensityDiff = Math.abs(cand.intensity - target);
      const valenceDiff = Math.abs(cand.valence - current.valence);
      const bpmDiff = Math.abs(cand.bpm - current.bpm) / 80;
      const sameAlbumBonus = cand.albumIdx === current.albumIdx ? -0.025 : 0;
      const score =
        intensityDiff * 0.72 +
        valenceDiff * 0.16 +
        bpmDiff * 0.12 +
        sameAlbumBonus;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  // 'album' mode: play through the current album in track order; when an album
  // finishes, advance to the next album in the same corridor pool (or next album).
  const current = PURRPLE_CAT_TRACKS[safeCurrent];
  const nextSequential = safeCurrent + 1;
  if (
    nextSequential < total &&
    PURRPLE_CAT_TRACKS[nextSequential].albumIdx === current.albumIdx
  ) {
    return nextSequential;
  }

  for (const pool of Object.values(SCENIC_ALBUM_POOLS)) {
    const pos = pool.indexOf(current.albumSlug);
    if (pos !== -1) {
      const nextSlug = pool[(pos + 1) % pool.length];
      const nextAlbum = findAlbumBySlugOrTitle(nextSlug);
      if (nextAlbum && nextAlbum.startTrackIdx > 0) {
        return albumTrackForProgress(nextAlbum, albumProgress);
      }
    }
  }

  return nextSequential < total ? nextSequential : 1;
}

export function formatTrackDisplay(trackIdx) {
  const track = PURRPLE_CAT_TRACKS[trackIdx] || PURRPLE_CAT_TRACKS[0];
  if (!track.albumTitle || track.title === track.albumTitle) {
    return track.title;
  }
  return `${track.title} · ${track.albumTitle}`;
}
