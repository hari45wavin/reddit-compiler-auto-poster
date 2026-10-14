/**
 * Background Service Worker for Reddit Code Poster
 * 
 * 1. Synchronizes active Reddit profile username (u/Icy_Witness7296).
 * 2. Redirects any generic /submit URLs to user's profile with the dynamic title.
 * 3. Handles OPEN_REDDIT_TAB message from compiler floating buttons, passing code body instead of URL.
 * 4. Extracts complete editor code via MAIN world (Monaco, Ace, CodeMirror).
 */

const DEFAULT_SETTINGS = {
  username: 'Icy_Witness7296'
};

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['settings']);
  let settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});

  try {
    const session = await getRedditSession();
    if (session && session.username) {
      settings.username = session.username;
    }
  } catch (e) {}

  await chrome.storage.local.set({ settings });
});

async function getRedditSession() {
  try {
    const res = await fetch('https://www.reddit.com/api/me.json', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data && data.data) ? { username: data.data.name } : null;
  } catch (e) {
    return null;
  }
}

function formatSolutionMarkdown(code, sourceUrl) {
  if (!code || typeof code !== 'string') return '';
  let lang = 'cpp';
  const urlLower = (sourceUrl || '').toLowerCase();
  if (urlLower.includes('python') || urlLower.includes('.py')) lang = 'python';
  else if (urlLower.includes('java')) lang = 'java';
  else if (urlLower.includes('javascript') || urlLower.includes('js')) lang = 'javascript';
  else if (urlLower.includes('c-') || urlLower.includes('/c/')) lang = 'c';
  else if (urlLower.includes('leetcode.com')) {
    if (code.includes('def ') || code.includes('class Solution:\n')) lang = 'python';
    else if (code.includes('public int') || (code.includes('class Solution {') && code.includes('System.out'))) lang = 'java';
    else if (code.includes('var ') || code.includes('const ') || code.includes('function ')) lang = 'javascript';
  }

  let md = `### 💻 Solution Code:\n\n\`\`\`${lang}\n${code.trim()}\n\`\`\`\n\n`;
  if (sourceUrl) {
    md += `---\n🔗 **Problem / Source**: ${sourceUrl}\n`;
  }
  return md;
}

// Redirect generic reddit submit URLs opened by compilers to personal profile
const redirectedTabs = new Set();

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) return;
  const url = tab.url;

  const isGenericSubmit = (url.includes('reddit.com/submit') || url.includes('sh.reddit.com/submit')) &&
    !url.includes('/user/') && !url.includes('/r/');

  if (isGenericSubmit && !redirectedTabs.has(tabId)) {
    redirectedTabs.add(tabId);
    setTimeout(() => redirectedTabs.delete(tabId), 8000);

    const data = await chrome.storage.local.get(['settings', 'activeTitle', 'activeCode', 'compilerUrl', 'activeBodyText']);
    const username = (data.settings && data.settings.username) || 'Icy_Witness7296';
    const dynamicTitle = data.activeTitle || '';

    // Capture compiler URL from query parameter if opened by compiler native share button
    try {
      const parsed = new URL(url);
      const urlParam = parsed.searchParams.get('url');
      if (urlParam && !urlParam.includes('reddit.com')) {
        await chrome.storage.local.set({ compilerUrl: urlParam });
      }
    } catch (e) {}

    // Remove any url= parameter to avoid triggering Reddit's "Link" submission tab
    let newUrl = url.replace(/reddit\.com\/submit/, `reddit.com/user/${username}/submit`).replace(/sh\.reddit\.com\/submit/, `sh.reddit.com/user/${username}/submit`);
    newUrl = newUrl.replace(/([?&])url=[^&]*/g, '$1').replace(/\?&/, '?').replace(/&&/, '&').replace(/[?&]$/, '');

    if (dynamicTitle) {
      if (newUrl.includes('title=')) {
        newUrl = newUrl.replace(/title=[^&]*/, `title=${encodeURIComponent(dynamicTitle)}`);
      } else {
        const sep = newUrl.includes('?') ? '&' : '?';
        newUrl = `${newUrl}${sep}title=${encodeURIComponent(dynamicTitle)}`;
      }
    }

    console.log('[Reddit Poster] Redirecting to user profile submit:', newUrl);
    chrome.tabs.update(tabId, { url: newUrl });
  }
});

// Runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SESSION') {
    (async () => {
      const session = await getRedditSession();
      if (session && session.username) {
        const { settings = {} } = await chrome.storage.local.get(['settings']);
        settings.username = session.username;
        await chrome.storage.local.set({ settings });
      }
      sendResponse({ session });
    })();
    return true;
  }

  if (message.type === 'OPEN_REDDIT_TAB') {
    (async () => {
      const { settings = {}, activeTitle = '', activeCode = '' } = await chrome.storage.local.get(['settings', 'activeTitle', 'activeCode']);
      const username = settings.username || 'Icy_Witness7296';
      const title = message.title || activeTitle || '';
      const code = message.code || activeCode || '';
      const compilerUrl = message.url || '';

      const bodyMd = formatSolutionMarkdown(code, compilerUrl);

      // Store in storage so content/reddit.js can access and inject into the post body
      await chrome.storage.local.set({
        activeTitle: title,
        activeCode: code,
        activeBodyText: bodyMd,
        compilerUrl: compilerUrl,
        lastUpdated: Date.now()
      });

      let targetUrl = `https://www.reddit.com/user/${username}/submit`;
      if (title) {
        targetUrl += `?title=${encodeURIComponent(title)}`;
      }

      console.log('[Reddit Poster] Opening Reddit Submit Tab:', targetUrl);
      const newTab = await chrome.tabs.create({ url: targetUrl });
      sendResponse({ success: true, tabId: newTab.id });
    })();
    return true;
  }

  // Extract complete code directly from editor instance in MAIN world
  if (message.type === 'GET_EDITOR_CODE_MAIN') {
    const tabId = sender.tab ? sender.tab.id : null;
    if (!tabId) {
      sendResponse({ success: false, code: '' });
      return true;
    }

    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        try {
          // 1. Monaco Editor (LeetCode, Replit)
          if (window.monaco && window.monaco.editor) {
            const models = window.monaco.editor.getModels();
            if (models && models.length > 0) {
              const val = models[0].getValue();
              if (val && val.trim().length > 0) {
                return { code: val, source: 'monaco.models' };
              }
            }
          }

          // 2. Ace Editor (Programiz, OnlineGDB)
          const aceEls = document.querySelectorAll('.ace_editor');
          for (const el of aceEls) {
            if (el.env && el.env.editor) {
              const val = el.env.editor.getValue();
              if (val && val.trim().length > 0) {
                return { code: val, source: 'ace.env.editor' };
              }
            }
            if (window.ace && typeof window.ace.edit === 'function') {
              const ed = window.ace.edit(el);
              if (ed) {
                const val = ed.getValue();
                if (val && val.trim().length > 0) {
                  return { code: val, source: 'window.ace.edit' };
                }
              }
            }
          }

          // 3. CodeMirror (v5 and v6)
          const cmEl = document.querySelector('.CodeMirror');
          if (cmEl && cmEl.CodeMirror) {
            const val = cmEl.CodeMirror.getValue();
            if (val && val.trim().length > 0) {
              return { code: val, source: 'CodeMirror' };
            }
          }

          // 4. Global editor
          if (window.editor && typeof window.editor.getValue === 'function') {
            const val = window.editor.getValue();
            if (val && val.trim().length > 0) {
              return { code: val, source: 'window.editor' };
            }
          }

          return { code: '', source: 'none' };
        } catch (err) {
          return { code: '', error: err.toString() };
        }
      }
    }).then(results => {
      const res = (results && results[0] && results[0].result) || {};
      sendResponse({ success: !!(res.code), code: res.code || '' });
    }).catch(err => {
      sendResponse({ success: false, code: '' });
    });

    return true;
  }

  if (message.type === 'INJECT_EDITOR_CODE') {
    const tabId = sender.tab ? sender.tab.id : null;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab id' });
      return true;
    }

    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (codeToInject) => {
        try {
          let injected = false;
          let method = '';

          // 1. Ace Editor (Programiz, OnlineGDB)
          const aceEls = document.querySelectorAll('.ace_editor');
          for (const el of aceEls) {
            if (el.env && el.env.editor) {
              el.env.editor.setValue(codeToInject, -1);
              el.env.editor.clearSelection();
              injected = true;
              method = 'ace.env.editor';
              break;
            }
            if (window.ace && typeof window.ace.edit === 'function') {
              const ed = window.ace.edit(el);
              if (ed) {
                ed.setValue(codeToInject, -1);
                ed.clearSelection();
                injected = true;
                method = 'window.ace.edit';
                break;
              }
            }
          }

          // 2. Monaco Editor (LeetCode, Replit)
          if (!injected && window.monaco && window.monaco.editor) {
            const models = window.monaco.editor.getModels();
            if (models && models.length > 0) {
              models[0].setValue(codeToInject);
              injected = true;
              method = 'monaco.models';
            }
          }

          // 3. CodeMirror (v5 and v6)
          if (!injected) {
            const cmEl = document.querySelector('.CodeMirror');
            if (cmEl && cmEl.CodeMirror) {
              cmEl.CodeMirror.setValue(codeToInject);
              injected = true;
              method = 'CodeMirror';
            }
          }

          // 4. Global editor
          if (!injected && window.editor && typeof window.editor.setValue === 'function') {
            window.editor.setValue(codeToInject, -1);
            injected = true;
            method = 'window.editor';
          }

          // 5. Programiz: also sync to localStorage
          if (window.location.hostname.includes('programiz.com')) {
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('pg:autosave:v1:')) {
                  localStorage.setItem(k, JSON.stringify({ c: codeToInject, t: Date.now() }));
                }
              }
            } catch (e) {}
          }

          return { success: injected, method };
        } catch (err) {
          return { success: false, error: err.toString() };
        }
      },
      args: [message.code]
    }).then(results => {
      sendResponse(results && results[0] ? results[0].result : { success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err.toString() });
    });

    return true;
  }
});
