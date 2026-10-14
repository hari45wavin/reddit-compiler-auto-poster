/**
 * Editor Detector utility for Reddit Code Poster
 * Locates, extracts, and injects code across popular online compilers (Programiz, OnlineGDB, LeetCode, etc.).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EditorDetector = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  /**
   * Attempts to extract code from the current page
   * @returns {{ found: boolean, code: string, type: string, language?: string }}
   */
  function extractCodeFromPage() {
    // Synchronously query page context for Ace or Monaco instance via inline script
    try {
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          try {
            // 1. Ace Editor (Programiz, OnlineGDB)
            const aceEl = document.querySelector('.ace_editor');
            if (aceEl) {
              if (aceEl.env && aceEl.env.editor) {
                document.documentElement.dataset.rcapCode = aceEl.env.editor.getValue() || '';
                return;
              }
              if (window.ace && typeof window.ace.edit === 'function') {
                const ed = window.ace.edit(aceEl);
                if (ed) {
                  document.documentElement.dataset.rcapCode = ed.getValue() || '';
                  return;
                }
              }
            }

            // 2. Monaco Editor (LeetCode, Replit, OneCompiler)
            if (window.monaco && window.monaco.editor) {
              const models = window.monaco.editor.getModels();
              if (models && models.length > 0) {
                document.documentElement.dataset.rcapCode = models[0].getValue() || '';
                return;
              }
            }

            // 3. CodeMirror
            const cmEl = document.querySelector('.CodeMirror');
            if (cmEl && cmEl.CodeMirror) {
              document.documentElement.dataset.rcapCode = cmEl.CodeMirror.getValue() || '';
              return;
            }
          } catch(e) {}
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();

      const extracted = document.documentElement.dataset.rcapCode;
      if (extracted && extracted.trim().length > 0) {
        return { found: true, code: extracted, type: 'page-instance' };
      }
    } catch (e) {
      console.warn('[Reddit Poster] Synchronous extraction error:', e);
    }

    // DOM fallback 1: Ace lines
    try {
      const aceEditorEl = document.querySelector('.ace_editor');
      if (aceEditorEl) {
        const lines = Array.from(aceEditorEl.querySelectorAll('.ace_line')).map(l => l.textContent || '');
        if (lines.length > 0) {
          const code = lines.join('\n');
          if (code.trim().length > 0) {
            return { found: true, code, type: 'ace-dom-lines' };
          }
        }
      }
    } catch (e) {}

    // DOM fallback 2: Monaco view lines
    try {
      const monacoEditorEl = document.querySelector('.monaco-editor');
      if (monacoEditorEl) {
        const viewLines = monacoEditorEl.querySelector('.view-lines');
        if (viewLines) {
          const lines = Array.from(viewLines.children).map(line => line.textContent || '');
          if (lines.length > 0) {
            const code = lines.join('\n');
            if (code.trim().length > 0) {
              return { found: true, code, type: 'monaco-dom-lines' };
            }
          }
        }
      }
    } catch (e) {}

    // DOM fallback 3: Textareas
    try {
      const textareas = Array.from(document.querySelectorAll('textarea'));
      const best = textareas.find(t => {
        const idClass = `${t.id} ${t.className} ${t.name}`.toLowerCase();
        return idClass.includes('code') || idClass.includes('editor') || idClass.includes('source');
      }) || textareas.find(t => t.value && t.value.trim().length > 20);

      if (best && best.value && best.value.trim().length > 0) {
        return { found: true, code: best.value, type: 'textarea' };
      }
    } catch (e) {}

    return { found: false, code: '', type: 'none' };
  }

  /**
   * Injects code back into the editor (for Auto-Restore)
   * @param {string} code 
   * @returns {boolean}
   */
  function setEditorCode(code) {
    if (!code || typeof code !== 'string') return false;

    try {
      // 1. Direct page-context injection
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          try {
            const newCode = ${JSON.stringify(code)};

            // Programiz / Ace Editor
            const aceEls = document.querySelectorAll('.ace_editor');
            for (const el of aceEls) {
              if (el.env && el.env.editor) {
                el.env.editor.setValue(newCode, -1);
                el.env.editor.clearSelection();
                return;
              }
              if (window.ace && typeof window.ace.edit === 'function') {
                const ed = window.ace.edit(el);
                if (ed) {
                  ed.setValue(newCode, -1);
                  ed.clearSelection();
                  return;
                }
              }
            }

            // Monaco Editor
            if (window.monaco && window.monaco.editor) {
              const models = window.monaco.editor.getModels();
              if (models && models.length > 0) {
                models[0].setValue(newCode);
                return;
              }
            }

            // CodeMirror
            const cmEl = document.querySelector('.CodeMirror');
            if (cmEl && cmEl.CodeMirror) {
              cmEl.CodeMirror.setValue(newCode);
              return;
            }
          } catch (e) {
            console.error('[Editor Restore Error]', e);
          }
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();

      // 2. Also check if Programiz's own 'Restore previous code' button exists and click it
      const restoreButtons = Array.from(document.querySelectorAll('button, a'));
      const programizRestore = restoreButtons.find(b => (b.innerText || '').toLowerCase().includes('restore previous code'));
      if (programizRestore) {
        programizRestore.click();
      }

      // 3. Update any underlying textarea
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        if (ta.className.includes('ace_text-input') || ta.id.includes('code') || ta.id.includes('editor')) {
          ta.value = code;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      return true;
    } catch (err) {
      console.error('[Reddit Poster] setEditorCode error:', err);
      return false;
    }
  }

  /**
   * Prepends a comment title to the code editor
   */
  function prependCommentTitle(title, language = '') {
    const { code } = extractCodeFromPage();
    let commentChar = '//';
    if (['python', 'ruby', 'perl', 'r', 'bash', 'shell'].includes(language.toLowerCase())) {
      commentChar = '#';
    } else if (['sql', 'lua', 'haskell'].includes(language.toLowerCase())) {
      commentChar = '--';
    }

    const commentLine = `${commentChar} ${title}\n`;
    if (code.startsWith(commentChar)) {
      const lines = code.split('\n');
      lines[0] = `${commentChar} ${title}`;
      setEditorCode(lines.join('\n'));
    } else {
      setEditorCode(commentLine + code);
    }
  }

  /**
   * Attempts to detect programming language from the page or URL
   */
  function detectLanguage() {
    const pageText = (document.title + ' ' + window.location.href).toLowerCase();
    if (pageText.includes('cpp') || pageText.includes('c++')) return 'cpp';
    if (pageText.includes('python') || pageText.includes('.py')) return 'python';
    if (pageText.includes('java') && !pageText.includes('javascript')) return 'java';
    if (pageText.includes('javascript') || pageText.includes('.js')) return 'javascript';
    if (pageText.includes('typescript') || pageText.includes('.ts')) return 'typescript';
    if (pageText.includes('csharp') || pageText.includes('c#')) return 'csharp';
    if (pageText.includes('golang') || pageText.includes('go')) return 'go';
    if (pageText.includes('rust')) return 'rust';
    if (pageText.includes('c-') || pageText.includes('gcc') || pageText.includes('/c/')) return 'c';
    return 'cpp';
  }

  return {
    extractCodeFromPage,
    setEditorCode,
    prependCommentTitle,
    detectLanguage
  };
});
