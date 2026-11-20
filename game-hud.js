// --- GAME HUD & ACHIEVEMENTS OVERLAY ---
import {Achievements} from './achievements.js';
import {state} from './state.js';
import {t} from './i18n.js';
import {trackScreen} from './analytics.js';
import {notificationHaptic} from './haptics.js';

var achievementsOverlay = document.getElementById('achievements-overlay');
var achievementsBtn = document.getElementById('achievements-btn');
var achievementsCloseBtn = document.getElementById('achievements-close-btn');
var achievementsResetBtn = document.getElementById('achievements-reset-btn');

var resetConfirmTimeout = null;

function openAchievementsOverlay() {
  if (!achievementsOverlay) return;
  // Render the grid and update progress text

  trackScreen('achievements');
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
    achievementsResetBtn.textContent = t('R E S E T');
  }
}

export function isAchievementsResetArmed() {
  return Boolean(achievementsResetBtn?.classList.contains('confirming'));
}

export function disarmAchievementsReset() {
  if (!isAchievementsResetArmed()) return false;
  resetAchievementsResetBtn();
  return true;
}

function closeAchievementsOverlay() {
  if (achievementsOverlay) {
    achievementsOverlay.style.display = 'none';
    resetAchievementsResetBtn();
    trackScreen(state.isPaused ? 'pause' : 'flight');
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
      achievementsResetBtn.textContent = t('CONFIRM RESET?');
      notificationHaptic('WARNING');
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
