// --- ACHIEVEMENTS SYSTEM ---
// Data registry, localStorage persistence, unlock API, and in-game toast notifications.
// Loaded before game.js so Achievements.unlock() is available during gameplay.

(function () {
  'use strict';

  // --- ACHIEVEMENT REGISTRY ---
  // Each achievement has: id (snake_case key), title (display name), emoji, hint (shown after unlock)
  const ACHIEVEMENTS = [
    // 1. Intro & UI
    {
      id: 'welcome',
      title: 'Welcome to Chill Flight',
      emoji: '✈️',
      hint: 'Take your first flight',
    },
    {
      id: 'frequent_flyer',
      title: 'Frequent flyer',
      emoji: '🎖️',
      hint: 'Play 10 times',
    },
    {
      id: 'directors_cut',
      title: "Director's cut",
      emoji: '🎬',
      hint: 'Camera',
    },
    {
      id: 'night_vision',
      title: 'Night vision',
      emoji: '🔦',
      hint: 'Light',
    },
    {
      id: 'otto',
      title: 'Otto',
      emoji: '🤖',
      hint: 'Autopilot',
    },
    // 2. Flight & Maneuvers
    {
      id: 'to_the_moon',
      title: 'To the moon',
      emoji: '🌙',
      hint: 'Steep climb',
    },
    {
      id: 'nose_dive',
      title: 'Nose dive',
      emoji: '📉',
      hint: 'Steep dive',
    },
    {
      id: 'free_falling',
      title: 'Free falling',
      emoji: '🪂',
      hint: 'Cut engine mid flight',
    },
    {
      id: 'splash_down',
      title: 'Splash down',
      emoji: '💦',
      hint: 'Land in water',
    },
    {
      id: 'barrel_roll',
      title: 'Do a barrel roll',
      emoji: '🔄',
      hint: 'Do it for Peppy',
    },
    {
      id: 'froot_loops',
      title: 'Froot loops',
      emoji: '🫠',
      hint: 'Loop',
    },
    {
      id: 'u_turn',
      title: 'U-turn',
      emoji: '↩️',
      hint: 'Immelmann',
    },
    // 3. Exploration & Locations
    {
      id: 'gatsby',
      title: 'Gatsby',
      emoji: '🗼',
      hint: 'Lighthouse flyby',
    },
    {
      id: 'pura_vida',
      title: 'Pura Vida',
      emoji: '🌋',
      hint: 'Volcano flyover',
    },
    {
      id: 'xen',
      title: 'Xen',
      emoji: '👽',
      hint: 'Reach alien lands to the East',
    },
    {
      id: 'westworld',
      title: 'Westworld',
      emoji: '🤠',
      hint: 'Reach alien lands to the West',
    },
    // 4. Events
    {
      id: 'geese_police',
      title: 'Geese police',
      emoji: '🪿',
      hint: 'Hit a goose',
    },
  ];

  const STORAGE_KEY = 'chill_flight_achievements';

  // --- PERSISTENCE ---
  function loadUnlocked() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveUnlocked(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  }

  // In-memory cache so we don't parse JSON on every check
  let unlockedMap = loadUnlocked();

  // --- PUBLIC API ---

  /** Check if a specific achievement is unlocked */
  function isUnlocked(id) {
    return id in unlockedMap;
  }

  /** Get the full unlocked map { id: timestamp } */
  function getUnlockedMap() {
    return {...unlockedMap};
  }

  /** Get count of unlocked achievements */
  function getUnlockedCount() {
    return Object.keys(unlockedMap).length;
  }

  /** Get total number of achievements */
  function getTotalCount() {
    return ACHIEVEMENTS.length;
  }

  /** Get the full registry */
  function getAll() {
    return ACHIEVEMENTS;
  }

  /**
   * Unlock an achievement by id. Idempotent — does nothing if already unlocked.
   * Saves to localStorage and dispatches a CustomEvent for the toast.
   */
  function unlock(id) {
    // Already unlocked — no-op
    if (unlockedMap[id]) return false;

    // Validate the id exists in the registry
    const achievement = ACHIEVEMENTS.find((a) => a.id === id);
    if (!achievement) {
      console.warn(`[Achievements] Unknown achievement id: "${id}"`);
      return false;
    }

    // Record unlock
    unlockedMap[id] = Date.now();
    saveUnlocked(unlockedMap);

    // Fire event for toast and any other listeners
    document.dispatchEvent(
      new CustomEvent('achievement-unlocked', {
        detail: {id, title: achievement.title, emoji: achievement.emoji},
      })
    );

    // Update the pause menu button counter if it exists
    updateButtonCounter();

    return true;
  }

  // --- PAUSE MENU BUTTON COUNTER ---
  function updateButtonCounter() {
    const counter = document.getElementById('achievements-counter');
    if (counter) {
      counter.textContent = `(${getUnlockedCount()}/${getTotalCount()})`;
    }
  }

  // --- TOAST NOTIFICATIONS ---
  let toastContainer = null;

  function ensureToastContainer() {
    if (toastContainer) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.id = 'achievement-toast-container';
    document.body.appendChild(toastContainer);
    return toastContainer;
  }

  function showToast(detail) {
    const container = ensureToastContainer();

    const toast = document.createElement('div');
    toast.className = 'achievement-toast';

    const emoji = document.createElement('span');
    emoji.className = 'achievement-toast-emoji';
    emoji.textContent = detail.emoji;

    const text = document.createElement('div');
    text.className = 'achievement-toast-text';

    const label = document.createElement('div');
    label.className = 'achievement-toast-label';
    label.textContent = 'ACHIEVEMENT UNLOCKED';

    const title = document.createElement('div');
    title.className = 'achievement-toast-title';
    title.textContent = detail.title;

    text.appendChild(label);
    text.appendChild(title);
    toast.appendChild(emoji);
    toast.appendChild(text);
    container.appendChild(toast);

    // Trigger entrance animation on next frame
    requestAnimationFrame(() => {
      toast.classList.add('achievement-toast-visible');
    });

    // Remove after display duration
    setTimeout(() => {
      toast.classList.remove('achievement-toast-visible');
      toast.classList.add('achievement-toast-exit');
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, 3500);
  }

  // Listen for unlock events
  document.addEventListener('achievement-unlocked', (e) => {
    showToast(e.detail);
  });

  // --- ACHIEVEMENTS OVERLAY ---

  /** Build the achievements grid inside the overlay */
  function renderAchievementsOverlay() {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const progressEl = document.getElementById('achievements-progress');
    if (progressEl) {
      progressEl.textContent = `${getUnlockedCount()} of ${getTotalCount()} unlocked`;
    }

    updateStats(
      parseFloat(localStorage.getItem('chill_flight_lifetime_distance') || '0')
    );

    ACHIEVEMENTS.forEach((achievement) => {
      const card = document.createElement('div');
      const unlocked = isUnlocked(achievement.id);
      card.className =
        'achievement-card' + (unlocked ? ' unlocked' : ' locked');

      const emojiEl = document.createElement('div');
      emojiEl.className = 'achievement-card-emoji';
      emojiEl.textContent = achievement.emoji;

      const titleEl = document.createElement('div');
      titleEl.className = 'achievement-card-title';
      titleEl.textContent = achievement.title;

      card.appendChild(emojiEl);
      card.appendChild(titleEl);

      // Show hint only when unlocked
      if (unlocked) {
        const hintEl = document.createElement('div');
        hintEl.className = 'achievement-card-hint';
        hintEl.textContent = achievement.hint;
        card.appendChild(hintEl);
      }

      grid.appendChild(card);
    });
  }

  // Update counter on load
  document.addEventListener('DOMContentLoaded', () => {
    updateButtonCounter();
  });

  /** Reset all achievements — clears localStorage and in-memory cache */
  function reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('chill_flight_play_count');
      unlockedMap = {};
      console.log('[Achievements] Reset successfully.');
      updateButtonCounter();
    } catch (e) {
      console.error('[Achievements] Reset failed:', e);
    }
  }

  function updateStats(distance) {
    const statsEl = document.getElementById('achievements-stats');
    if (statsEl) {
      // Divide by 1000 to simulate 'miles/km' and round to 1 decimal place
      const displayDist = (distance / 1000).toFixed(1);
      statsEl.textContent = `LIFETIME DISTANCE: ${displayDist} KM`;
    }
  }

  // --- EXPOSE GLOBAL API ---
  window.Achievements = {
    getAll,
    isUnlocked,
    getUnlockedMap,
    getUnlockedCount,
    getTotalCount,
    unlock,
    reset,
    renderAchievementsOverlay,
    updateButtonCounter,
    updateStats,
  };
})();
