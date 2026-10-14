/**
 * Content Script for Reddit Submit Page
 * 
 * 1. ONLY runs on actual submission pages (never on /submitted, /saved, or profiles).
 * 2. Automatically sets the community to the user's profile (u/Icy_Witness7296).
 * 3. Pierces all Lit/Shreddit Shadow Roots (faceplate-textarea-input, shreddit-composer).
 * 4. Fills the dynamic comment title AND formats the complete solution code into the post body!
 * 5. Leaves the native Reddit "Post" button ready for the user to click.
 */

(function () {
  if (window.__rcap_reddit_active) return;
  window.__rcap_reddit_active = true;

  let dynamicTitle = '';
  let targetUser = 'Icy_Witness7296';
  let activeCode = '';
  let compilerUrl = '';
  let watcherInterval = null;

  function isActualSubmitPage() {
    const path = window.location.pathname.toLowerCase();
    // NEVER match /submitted or /submitted/ or /saved or /comments
    if (path.includes('/submitted')) return false;
    // Must be an actual submit composer URL
    return path.endsWith('/submit') || path.includes('/submit/') || path.includes('/submit?');
  }

  // Run on load and listen for SPA URL changes
  init();

  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      if (isActualSubmitPage()) {
        init();
      } else {
        const pill = document.getElementById('rcap-reddit-pill');
        if (pill) pill.remove();
        if (watcherInterval) clearInterval(watcherInterval);
      }
    }
  }, 500);

  async function init() {
    if (!isActualSubmitPage()) {
      const pill = document.getElementById('rcap-reddit-pill');
      if (pill) pill.remove();
      if (watcherInterval) clearInterval(watcherInterval);
      return;
    }

    // Load stored settings, title, code, and compiler URL
    const data = await chrome.storage.local.get(['settings', 'activeTitle', 'activeCode', 'compilerUrl', 'activeBodyText']);
    const settings = data.settings || {};
    targetUser = settings.username || 'Icy_Witness7296';
    dynamicTitle = data.activeTitle || '';
    activeCode = data.activeCode || '';
    compilerUrl = data.compilerUrl || '';

    // If activeTitle wasn't saved, try to extract from code
    if (!dynamicTitle && activeCode) {
      dynamicTitle = extractCommentFromCode(activeCode);
    }

    // Check URL title param as fallback (only if not default Programiz text)
    const urlParams = new URLSearchParams(window.location.search);
    const paramTitle = urlParams.get('title');
    if (!dynamicTitle && paramTitle && !paramTitle.includes('wrote this program') && !paramTitle.includes('Programiz')) {
      dynamicTitle = paramTitle;
    }

    // 1. If on generic /submit without /user/ or /r/, redirect to user profile submit page
    if (window.location.pathname === '/submit' && !window.location.href.includes('/user/') && !window.location.href.includes('/r/')) {
      let search = window.location.search;
      if (dynamicTitle) {
        if (search.includes('title=')) {
          search = search.replace(/title=[^&]*/, `title=${encodeURIComponent(dynamicTitle)}`);
        } else {
          search += (search ? '&' : '?') + `title=${encodeURIComponent(dynamicTitle)}`;
        }
      }
      window.location.replace(`https://www.reddit.com/user/${targetUser}/submit${search}`);
      return;
    }

    // 2. Render floating cute pill on Reddit
    ensureRedditStyles();
    renderFloatingPill();

    // 3. Start community check, dynamic title, and body code injection loop
    startAutomationLoop();
  }

  function cleanTitle(raw) {
    if (!raw || typeof raw !== 'string') return '';
    let cleaned = raw
      .replace(/^[\s\t]*(\/\/|#|--|%|\/\*|\*|\*\/|<!--|-->|"""|''')+[\s\t]*/g, '')
      .replace(/[\s\t]*(\*\/|-->|"""|''')+[\s\t]*$/g, '')
      .replace(/^(title|problem|task|program|solution|question)[\s\t]*:[\s\t]*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (/^(author|date|file|license|copyright)[\s\t]*:/i.test(cleaned)) return '';
    if (cleaned.length > 295) cleaned = cleaned.substring(0, 292) + '...';
    return cleaned;
  }

  function extractCommentFromCode(code) {
    if (!code || typeof code !== 'string') return '';
    const lines = code.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line || line.startsWith('#!')) continue;

      const singleMatch = line.match(/^(\/\/|#|--|%)\s*(.+)$/);
      if (singleMatch && singleMatch[2]) {
        if (!line.startsWith('#include') && !line.startsWith('#define') && !line.startsWith('#pragma') && !line.startsWith('#ifdef')) {
          const cleaned = cleanTitle(singleMatch[2]);
          if (cleaned) return cleaned;
        }
      }

      const docMatch = line.match(/^("""|''')\s*(.+?)(?:"""|''')?$/);
      if (docMatch && docMatch[2]) {
        const cleaned = cleanTitle(docMatch[2]);
        if (cleaned) return cleaned;
      }

      if (line === '/*' || line === '/**' || line === '<!--') {
        for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
          let nextLine = lines[j].trim();
          if (!nextLine || nextLine === '*/' || nextLine === '-->') continue;
          const cleaned = cleanTitle(nextLine.replace(/^[\s\t]*\*+[\s\t]*/, ''));
          if (cleaned) return cleaned;
        }
      }

      if (line.startsWith('*')) {
        const cleaned = cleanTitle(line.replace(/^\*+\s*/, ''));
        if (cleaned) return cleaned;
      }

      if (line.startsWith('#include') || line.startsWith('#define') || line.startsWith('#pragma')) break;
      if (!line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*') &&
          !line.startsWith('#') && !line.startsWith('--') && !line.startsWith('%') &&
          !line.startsWith('"""') && !line.startsWith("'''") && !line.startsWith('<!--')) {
        break;
      }
    }
    return '';
  }

  // --- Deep Shadow DOM Traversal ---
  function getAllElementsDeep(root = document) {
    const elements = [];
    function walk(node) {
      if (!node) return;
      if (node.nodeType === Node.ELEMENT_NODE) {
        elements.push(node);
        if (node.shadowRoot) {
          walk(node.shadowRoot);
        }
      }
      const children = node.children || node.childNodes || [];
      for (let i = 0; i < children.length; i++) {
        if (children[i].nodeType === Node.ELEMENT_NODE) {
          walk(children[i]);
        }
      }
    }
    walk(root);
    return elements;
  }

  // --- Find Reddit Title Input ---
  function findTitleInputElements() {
    const candidates = [];
    const directQueries = [
      'shreddit-title textarea',
      'shreddit-title input',
      'faceplate-textarea-input[name="title"] textarea',
      'textarea[name="title"]',
      'input[name="title"]',
      'textarea[placeholder*="Title" i]',
      'input[placeholder*="Title" i]',
      'div[contenteditable="true"][name="title"]'
    ];

    for (const q of directQueries) {
      try {
        const found = document.querySelectorAll(q);
        for (const el of found) {
          if (!candidates.includes(el)) candidates.push(el);
        }
      } catch (e) {}
    }

    // Pierce shadow root of shreddit-title / faceplate-textarea-input
    const shredditTitle = document.querySelector('shreddit-title, faceplate-textarea-input[name="title"]');
    if (shredditTitle && shredditTitle.shadowRoot) {
      const innerInput = shredditTitle.shadowRoot.querySelector('textarea, input, [contenteditable="true"]');
      if (innerInput && !candidates.includes(innerInput)) {
        candidates.unshift(innerInput);
      }
    }

    if (candidates.length > 0) {
      return candidates;
    }

    // Fallback: deep walk only if fast path found nothing
    const all = getAllElementsDeep(document);
    for (const el of all) {
      const tag = (el.tagName || '').toLowerCase();
      const name = (el.getAttribute('name') || el.name || '').toLowerCase();
      const placeholder = (el.getAttribute('placeholder') || el.placeholder || '').toLowerCase();
      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      const val = (el.value || el.innerText || el.textContent || '').trim();

      const isTitleCandidate =
        name === 'title' ||
        placeholder.includes('title') ||
        ariaLabel.includes('title') ||
        id.includes('title') ||
        tag === 'faceplate-textarea-input' ||
        tag === 'shreddit-title' ||
        val.includes('Programiz') ||
        val.includes('wrote this program');

      if (isTitleCandidate && !candidates.includes(el)) {
        candidates.push(el);
      }
    }

    return candidates;
  }

  function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- Find Real Reddit Body Editable Elements (Strictly excluding outer containers) ---
  function findBodyInputElements() {
    const candidates = [];

    function isTitleElement(el) {
      if (!el) return false;
      const name = (el.getAttribute('name') || el.name || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      const placeholder = (el.getAttribute('placeholder') || el.placeholder || '').toLowerCase();
      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
      return name === 'title' || id.includes('title') || placeholder.includes('title') || ariaLabel.includes('title');
    }

    // 1. Direct query selectors for modern Reddit Lexical, DraftJS, and textareas
    const directSelectors = [
      'div[data-lexical-editor="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]:not([name="title"])',
      'faceplate-textarea-input[name="text"] textarea',
      'textarea[name="text"]',
      'div[aria-label*="Body"]',
      '.public-DraftEditor-content'
    ];

    for (const sel of directSelectors) {
      try {
        const found = document.querySelectorAll(sel);
        for (const el of found) {
          if (!isTitleElement(el) && !candidates.includes(el)) {
            candidates.push(el);
          }
        }
      } catch (e) {}
    }

    // Pierce shreddit-composer shadow root directly
    const composer = document.querySelector('shreddit-composer');
    if (composer && composer.shadowRoot) {
      const insideLexical = composer.shadowRoot.querySelectorAll('div[data-lexical-editor="true"], div[contenteditable="true"], textarea[name="text"]');
      for (const el of insideLexical) {
        if (!isTitleElement(el) && !candidates.includes(el)) {
          candidates.unshift(el);
        }
      }
    }

    // If fast path found candidates, return immediately without expensive full-DOM recursive walk!
    if (candidates.length > 0) {
      return candidates;
    }

    // 2. Fallback: Deep Shadow DOM traversal for actual editable elements
    const all = getAllElementsDeep(document);
    for (const el of all) {
      const tag = (el.tagName || '').toLowerCase();
      // NEVER allow outer container elements
      if (tag === 'shreddit-composer' || tag === 'form' || tag === 'body' || tag === 'main' || tag === 'reddit-header-large') {
        continue;
      }

      const isEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.name === 'text');
      if (!isEditable) continue;
      if (isTitleElement(el)) continue;

      const name = (el.getAttribute('name') || el.name || '').toLowerCase();
      const placeholder = (el.getAttribute('placeholder') || el.placeholder || '').toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const isLexical = el.getAttribute('data-lexical-editor') === 'true' || el.classList?.contains('public-DraftEditor-content');

      if (isLexical || name === 'text' || placeholder.includes('body') || placeholder.includes('text') || aria.includes('body') || aria.includes('text') || el.getAttribute('role') === 'textbox') {
        if (!candidates.includes(el)) {
          candidates.push(el);
        }
      }
    }

    return candidates;
  }

  // --- Set Value on Body Input Preserving Newlines & Verifying Success Without Double-Pasting ---
  function setBodyContent(target, text) {
    if (!target || !text) return false;

    let inner = target;
    if (target.shadowRoot) {
      const inside = target.shadowRoot.querySelector('textarea, [contenteditable="true"]');
      if (inside) inner = inside;
    }

    // Check if this editor already contains the content or link to prevent ANY duplicate injection
    const existingVal = (inner.value !== undefined ? inner.value : (inner.innerText || inner.textContent || '')).trim();
    if (
      (compilerUrl && existingVal.includes(compilerUrl)) ||
      (activeCode && activeCode.length > 15 && existingVal.includes(activeCode.slice(0, 30).trim())) ||
      (existingVal.includes('Problem / Code Link') && existingVal.length > 40)
    ) {
      return true; // Already populated!
    }

    try { target.focus(); } catch (e) {}
    try { inner.focus(); } catch (e) {}

    // 1. Textarea
    if (inner instanceof HTMLTextAreaElement || inner.tagName === 'TEXTAREA') {
      try {
        const proto = HTMLTextAreaElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if (descriptor && descriptor.set) {
          descriptor.set.call(inner, text);
        } else {
          inner.value = text;
        }
      } catch (e) {
        inner.value = text;
      }
      inner.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      inner.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      const current = (inner.value || '').trim();
      return current.length > 5;
    }

    // 2. Contenteditable (Lexical / Draft.js on modern Reddit)
    const editable = (inner.isContentEditable ? inner : (target.isContentEditable ? target : null));
    if (editable) {
      editable.focus();

      // Select all node contents so the insertion cleanly replaces any placeholder
      try {
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(editable);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch (e) {}

      // Method A: Insert formatted HTML with paragraphs (creates real Lexical nodes)
      const lines = text.split('\n');
      const html = lines.map(l => `<p>${escapeHtml(l) || '<br>'}</p>`).join('');

      try {
        document.execCommand('insertHTML', false, html);
      } catch (e) {}

      editable.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      editable.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

      // Check if insertHTML successfully populated the editor
      let cur = (editable.innerText || editable.textContent || '').trim();
      if (cur.length > 5 && cur !== 'Body text (optional)') {
        try { window.getSelection()?.removeAllRanges(); } catch (e) {}
        return true;
      }

      // Method B: Fallback ONLY if insertHTML did not populate anything
      try {
        document.execCommand('insertText', false, text);
      } catch (e) {}

      editable.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      editable.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

      cur = (editable.innerText || editable.textContent || '').trim();
      if (cur.length > 5 && cur !== 'Body text (optional)') {
        try { window.getSelection()?.removeAllRanges(); } catch (e) {}
        return true;
      }

      // Method C: Last resort direct assignment
      try {
        editable.innerText = text;
      } catch (e) {}
      editable.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      editable.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

      try { window.getSelection()?.removeAllRanges(); } catch (e) {}

      const finalVal = (editable.innerText || editable.textContent || '').trim();
      return finalVal.length > 5 && finalVal !== 'Body text (optional)';
    }

    return false;
  }

  // --- Apply Solution Code & Link to Body ---
  let hasInjectedBody = false;

  function applySolutionBody() {
    if (hasInjectedBody) return true;

    // If storage was delayed, fetch fresh from local storage
    if ((!activeCode || activeCode.trim().length < 5) && !compilerUrl) {
      chrome.storage.local.get(['activeTitle', 'activeCode', 'compilerUrl', 'activeBodyText'], (d) => {
        if (d) {
          if (d.activeCode) activeCode = d.activeCode;
          if (d.compilerUrl) compilerUrl = d.compilerUrl;
          if (d.activeBodyText) activeBodyText = d.activeBodyText;
          if (d.activeTitle && !dynamicTitle) dynamicTitle = d.activeTitle;
        }
      });
      return false;
    }

    const bodyFields = findBodyInputElements();
    if (!bodyFields || bodyFields.length === 0) return false;

    // Fast check: is any candidate field already populated with our code or link?
    for (const field of bodyFields) {
      const cur = (field.value !== undefined ? field.value : (field.innerText || field.textContent || '')).trim();
      if (
        (compilerUrl && cur.includes(compilerUrl)) ||
        (activeCode && activeCode.length > 15 && cur.includes(activeCode.slice(0, 30).trim())) ||
        (cur.includes('Problem / Code Link') && cur.length > 40)
      ) {
        hasInjectedBody = true;
        return true;
      }
    }

    let formatted = '';
    if (activeCode && activeCode.trim().length > 0) {
      formatted = formatSolutionMarkdown(activeCode, compilerUrl, dynamicTitle);
    } else if (compilerUrl) {
      formatted = formatSolutionMarkdown('', compilerUrl, dynamicTitle);
    }

    if (!formatted || formatted.trim().length < 5) {
      return false;
    }

    // Inject into the primary active field
    for (const field of bodyFields) {
      const ok = setBodyContent(field, formatted);
      if (ok) {
        const cur = (field.value !== undefined ? field.value : (field.innerText || field.textContent || '')).trim();
        if (cur.length > 5 && cur !== 'Body text (optional)') {
          hasInjectedBody = true;
          console.log('[Reddit Poster] Successfully injected solution code and link into post body!');
          updateFloatingPill(true);
          return true;
        }
      }
    }
    return false;
  }

  function formatSolutionMarkdown(code, sourceUrl, title) {
    let out = '';
    if (title && title.length > 2 && !/^\d+$/.test(title)) {
      out += `### 💡 ${title}\n\n`;
    }

    if (code && code.trim().length > 0) {
      let lang = 'cpp';
      const sUrl = (sourceUrl || '').toLowerCase();
      if (sUrl.includes('python') || sUrl.includes('.py')) lang = 'python';
      else if (sUrl.includes('java')) lang = 'java';
      else if (sUrl.includes('javascript') || sUrl.includes('js')) lang = 'javascript';
      else if (sUrl.includes('c-') || sUrl.includes('/c/')) lang = 'c';
      else if (sUrl.includes('leetcode.com')) {
        if (code.includes('def ') || code.includes('class Solution:\n')) lang = 'python';
        else if (code.includes('public int') || (code.includes('class Solution {') && code.includes('System.out'))) lang = 'java';
        else if (code.includes('var ') || code.includes('const ') || code.includes('function ')) lang = 'javascript';
      }

      out += `\`\`\`${lang}\n${code.trim()}\n\`\`\`\n\n`;
    }

    if (sourceUrl) {
      out += `---\n🔗 **Problem / Code Link**: ${sourceUrl}\n`;
    }
    return out;
  }

  // --- Set Value on Title Input ---
  function setTitleContent(target, text) {
    if (!target || !text) return false;
    let inner = target;
    if (target.shadowRoot) {
      const inside = target.shadowRoot.querySelector('textarea, input, [contenteditable="true"]');
      if (inside) inner = inside;
    }
    try { target.focus(); } catch (e) {}
    try { inner.focus(); } catch (e) {}

    if (inner instanceof HTMLInputElement || inner instanceof HTMLTextAreaElement) {
      const proto = inner instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(inner, text);
      } else {
        inner.value = text;
      }
      inner.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      inner.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      return (inner.value || '').trim() === text.trim();
    }

    if (inner.isContentEditable) {
      inner.innerText = text;
      inner.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      inner.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      return (inner.innerText || '').trim() === text.trim();
    }

    try {
      target.value = text;
      target.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      target.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    } catch (e) {}

    return true;
  }

  // --- Apply Dynamic Title to Title Fields ---
  function applyDynamicTitle() {
    if (!dynamicTitle) return false;

    const fields = findTitleInputElements();
    let applied = false;

    for (const field of fields) {
      const val = (field.value || field.innerText || field.textContent || '').trim();

      if (val === dynamicTitle) {
        applied = true;
        continue;
      }

      const success = setTitleContent(field, dynamicTitle);
      if (success) {
        applied = true;
        console.log('[Reddit Poster] Replaced title with dynamic comment:', dynamicTitle);
      }
    }

    if (applied) {
      updateFloatingPill(true);
    }

    return applied;
  }

  // --- Ensure Community is Selected (Optimized for instant check) ---
  function checkAndSelectCommunity() {
    if (window.location.href.toLowerCase().includes(`/user/${targetUser.toLowerCase()}`)) {
      return true;
    }

    const commBtn = document.querySelector('button[aria-label*="community" i], shreddit-community-select button, shreddit-community-select');
    if (commBtn) {
      const text = (commBtn.innerText || commBtn.textContent || '').toLowerCase();
      if (text.includes('select community') || text.includes('choose a community')) {
        commBtn.click();

        setTimeout(() => {
          const freshElements = getAllElementsDeep(document);
          const option = freshElements.find(item => {
            const t = (item.innerText || item.textContent || '').toLowerCase();
            return t.includes('your profile') || t.includes(targetUser.toLowerCase());
          });

          if (option) {
            option.click();
            setTimeout(applyDynamicTitle, 60);
            setTimeout(applySolutionBody, 80);
          }
        }, 80);

        return false;
      }
      return true;
    }

    const all = getAllElementsDeep(document);
    for (const el of all) {
      const text = (el.innerText || el.textContent || '').toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();

      if ((el.tagName === 'BUTTON' || el.tagName === 'SHREDDIT-COMMUNITY-SELECT') &&
          (text.includes('select community') || text.includes('choose a community') || aria.includes('community'))) {
        
        el.click();

        setTimeout(() => {
          const freshElements = getAllElementsDeep(document);
          const option = freshElements.find(item => {
            const t = (item.innerText || item.textContent || '').toLowerCase();
            return t.includes('your profile') || t.includes(targetUser.toLowerCase());
          });

          if (option) {
            option.click();
            setTimeout(applyDynamicTitle, 60);
            setTimeout(applySolutionBody, 80);
          }
        }, 80);

        return false;
      }
    }

    return true;
  }

  // --- Automation Loop (Instant 0ms start + 120ms responsive polling + early termination only when truly verified) ---
  function startAutomationLoop() {
    if (watcherInterval) {
      clearInterval(watcherInterval);
      watcherInterval = null;
    }

    let attempts = 0;

    function runPass() {
      if (!isActualSubmitPage()) {
        if (watcherInterval) {
          clearInterval(watcherInterval);
          watcherInterval = null;
        }
        return;
      }

      attempts++;
      const commOk = checkAndSelectCommunity();
      const titleOk = applyDynamicTitle();
      const bodyOk = applySolutionBody();

      // Only stop once community, title, AND body are all truly verified!
      if (commOk && titleOk && bodyOk && hasInjectedBody) {
        console.log('[Reddit Poster] All post fields verified populated! Stopping watcher loop.');
        if (watcherInterval) {
          clearInterval(watcherInterval);
          watcherInterval = null;
        }
        return;
      }

      // Allow up to 35 attempts (~4.2 seconds) to give async Lexical web components ample time to mount
      if (attempts >= 35) {
        if (watcherInterval) {
          clearInterval(watcherInterval);
          watcherInterval = null;
        }
      }
    }

    // Run first pass immediately
    runPass();

    // Fast 120ms interval for responsive reactivity without lag
    watcherInterval = setInterval(runPass, 120);
  }

  // --- Floating Cute Pill on Reddit UI ---
  function ensureRedditStyles() {
    if (document.getElementById('rcap-reddit-injected-style')) return;
    const style = document.createElement('style');
    style.id = 'rcap-reddit-injected-style';
    style.textContent = `
      .rcap-reddit-floating-pill {
        position: fixed !important;
        bottom: 24px !important;
        right: 24px !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        background: linear-gradient(145deg, rgba(32, 22, 48, 0.94) 0%, rgba(18, 14, 28, 0.96) 100%) !important;
        backdrop-filter: blur(20px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
        border: 1.5px solid rgba(255, 117, 143, 0.45) !important;
        border-radius: 9999px !important;
        padding: 8px 16px !important;
        box-shadow: 0 10px 32px rgba(15, 8, 25, 0.75), 0 0 20px rgba(255, 117, 143, 0.3) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Plus Jakarta Sans", sans-serif !important;
        color: #FFFFFF !important;
        font-size: 12px !important;
        user-select: none !important;
        animation: rcapFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
        box-sizing: border-box !important;
        transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      }
      .rcap-reddit-badge {
        background: linear-gradient(135deg, #FF5D8F 0%, #FF758F 100%) !important;
        color: #FFFFFF !important;
        padding: 4px 10px !important;
        border-radius: 9999px !important;
        font-weight: 800 !important;
        font-size: 11px !important;
        letter-spacing: 0.3px !important;
        white-space: nowrap !important;
        box-shadow: 0 2px 8px rgba(255, 93, 143, 0.4) !important;
      }
      .rcap-reddit-title-text {
        font-weight: 600 !important;
        color: #FFE5EC !important;
        max-width: 260px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        font-size: 12px !important;
      }
      .rcap-reddit-status {
        font-size: 11px !important;
        font-weight: 800 !important;
        padding: 3px 8px !important;
        border-radius: 9999px !important;
        white-space: nowrap !important;
      }
      .rcap-status-ready {
        background: rgba(6, 214, 160, 0.2) !important;
        color: #06D6A0 !important;
        border: 1px solid rgba(6, 214, 160, 0.4) !important;
      }
      .rcap-status-pending {
        background: rgba(255, 117, 143, 0.2) !important;
        color: #FF758F !important;
        border: 1px solid rgba(255, 117, 143, 0.4) !important;
      }
      .rcap-reapply-btn {
        background: linear-gradient(135deg, #9D4EDD 0%, #7B2CBF 100%) !important;
        border: none !important;
        color: #FFFFFF !important;
        padding: 5px 12px !important;
        border-radius: 9999px !important;
        font-size: 11px !important;
        font-weight: 800 !important;
        cursor: pointer !important;
        transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
        white-space: nowrap !important;
        box-shadow: 0 2px 8px rgba(157, 78, 221, 0.4) !important;
      }
      .rcap-reapply-btn:hover {
        transform: scale(1.08) !important;
        background: linear-gradient(135deg, #B565F5 0%, #8E36D9 100%) !important;
      }
      @keyframes rcapFadeIn {
        from { opacity: 0; transform: translateY(12px) scale(0.92); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function renderFloatingPill() {
    if (document.getElementById('rcap-reddit-pill')) return;

    const pill = document.createElement('div');
    pill.id = 'rcap-reddit-pill';
    pill.className = 'rcap-reddit-floating-pill';

    const displayTitle = dynamicTitle || 'Scanning title...';

    pill.innerHTML = `
      <span class="rcap-reddit-badge">💖 u/${targetUser}</span>
      <span class="rcap-reddit-title-text" id="rcap-pill-text">✨ "${displayTitle}"</span>
      <span class="rcap-reddit-status rcap-status-pending" id="rcap-pill-status">🌸 Setting Title...</span>
      <button class="rcap-reapply-btn" id="rcap-pill-apply" title="Click to re-apply the dynamic title">Reapply ↻</button>
    `;

    (document.body || document.documentElement).appendChild(pill);

    document.getElementById('rcap-pill-apply')?.addEventListener('click', () => {
      hasInjectedBody = false;
      const bodyFields = findBodyInputElements();
      for (const f of bodyFields) {
        f.__rcap_pasted = false;
      }
      applyDynamicTitle();
      applySolutionBody();
      startAutomationLoop();
    });
  }

  function updateFloatingPill(isApplied) {
    const textEl = document.getElementById('rcap-pill-text');
    const statusEl = document.getElementById('rcap-pill-status');

    if (textEl && dynamicTitle) {
      textEl.textContent = `✨ "${dynamicTitle}"`;
    }

    if (statusEl) {
      if (isApplied) {
        statusEl.textContent = '✨ Ready to Post! 🎀';
        statusEl.className = 'rcap-reddit-status rcap-status-ready';
      } else {
        statusEl.textContent = '🌸 Setting Title...';
        statusEl.className = 'rcap-reddit-status rcap-status-pending';
      }
    }
  }

})();
