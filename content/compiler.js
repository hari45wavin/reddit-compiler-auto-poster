/**
 * Content Script for Online Compilers & Coding Platforms
 * (Programiz, LeetCode, OnlineGDB, Replit, CodeChef, HackerRank, etc.)
 * 
 * 1. Compact Cute Anime Reddit Icon (minimal screen space).
 * 2. Dynamic Expandable Toolbar (Horizontal or Vertical orientation).
 * 3. Hotkeys:
 *    - Ctrl + Alt + R : Toggle expansion
 *    - 1 : Share to Reddit (with solution code & auto-save)
 *    - 2 : Save to Vault (keeps last 3 saves)
 *    - 3 : Load / Open Code Vault (3-slot history + snippets)
 *    - 4 / Esc / [✕] : Close/minimize back to cute anime icon
 *    - Arrow keys : Navigate between options
 * 4. Safe Typing Guard: Hotkeys 1-4 never interfere with code editor typing.
 * 5. Full LeetCode & Compiler Solution Extraction via MAIN world (Monaco/Ace).
 */

(function () {
  if (window.__rcap_compiler_active) return;
  window.__rcap_compiler_active = true;

  // --- 1. Strict Platform Validation ---
  function isEligibleCodingPlatform() {
    const host = window.location.hostname.toLowerCase();

    const excluded = [
      'google.com',
      'gemini.google.com',
      'chatgpt.com',
      'openai.com',
      'claude.ai',
      'youtube.com',
      'facebook.com',
      'instagram.com',
      'twitter.com',
      'x.com',
      'linkedin.com',
      'netflix.com',
      'amazon.com',
      'reddit.com',
      'wikipedia.org',
      'yahoo.com',
      'bing.com',
      'duckduckgo.com',
      'notion.so',
      'github.com'
    ];

    if (excluded.some(d => host === d || host.endsWith('.' + d))) {
      return false;
    }

    const knownCodingDomains = [
      'programiz.com',
      'leetcode.com',
      'onlinegdb.com',
      'replit.com',
      'codechef.com',
      'hackerrank.com',
      'codepen.io',
      'jsfiddle.net',
      'ideone.com',
      'godbolt.org',
      'onecompiler.com',
      'codesandbox.io',
      'stackblitz.com',
      'geeksforgeeks.org',
      'w3schools.com',
      'tutorialspoint.com',
      'interviewbit.com',
      'spoj.com'
    ];

    const isKnown = knownCodingDomains.some(d => host === d || host.endsWith('.' + d)) ||
      /(compiler|online-ide|code-editor|playground)/i.test(host);

    if (isKnown) return true;

    const hasRealEditor = !!document.querySelector('.monaco-editor, .ace_editor, .CodeMirror, .cm-content, #editor');
    return hasRealEditor;
  }

  if (!isEligibleCodingPlatform()) {
    return;
  }

  const HISTORY_KEY = `saved_history_${window.location.origin}${window.location.pathname}`;
  const ORIENTATION_KEY = 'rcap_orientation_pref';

  // Starter Code Snippets
  const CODE_SNIPPETS = {
    cpp: `// Problem: Solution Title
#include <iostream>
#include <vector>
#include <string>

using namespace std;

int main() {
    // Write your code here
    cout << "Hello, World!" << endl;
    return 0;
}`,
    python: `# Problem: Solution Title

def solve():
    # Write your solution here
    print("Hello, World!")

if __name__ == "__main__":
    solve()`,
    java: `// Problem: Solution Title
import java.util.*;

public class Main {
    public static void main(String[] args) {
        // Write your solution here
        System.out.println("Hello, World!");
    }
}`,
    javascript: `// Problem: Solution Title

function solve() {
    // Write your solution here
    console.log("Hello, World!");
}

solve();`
  };

  // --- 2. Dynamic Title Extraction ---
  function cleanTitle(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let cleaned = raw
      .replace(/^[\s\t]*(\/\/|#|--|%|\/\*|\*|\*\/|<!--|-->|"""|''')+[\s\t]*/g, '')
      .replace(/[\s\t]*(\*\/|-->|"""|''')+[\s\t]*$/g, '')
      .replace(/^(title|problem|task|program|solution|question)[\s\t]*:[\s\t]*/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (/^(author|date|file|license|copyright)[\s\t]*:/i.test(cleaned)) {
      return '';
    }

    // Reject pure numbers (e.g. "0") or very short strings
    if (cleaned.length < 3 || /^\d+$/.test(cleaned)) {
      return '';
    }

    if (cleaned.length > 295) {
      cleaned = cleaned.substring(0, 292) + '...';
    }
    return cleaned;
  }

  function extractDynamicFirstComment(code) {
    if (!code || typeof code !== 'string') return '';
    const lines = code.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line || line.startsWith('#!')) continue;

      // Single line comments: //, #, --, %
      const singleMatch = line.match(/^(\/\/|#|--|%)\s*(.+)$/);
      if (singleMatch && singleMatch[2]) {
        if (!line.startsWith('#include') && !line.startsWith('#define') && !line.startsWith('#pragma') && !line.startsWith('#ifdef')) {
          const cleaned = cleanTitle(singleMatch[2]);
          if (cleaned) return cleaned;
        }
      }

      // Python triple-quote docstrings: """ ... """ or ''' ... '''
      const docMatch = line.match(/^("""|''')\s*(.+?)(?:"""|''')?$/);
      if (docMatch && docMatch[2]) {
        const cleaned = cleanTitle(docMatch[2]);
        if (cleaned) return cleaned;
      }

      if (line === '"""' || line === "'''") {
        for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
          let nextLine = lines[j].trim();
          if (!nextLine || nextLine === '"""' || nextLine === "'''") continue;
          const cleaned = cleanTitle(nextLine.replace(/("""|''')/g, ''));
          if (cleaned) return cleaned;
        }
      }

      // Inline block comments: /* ... */ or <!-- ... -->
      const blockMatch = line.match(/^(?:\/\*|<!--)\s*(.+?)(?:\*\/|-->)?$/);
      if (blockMatch && blockMatch[1]) {
        const cleaned = cleanTitle(blockMatch[1]);
        if (cleaned) return cleaned;
      }

      // Multiline block comment opening: /* or /** alone
      if (line === '/*' || line === '/**' || line === '<!--') {
        for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
          let nextLine = lines[j].trim();
          if (!nextLine || nextLine === '*/' || nextLine === '-->') continue;
          nextLine = nextLine.replace(/^[\s\t]*\*+[\s\t]*/, '').replace(/\*\/$/, '').trim();
          const cleaned = cleanTitle(nextLine);
          if (cleaned) return cleaned;
        }
      }

      // Line inside multiline comment starting with *
      if (line.startsWith('*')) {
        const cleaned = cleanTitle(line.replace(/^\*+\s*/, ''));
        if (cleaned) return cleaned;
      }

      // Stop scanning once real code is reached
      if (line.startsWith('#include') || line.startsWith('#define') || line.startsWith('#pragma')) break;
      if (!line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*') &&
          !line.startsWith('#') && !line.startsWith('--') && !line.startsWith('%') &&
          !line.startsWith('"""') && !line.startsWith("'''") && !line.startsWith('<!--')) {
        break;
      }
    }

    // LeetCode fallback: problem title from document.title or URL slug
    if (window.location.hostname.includes('leetcode.com')) {
      // 1. From document.title: e.g. "125. Valid Palindrome - LeetCode"
      const docT = (document.title || '').replace(/\s*-\s*LeetCode.*$/i, '').trim();
      if (docT && docT.length > 2 && !/^\d+$/.test(docT) && !docT.toLowerCase().includes('problems')) {
        const cleaned = cleanTitle(docT);
        if (cleaned) return cleaned;
      }

      // 2. From URL pathname: e.g. /problems/valid-palindrome/description/
      const match = window.location.pathname.match(/\/problems\/([^/]+)/);
      if (match && match[1]) {
        const slug = match[1].replace(/[-_]+/g, ' ').trim();
        const formatted = slug.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        if (formatted && formatted.length > 2) {
          return `${formatted} Solution`;
        }
      }

      // 3. Question title element
      const qTitle = document.querySelector('[data-cy="question-title"]');
      if (qTitle && qTitle.innerText) {
        const cleaned = cleanTitle(qTitle.innerText);
        if (cleaned) return cleaned;
      }
    }

    return '';
  }

  // --- 3. Synchronous & Asynchronous Code Extraction ---
  function getCodeFromDOM() {
    // 1. Monaco Editor lines (LeetCode, Replit)
    const monacoEl = document.querySelector('.monaco-editor');
    if (monacoEl) {
      const lines = Array.from(monacoEl.querySelectorAll('.view-lines .view-line'));
      if (lines.length > 0) {
        const text = lines.map(l => l.textContent || '').join('\n');
        if (text.trim().length > 5) return text;
      }
    }

    // 2. Ace Editor (Programiz, OnlineGDB)
    const aceLines = Array.from(document.querySelectorAll('.ace_line'));
    if (aceLines.length > 0) {
      const text = aceLines.map(l => l.textContent || '').join('\n');
      if (text.trim().length > 5) return text;
    }

    const textLayer = document.querySelector('.ace_text-layer');
    if (textLayer && textLayer.innerText && textLayer.innerText.trim().length > 5) {
      return textLayer.innerText;
    }

    // 3. CodeMirror (v5 & v6)
    const cmContent = document.querySelector('.cm-content, .CodeMirror-code');
    if (cmContent) {
      const cmLines = Array.from(cmContent.querySelectorAll('.cm-line, .CodeMirror-line'));
      if (cmLines.length > 0) {
        const text = cmLines.map(l => l.textContent || '').join('\n');
        if (text.trim().length > 5) return text;
      }
      if (cmContent.innerText && cmContent.innerText.trim().length > 5) {
        return cmContent.innerText;
      }
    }

    // 4. Textarea inside code editor container or any code textarea
    const codeArea = document.querySelector('.ace_text-input, [class*="code"] textarea, [id*="editor"] textarea');
    if (codeArea && codeArea.value && codeArea.value.trim().length > 5) {
      return codeArea.value;
    }

    const allTextareas = Array.from(document.querySelectorAll('textarea'));
    for (const ta of allTextareas) {
      const val = (ta.value || '').trim();
      if (val.length > 10) {
        if (/[\{\}\(\);=<>]|def |function |#include|import |class |print|console|cout/i.test(val)) {
          return val;
        }
      }
    }

    // 5. Pre / Code tags on documentation or lightweight online IDEs
    const preCodes = Array.from(document.querySelectorAll('pre code, .editor-code, #code, [class*="code-editor"]'));
    for (const pc of preCodes) {
      const val = (pc.innerText || '').trim();
      if (val.length > 10) {
        if (/[\{\}\(\);=<>]|def |function |#include|import |class |print|console|cout/i.test(val)) {
          return val;
        }
      }
    }

    // 6. Programiz localStorage cache
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('pg:autosave') || k.includes('code') || k.includes('editor'))) {
          try {
            const item = JSON.parse(localStorage.getItem(k));
            if (item && item.c && typeof item.c === 'string' && item.c.length > 5) {
              return item.c;
            }
            if (typeof item === 'string' && item.length > 5) {
              return item;
            }
          } catch (e) {
            const raw = localStorage.getItem(k);
            if (raw && raw.length > 5) return raw;
          }
        }
      }
    } catch (e) {}

    return '';
  }

  // Get complete code using MAIN-world model extraction (handles virtual scrolling on LeetCode)
  async function getFullEditorCodeAsync() {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_EDITOR_CODE_MAIN' }, (res) => {
          if (chrome.runtime.lastError) {
            resolve(null);
          } else {
            resolve(res);
          }
        });
      });

      if (response && response.success && response.code && response.code.trim().length > 5) {
        return response.code;
      }
    } catch (e) {}

    return getCodeFromDOM();
  }

  // Auto-sync code state continuously so it is ready for Reddit whether shared via our icon or compiler button
  async function syncActiveCodeState() {
    const code = await getFullEditorCodeAsync();
    if (!code || code.trim().length < 5) return;
    let title = extractDynamicFirstComment(code);
    if (!title || title.length < 3 || /^\d+$/.test(title)) {
      if (window.location.hostname.includes('leetcode.com')) {
        const match = window.location.pathname.match(/\/problems\/([^/]+)/);
        if (match && match[1]) {
          title = match[1].replace(/[-_]+/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Solution';
        }
      }
      if (!title || title.length < 3) {
        title = `${detectLanguage().toUpperCase()} Code Solution`;
      }
    }

    chrome.storage.local.set({
      activeCode: code,
      activeTitle: title,
      compilerUrl: window.location.href,
      lastUpdated: Date.now()
    });
  }

  // Listen for clicks on ANY native share button on the website (e.g. Programiz's Share button)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, a, [role="button"]');
    if (btn) {
      const txt = (btn.innerText || btn.textContent || '').toLowerCase();
      if (txt.includes('share') || (btn.id && btn.id.includes('share')) || (btn.className && typeof btn.className === 'string' && btn.className.includes('share'))) {
        syncActiveCodeState();
      }
    }
  }, true);

  // --- 4. Setting Code in Editor ---
  function setEditorCode(newCode) {
    if (!newCode || typeof newCode !== 'string') return;

    chrome.runtime.sendMessage({
      type: 'INJECT_EDITOR_CODE',
      code: newCode
    }, (res) => {
      console.log('[Reddit Poster] Code injection result:', res);
    });

    if (window.location.hostname.includes('programiz.com')) {
      try {
        const lang = detectLanguage();
        localStorage.setItem(`pg:autosave:v1:${lang}`, JSON.stringify({ c: newCode, t: Date.now() }));
      } catch (e) {}

      const restoreNoticeBtn = document.querySelector('.autosave-notice__btn');
      if (restoreNoticeBtn) restoreNoticeBtn.click();
    }

    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      if (ta.className.includes('ace_text-input') || ta.id.includes('code') || ta.id.includes('editor')) {
        ta.value = newCode;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    setTimeout(updatePreviewFromEditor, 350);
  }

  function detectLanguage() {
    const text = (window.location.href + ' ' + document.title).toLowerCase();
    if (text.includes('python') || text.includes('.py')) return 'python';
    if (text.includes('cpp') || text.includes('c++')) return 'cpp';
    if (text.includes('java') && !text.includes('javascript')) return 'java';
    if (text.includes('javascript') || text.includes('js')) return 'javascript';
    if (text.includes('c-') || text.includes('/c/')) return 'c';
    return 'cpp';
  }

  // --- 5. 3-Slot Saved Code Vault ---
  async function saveCurrentCodeToHistory(callback) {
    const code = await getFullEditorCodeAsync();
    if (!code || code.trim().length < 5) {
      if (callback) callback(false, 'No code found in editor to save');
      return;
    }

    let dynamicTitle = extractDynamicFirstComment(code);
    if (!dynamicTitle) {
      dynamicTitle = 'Untitled Code';
    }

    const lineCount = code.split(/\r?\n/).length;
    const now = new Date();
    const dateStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newEntry = {
      id: Date.now(),
      code: code,
      title: dynamicTitle,
      lines: lineCount,
      timestamp: Date.now(),
      dateStr: dateStr
    };

    chrome.storage.local.get([HISTORY_KEY], (data) => {
      let history = data[HISTORY_KEY] || [];
      if (!Array.isArray(history)) history = [];

      // Remove duplicate if identical code was saved
      history = history.filter(item => item.code.trim() !== code.trim());

      // Prepend newest save
      history.unshift(newEntry);

      // Keep only last 3 saves
      if (history.length > 3) {
        history = history.slice(0, 3);
      }

      chrome.storage.local.set({
        [HISTORY_KEY]: history,
        activeCode: code,
        activeTitle: dynamicTitle,
        compilerUrl: window.location.href,
        lastUpdated: Date.now()
      }, () => {
        updateFloatingButtonPreview(dynamicTitle);
        refreshSavedHistoryUI();
        if (callback) callback(true, newEntry, history.length, code);
      });
    });
  }

  function updatePreviewFromEditor() {
    const code = getCodeFromDOM();
    const title = extractDynamicFirstComment(code);
    updateFloatingButtonPreview(title);
  }

  function updateFloatingButtonPreview(dynamicTitle) {
    const previewEl = document.getElementById('rcap-btn-preview');
    if (!previewEl) return;
    if (dynamicTitle) {
      previewEl.textContent = `✨ "${dynamicTitle}"`;
    } else {
      previewEl.textContent = '✨ (Add // or # comment on line 1)';
    }
  }

  // Cute bubbly toast notification
  function showToast(message) {
    const existing = document.getElementById('rcap-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'rcap-toast';
    toast.className = 'rcap-toast';
    toast.textContent = message;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
  }

  // --- 6. Cute Anime SVG Icon ---
  const CUTE_ANIME_REDDIT_SVG = `
    <svg viewBox="0 0 100 100" class="rcap-anime-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="rcapGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FF9EBB" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#7B2CBF" stop-opacity="0.2"/>
        </radialGradient>
        <linearGradient id="rcapEarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FF5D8F"/>
          <stop offset="100%" stop-color="#FF758F"/>
        </linearGradient>
      </defs>
      <!-- Sparkle halo -->
      <circle cx="50" cy="50" r="48" fill="url(#rcapGlow)" />
      
      <!-- Anime Cat / Snoo Ears -->
      <polygon points="26,38 18,16 38,24" fill="url(#rcapEarGrad)" stroke="#FFFFFF" stroke-width="2"/>
      <polygon points="28,34 22,20 36,25" fill="#FFE5EC"/>
      <polygon points="74,38 82,16 62,24" fill="url(#rcapEarGrad)" stroke="#FFFFFF" stroke-width="2"/>
      <polygon points="72,34 78,20 64,25" fill="#FFE5EC"/>

      <!-- Antenna with Glowing Star -->
      <path d="M50 26 Q 52 14 62 10" stroke="#FF758F" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <circle cx="63" cy="9" r="6" fill="#FFD166" stroke="#FFFFFF" stroke-width="1.5"/>
      <polygon points="63,4 64.5,8 68,9 64.5,10 63,14 61.5,10 58,9 61.5,8" fill="#FFFBEA"/>

      <!-- Head Base -->
      <ellipse cx="50" cy="55" rx="36" ry="30" fill="#FFFFFF" stroke="#FF758F" stroke-width="3"/>

      <!-- Kawaii Big Anime Eyes -->
      <!-- Left Eye -->
      <ellipse cx="38" cy="52" rx="7" ry="9" fill="#2B193D"/>
      <circle cx="36" cy="48" r="3.2" fill="#FFFFFF"/>
      <circle cx="41" cy="55" r="1.5" fill="#FFFFFF"/>
      <!-- Right Eye -->
      <ellipse cx="62" cy="52" rx="7" ry="9" fill="#2B193D"/>
      <circle cx="60" cy="48" r="3.2" fill="#FFFFFF"/>
      <circle cx="65" cy="55" r="1.5" fill="#FFFFFF"/>

      <!-- Blush Cheeks -->
      <ellipse cx="28" cy="61" rx="5" ry="3" fill="#FF8FA3" opacity="0.85"/>
      <ellipse cx="72" cy="61" rx="5" ry="3" fill="#FF8FA3" opacity="0.85"/>

      <!-- Cute Anime Cat Mouth -->
      <path d="M44 60 Q 47 64 50 60 Q 53 64 56 60" stroke="#FF477E" stroke-width="2.5" fill="none" stroke-linecap="round"/>

      <!-- Little Sparkles -->
      <text x="12" y="32" font-size="12" fill="#FFD166">✦</text>
      <text x="78" y="76" font-size="11" fill="#C77DFF">✨</text>
    </svg>
  `;

  // --- 7. State Management for Expansion & Orientation ---
  let isExpanded = false;
  let currentOrientation = window.location.hostname.includes('leetcode.com') ? 'vertical' : 'horizontal';
  let focusedOptionIndex = 0; // 0: Share, 1: Save, 2: Vault, 3: Close
  let selectedSnippetLang = 'cpp';

  // --- 8. Floating Widget Assembly ---
  function renderFloatingToolbar() {
    if (document.getElementById('rcap-compiler-widget')) return;
    if (!isEligibleCodingPlatform()) return;

    selectedSnippetLang = detectLanguage();

    // Check saved orientation preference
    chrome.storage.local.get([ORIENTATION_KEY], (res) => {
      if (res && res[ORIENTATION_KEY]) {
        currentOrientation = res[ORIENTATION_KEY];
      }
      applyOrientationClass();
    });

    const widget = document.createElement('div');
    widget.id = 'rcap-compiler-widget';
    widget.className = `rcap-compiler-widget ${isExpanded ? 'rcap-is-expanded' : 'rcap-is-collapsed'}`;
    widget.setAttribute('tabindex', '-1');

    widget.innerHTML = `
      <!-- Code Vault Popup Modal -->
      <div id="rcap-load-modal" class="rcap-load-modal hidden">
        <div class="rcap-modal-header">
          <div class="rcap-modal-title-wrap">
            <span>✨ Code Vault ✨</span>
            <span class="rcap-slots-badge" id="rcap-slots-badge">🌸 0/3 Saved</span>
          </div>
          <button class="rcap-modal-close-btn" id="rcap-modal-close" title="Close">✕</button>
        </div>

        <div class="rcap-modal-body">
          <button class="rcap-btn-save-current" id="rcap-btn-save-current" title="Save current code to vault (keeps last 3 saves)">
            💖 Save Current Code to Vault
          </button>

          <div class="rcap-section-header">⚡ Saved History (Last 3)</div>
          <div class="rcap-history-list" id="rcap-history-list">
            <div class="rcap-history-empty">Loading saved codes...</div>
          </div>

          <div class="rcap-section-header" style="margin-top: 10px;">🎀 Starter Snippets</div>
          <div class="rcap-snippet-section">
            <div class="rcap-lang-chips">
              <button class="rcap-lang-chip ${selectedSnippetLang === 'cpp' ? 'active' : ''}" data-lang="cpp">C++ ⚡</button>
              <button class="rcap-lang-chip ${selectedSnippetLang === 'python' ? 'active' : ''}" data-lang="python">Python 🐍</button>
              <button class="rcap-lang-chip ${selectedSnippetLang === 'java' ? 'active' : ''}" data-lang="java">Java ☕</button>
              <button class="rcap-lang-chip ${selectedSnippetLang === 'javascript' ? 'active' : ''}" data-lang="javascript">JS 💛</button>
            </div>
            <div class="rcap-snippet-code-box" id="rcap-snippet-preview"></div>
            <button class="rcap-btn-insert" id="rcap-btn-insert">Insert Snippet 🌸</button>
          </div>
        </div>
      </div>

      <!-- 🌸 Cute Anime Reddit Icon (Collapsed Button) 🌸 -->
      <button id="rcap-anime-btn" class="rcap-anime-btn" title="✨ Reddit Code Poster (Ctrl+Alt+R to toggle)">
        <div class="rcap-anime-svg-wrap">
          ${CUTE_ANIME_REDDIT_SVG}
        </div>
        <span class="rcap-anime-badge">Ctrl+Alt+R</span>
      </button>

      <!-- 🌸 Translucent Minimized Toolbar 🌸 -->
      <div id="rcap-expanded-bar" class="rcap-expanded-bar">
        <!-- Main Actions Row -->
        <div class="rcap-actions-container" id="rcap-actions-container">
          <!-- Button 1: Share -->
          <button class="rcap-action-btn rcap-btn-share" id="rcap-btn-share" data-index="0" title="Share full solution to Reddit (Hotkey: 1)">
            <span class="rcap-num-tag">1</span>
            <span class="rcap-btn-label">✨ Share</span>
          </button>

          <!-- Button 2: Save -->
          <button class="rcap-action-btn rcap-btn-save-trigger" id="rcap-btn-save-trigger" data-index="1" title="Save code to vault (Hotkey: 2)">
            <span class="rcap-num-tag">2</span>
            <span class="rcap-btn-label">💖 Save</span>
          </button>

          <!-- Button 3: Vault / Load -->
          <button class="rcap-action-btn rcap-btn-load-trigger" id="rcap-btn-load-trigger" data-index="2" title="Code Vault (Hotkey: 3)">
            <span class="rcap-num-tag">3</span>
            <span class="rcap-btn-label">📂 Vault</span>
          </button>

          <!-- Mini Controls: Orientation Switcher & Close -->
          <div class="rcap-mini-controls">
            <button class="rcap-toggle-orientation-btn" id="rcap-orientation-toggle" title="Switch Orientation (Horizontal/Vertical)">⇄</button>
            <button class="rcap-close-btn" id="rcap-close-btn" data-index="3" title="Close / Minimize (Press 4 or Esc)">✕</button>
          </div>
        </div>

        <!-- Detected Title Preview (Slim Pill) -->
        <div class="rcap-detected-preview" id="rcap-btn-preview" title="Dynamic Comment Title">
          ✨ Scanning title...
        </div>
      </div>
    `;

    (document.body || document.documentElement).appendChild(widget);

    // Apply orientation class
    applyOrientationClass();

    // Wire Event Handlers
    wireWidgetEvents();
  }

  function applyOrientationClass() {
    const widget = document.getElementById('rcap-compiler-widget');
    if (!widget) return;
    widget.classList.remove('rcap-orientation-horizontal', 'rcap-orientation-vertical');
    widget.classList.add(`rcap-orientation-${currentOrientation}`);
  }

  function toggleOrientation() {
    currentOrientation = currentOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    chrome.storage.local.set({ [ORIENTATION_KEY]: currentOrientation });
    applyOrientationClass();
    showToast(`🎀 Switched to ${currentOrientation} view! ✨`);
  }

  function expandToolbar() {
    isExpanded = true;
    const widget = document.getElementById('rcap-compiler-widget');
    if (widget) {
      widget.classList.remove('rcap-is-collapsed');
      widget.classList.add('rcap-is-expanded');
      widget.focus();
    }
    updatePreviewFromEditor();
    updateKeyboardFocusHighlight();
  }

  function collapseToolbar() {
    isExpanded = false;
    const widget = document.getElementById('rcap-compiler-widget');
    if (widget) {
      widget.classList.remove('rcap-is-expanded');
      widget.classList.add('rcap-is-collapsed');
    }
    const modal = document.getElementById('rcap-load-modal');
    if (modal) modal.classList.add('hidden');
  }

  function toggleExpansion() {
    if (isExpanded) {
      collapseToolbar();
    } else {
      expandToolbar();
    }
  }

  // --- 9. Wire Widget Events ---
  function wireWidgetEvents() {
    const animeBtn = document.getElementById('rcap-anime-btn');
    const closeBtn = document.getElementById('rcap-close-btn');
    const orientBtn = document.getElementById('rcap-orientation-toggle');
    const shareBtn = document.getElementById('rcap-btn-share');
    const saveTrigger = document.getElementById('rcap-btn-save-trigger');
    const loadTrigger = document.getElementById('rcap-btn-load-trigger');
    const modal = document.getElementById('rcap-load-modal');
    const modalClose = document.getElementById('rcap-modal-close');
    const saveCurrentBtn = document.getElementById('rcap-btn-save-current');
    const btnInsertSnippet = document.getElementById('rcap-btn-insert');
    const snippetPreview = document.getElementById('rcap-snippet-preview');

    // Click anime button to expand
    animeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      expandToolbar();
    });

    // Close button (✕)
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      collapseToolbar();
    });

    // Orientation toggle (⇄)
    orientBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleOrientation();
    });

    // Share button
    shareBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerShareAction();
    });

    // Save button
    saveTrigger?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerSaveAction();
    });

    // Vault / Load trigger
    loadTrigger?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerVaultToggle();
    });

    modalClose?.addEventListener('click', () => {
      modal?.classList.add('hidden');
    });

    saveCurrentBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      triggerSaveAction();
    });

    // Snippets Preview update
    function updateSnippetBox() {
      if (snippetPreview) {
        snippetPreview.textContent = CODE_SNIPPETS[selectedSnippetLang] || '';
      }
    }
    updateSnippetBox();

    // Language chips
    const chips = document.querySelectorAll('.rcap-lang-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedSnippetLang = chip.getAttribute('data-lang') || 'cpp';
        updateSnippetBox();
      });
    });

    // Insert snippet
    btnInsertSnippet?.addEventListener('click', () => {
      const snippet = CODE_SNIPPETS[selectedSnippetLang];
      if (snippet) {
        setEditorCode(snippet);
        showToast(`🎀 Loaded ${selectedSnippetLang.toUpperCase()} snippet! ✨`);
        modal?.classList.add('hidden');
      }
    });

    // Close modal on click outside
    document.addEventListener('click', (e) => {
      const widget = document.getElementById('rcap-compiler-widget');
      if (widget && !widget.contains(e.target)) {
        if (modal && !modal.classList.contains('hidden')) {
          modal.classList.add('hidden');
        }
      }
    });

    updatePreviewFromEditor();
    refreshSavedHistoryUI();
  }

  // --- 10. Actions Triggered via UI & Hotkeys ---
  async function triggerShareAction() {
    const shareBtn = document.getElementById('rcap-btn-share');
    const label = shareBtn?.querySelector('.rcap-btn-label');
    if (label) label.textContent = '✨ Saving...';

    saveCurrentCodeToHistory(async (success, entry, total, savedCode) => {
      const code = savedCode || await getFullEditorCodeAsync();
      let title = extractDynamicFirstComment(code) || (entry && entry.title) || '';

      // Fallback guarantee: Never empty, never "0", never purely digits
      if (!title || title.length < 3 || /^\d+$/.test(title)) {
        if (window.location.hostname.includes('leetcode.com')) {
          const match = window.location.pathname.match(/\/problems\/([^/]+)/);
          if (match && match[1]) {
            title = match[1].replace(/[-_]+/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Solution';
          }
        }
        if (!title || title.length < 3) {
          title = `${detectLanguage().toUpperCase()} Code Solution`;
        }
      }

      chrome.runtime.sendMessage({
        type: 'OPEN_REDDIT_TAB',
        title: title,
        code: code,
        url: window.location.href
      }, () => {
        setTimeout(() => {
          if (label) label.textContent = '✨ Share';
        }, 1500);
      });
    });
  }

  function triggerSaveAction() {
    saveCurrentCodeToHistory((success, entry, total) => {
      if (success) {
        showToast(`✨ Code saved to vault! (${total}/3) 💖`);
      } else {
        showToast('⚠️ No code in editor to save');
      }
    });
  }

  function triggerVaultToggle() {
    const modal = document.getElementById('rcap-load-modal');
    if (!modal) return;
    const isHidden = modal.classList.contains('hidden');
    if (isHidden) {
      modal.classList.remove('hidden');
      refreshSavedHistoryUI();
    } else {
      modal.classList.add('hidden');
    }
  }

  // --- 11. Keyboard Navigation & Hotkeys ---
  function isUserTypingInEditor() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return true;
    if (active.isContentEditable) return true;
    if (active.closest('.monaco-editor, .ace_editor, .CodeMirror, .cm-editor, [role="textbox"]')) return true;
    return false;
  }

  function updateKeyboardFocusHighlight() {
    const buttons = document.querySelectorAll('.rcap-actions-container .rcap-action-btn, #rcap-close-btn');
    buttons.forEach((btn, idx) => {
      if (idx === focusedOptionIndex && isExpanded) {
        btn.classList.add('rcap-kbd-focused');
      } else {
        btn.classList.remove('rcap-kbd-focused');
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    // 1. Hotkey Ctrl + Alt + R : Toggle expansion (ALWAYS available!)
    if (e.ctrlKey && e.altKey && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      toggleExpansion();
      return;
    }

    // 2. If toolbar is collapsed or user is actively typing in a code editor, DO NOT intercept keys!
    if (!isExpanded) return;
    if (isUserTypingInEditor()) return;

    // 3. Number Keys: 1, 2, 3, 4
    if (e.key === '1') {
      e.preventDefault();
      focusedOptionIndex = 0;
      updateKeyboardFocusHighlight();
      triggerShareAction();
      return;
    }

    if (e.key === '2') {
      e.preventDefault();
      focusedOptionIndex = 1;
      updateKeyboardFocusHighlight();
      triggerSaveAction();
      return;
    }

    if (e.key === '3') {
      e.preventDefault();
      focusedOptionIndex = 2;
      updateKeyboardFocusHighlight();
      triggerVaultToggle();
      return;
    }

    if (e.key === '4' || e.key === 'Escape') {
      e.preventDefault();
      collapseToolbar();
      return;
    }

    // 4. Arrow Keys for Navigation
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusedOptionIndex = (focusedOptionIndex + 1) % 4;
      updateKeyboardFocusHighlight();
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusedOptionIndex = (focusedOptionIndex - 1 + 4) % 4;
      updateKeyboardFocusHighlight();
      return;
    }

    // 5. Enter key triggers focused button
    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedOptionIndex === 0) triggerShareAction();
      else if (focusedOptionIndex === 1) triggerSaveAction();
      else if (focusedOptionIndex === 2) triggerVaultToggle();
      else if (focusedOptionIndex === 3) collapseToolbar();
      return;
    }
  }, true);

  // --- 12. Render Saved History in Vault Modal ---
  function refreshSavedHistoryUI() {
    const listEl = document.getElementById('rcap-history-list');
    const badgeEl = document.getElementById('rcap-slots-badge');
    if (!listEl) return;

    chrome.storage.local.get([HISTORY_KEY], (data) => {
      let history = data[HISTORY_KEY] || [];
      if (!Array.isArray(history)) history = [];

      if (badgeEl) {
        badgeEl.textContent = `🌸 ${history.length}/3 Saved`;
      }

      if (history.length === 0) {
        listEl.innerHTML = `
          <div class="rcap-history-empty">
            No code saved yet.<br>Click "💖 Save Current Code" above to store your code.
          </div>
        `;
        return;
      }

      listEl.innerHTML = '';
      history.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'rcap-history-card';
        card.innerHTML = `
          <div class="rcap-history-left">
            <span class="rcap-history-badge rcap-badge-${index + 1}">${index + 1}</span>
            <div class="rcap-history-info">
              <span class="rcap-history-title" title="${item.title}">"${item.title}"</span>
              <span class="rcap-history-meta">${item.lines} lines • ${item.dateStr || 'Saved'}</span>
            </div>
          </div>
          <button class="rcap-btn-load-item" data-index="${index}" title="Load this code into editor">
            Load ✨
          </button>
        `;

        card.querySelector('.rcap-btn-load-item')?.addEventListener('click', (e) => {
          e.stopPropagation();
          setEditorCode(item.code);
          showToast(`🌸 Loaded save #${index + 1}: "${item.title}" ✨`);
          document.getElementById('rcap-load-modal')?.classList.add('hidden');
        });

        listEl.appendChild(card);
      });
    });
  }

  // --- 13. Initialization & Real-Time Observer ---
  function init() {
    if (!isEligibleCodingPlatform()) return;

    renderFloatingToolbar();

    let count = 0;
    const checkTimer = setInterval(() => {
      count++;
      if (isEligibleCodingPlatform()) {
        renderFloatingToolbar();
        updatePreviewFromEditor();
      }
      if (count > 8) clearInterval(checkTimer);
    }, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('keyup', () => {
    if (isEligibleCodingPlatform()) setTimeout(updatePreviewFromEditor, 400);
  }, true);
  document.addEventListener('click', () => {
    if (isEligibleCodingPlatform()) setTimeout(updatePreviewFromEditor, 300);
  }, true);

})();
