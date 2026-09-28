// --- GAME HUD & ACHIEVEMENTS OVERLAY ---
import {hooks} from './hooks.js';
import {Achievements} from './achievements.js';

var achievementsOverlay = document.getElementById('achievements-overlay');
var achievementsBtn = document.getElementById('achievements-btn');
var achievementsCloseBtn = document.getElementById('achievements-close-btn');
var pauseMapBtn = document.getElementById('pause-map-btn');
var achievementsResetBtn = document.getElementById('achievements-reset-btn');

var resetConfirmTimeout = null;

function openAchievementsOverlay() {
  if (!achievementsOverlay) return;
  // Render the grid and update progress text

  Achievements.renderAchievementsOverlay();

  achievementsOverlay.style.display = 'flex';
}

function resetAchievementsResetBtn() {
  if (resetConfirmTimeout) {
    clearTimeout(resetConfirmTimeout);
    resetConfirmTimeout = null;
  }
  if (achievementsResetBtn) {
    achievementsResetBtn.classList.remove('confirming');
    achievementsResetBtn.textContent = 'R E S E T';
  }
}

function closeAchievementsOverlay() {
  if (achievementsOverlay) {
    achievementsOverlay.style.display = 'none';
    resetAchievementsResetBtn();
  }
}

if (achievementsBtn) {
  achievementsBtn.addEventListener('click', () => {
    openAchievementsOverlay();
  });
}

if (achievementsCloseBtn) {
  achievementsCloseBtn.addEventListener('click', () => {
    closeAchievementsOverlay();
  });
}

if (pauseMapBtn) {
  pauseMapBtn.addEventListener('click', () => {
    if (hooks.fullscreenMap) {
      hooks.fullscreenMap.open();
    }
  });
}

// Click outside achievements content to close
if (achievementsOverlay) {
  achievementsOverlay.addEventListener('click', (e) => {
    if (e.target === achievementsOverlay) {
      closeAchievementsOverlay();
    }
  });
}

if (achievementsResetBtn) {
  achievementsResetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!achievementsResetBtn.classList.contains('confirming')) {
      achievementsResetBtn.classList.add('confirming');
      achievementsResetBtn.textContent = 'CONFIRM RESET?';
      resetConfirmTimeout = setTimeout(resetAchievementsResetBtn, 4000);
    } else {
      resetAchievementsResetBtn();
      if (Achievements) {
        Achievements.reset();
        Achievements.renderAchievementsOverlay();
      }
    }
  });

  // Revert button if user clicks elsewhere
  document.addEventListener('click', (e) => {
    if (e.target !== achievementsResetBtn) {
      resetAchievementsResetBtn();
    }
  });
}
