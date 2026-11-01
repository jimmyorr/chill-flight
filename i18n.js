// --- LANGUAGE ---
// On-screen text in the player's language. English is written in the code
// as usual and is also the key: t('Settings') looks the English up in the
// language's table (locales/) and falls back to the English when there's no
// translation, so a missed string shows in English rather than breaking.
//
// {name}-style placeholders are filled from `vars` after translating, so a
// translation can move them: t('{n} of {total} unlocked', {n, total}).
//
// The language: ?lang= (en, zh), else the Settings choice, else the
// browser's. Static text in index.html is translated once at load
// (translateDom); text the game sets later goes through t() where it's set.
import ZH_CN from './locales/zh-CN.js';

const STORAGE_KEY = 'chill_flight_language';

// Language code → its table. English needs none.
const TABLES = {'zh-CN': ZH_CN};
export const LANGUAGES = ['en', 'zh-CN'];

// 'zh', 'zh-Hans', 'zh-TW'... → zh-CN (the only Chinese so far: Simplified
// reads fine for most Traditional readers, better than English)
function known(code) {
  if (!code) return null;
  const c = String(code).toLowerCase();
  if (c === 'en' || c.startsWith('en-')) return 'en';
  if (c === 'zh' || c.startsWith('zh-') || c.startsWith('zh_')) return 'zh-CN';
  return null;
}

function browserLanguage() {
  if (typeof navigator === 'undefined') return 'en';
  const list = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  // The first language we have, in the browser's order of preference
  for (const code of list) {
    const lang = known(code);
    if (lang) return lang;
  }
  return 'en';
}

// The Settings choice: 'auto' (the browser's) or a language code
function savedChoice() {
  try {
    return known(localStorage.getItem(STORAGE_KEY)) || 'auto';
  } catch {
    return 'auto';
  }
}

function loadLanguage() {
  const param =
    typeof location !== 'undefined'
      ? new URLSearchParams(location.search).get('lang')
      : null;
  return known(param) || known(savedChoice()) || browserLanguage();
}

export const LANG = loadLanguage();
const table = TABLES[LANG] || null;

function fill(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

// The English `text` in the player's language, with {placeholders} filled
export function t(text, vars) {
  if (text == null) return text;
  return fill((table && table[text]) || text, vars);
}

// Whether the language writes without spaces between words
export const NO_SPACES = LANG === 'zh-CN';

// "Ray", "Ray and Doug", "Ray, Doug and Bonnie" (Chinese: 雷、道格和邦妮)
export function joinList(items) {
  if (items.length <= 1) return items[0] ?? '';
  const sep = t(', ');
  return t('{list} and {last}', {
    list: items.slice(0, -1).join(sep),
    last: items.at(-1),
  });
}

// --- index.html ---
// Text nodes and the title, aria-label and placeholder attributes whose
// whole text (whitespace collapsed) is a key. Skips anything marked
// data-no-translate (the debug panels, language names).
const ATTRS = ['title', 'aria-label', 'placeholder'];

export function translateDom(root) {
  if (!table || !root) return;
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node.nodeType === 1) {
          if (
            node.hasAttribute('data-no-translate') ||
            node.tagName === 'SCRIPT' ||
            node.tagName === 'STYLE'
          )
            return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );
  for (let node = walker.currentNode; node; node = walker.nextNode()) {
    if (node.nodeType === 3) {
      const raw = node.nodeValue;
      const key = raw.replace(/\s+/g, ' ').trim();
      if (key && table[key]) {
        const lead = raw.match(/^\s*/)[0] ? ' ' : '';
        const trail = raw.match(/\s*$/)[0] ? ' ' : '';
        node.nodeValue = lead + table[key] + trail;
      }
    } else if (node.nodeType === 1) {
      for (const attr of ATTRS) {
        const value = node.getAttribute(attr);
        if (value && table[value]) node.setAttribute(attr, table[value]);
      }
    }
  }
}

if (typeof document !== 'undefined') {
  // Lets the browser pick Simplified Chinese glyphs (not Japanese ones) and
  // style.css switch fonts
  document.documentElement.lang = LANG;
  translateDom(document.body);

  // Settings' language select. Text is set as the game loads, so a change
  // saves the choice and reloads (dropping ?lang=, which would override it).
  const select = document.getElementById('language-select');
  if (select) {
    select.value = savedChoice();
    select.addEventListener('change', () => {
      try {
        localStorage.setItem(STORAGE_KEY, select.value);
      } catch {
        // Without storage the browser's language stays
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('lang');
      window.location.assign(url.toString());
    });
  }
}
