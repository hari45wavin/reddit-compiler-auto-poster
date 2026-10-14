/**
 * Comment Parser utility for Reddit Code Poster
 * Extracts or generates meaningful Reddit post titles from code.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CommentParser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  /**
   * Cleans a raw comment line to make it suitable as a Reddit post title
   * @param {string} rawText 
   * @returns {string}
   */
  function cleanCommentTitle(rawText) {
    if (!rawText) return '';

    let cleaned = rawText
      // Remove leading comment symbols
      .replace(/^[\s\t]*(\/\/|#|--|%|\/\*|\*|\*\/|<!--|-->)+[\s\t]*/g, '')
      // Remove trailing comment symbols
      .replace(/[\s\t]*(\*\/|-->)[\s\t]*$/g, '')
      .trim();

    // Remove common prefixes if they are just labels
    cleaned = cleaned.replace(/^(title|problem|program|name|task|solution)[\s\t]*:[\s\t]*/i, '');

    // Trim again
    cleaned = cleaned.trim();

    // Reddit max title length is 300 characters
    if (cleaned.length > 295) {
      cleaned = cleaned.substring(0, 292) + '...';
    }

    return cleaned;
  }

  /**
   * Derives a smart title from code by inspecting function or class names
   * @param {string} code 
   * @param {string} [language]
   * @returns {string}
   */
  function deriveTitleFromFunctions(code, language = '') {
    if (!code) return '';

    // Search for function definitions: void revString(...), def two_sum(...), function solve(...)
    const funcMatches = code.match(/(?:function|def|void|int|bool|string|double|float|auto)\s+([a-zA-Z0-9_]+)\s*\(/g);
    if (funcMatches && funcMatches.length > 0) {
      for (const m of funcMatches) {
        const nameMatch = m.match(/\s+([a-zA-Z0-9_]+)\s*\(/);
        if (nameMatch && nameMatch[1]) {
          const fnName = nameMatch[1];
          if (fnName !== 'main' && fnName !== 'printf' && fnName !== 'cout' && fnName !== 'print') {
            // Convert camelCase or snake_case to human words: revString -> Reverse String
            let human = fnName
              .replace(/([a-z])([A-Z])/g, '$1 $2')
              .replace(/_/g, ' ')
              .trim();
            // Capitalize first letters
            human = human.charAt(0).toUpperCase() + human.slice(1);
            const langPrefix = language ? `[${language.toUpperCase()}] ` : '';
            return `${langPrefix}${human} Implementation`;
          }
        }
      }
    }

    // Search for class names: class Solution, class LinkedList
    const classMatch = code.match(/class\s+([a-zA-Z0-9_]+)/);
    if (classMatch && classMatch[1] && classMatch[1] !== 'Main') {
      return `${classMatch[1]} Solution`;
    }

    return '';
  }

  /**
   * Extracts the first comment from source code or generates a smart title
   * @param {string} code - The source code text
   * @param {string} [fallbackTitle] - Optional fallback title
   * @param {string} [language] - Programming language
   * @returns {{ title: string, hasComment: boolean, rawComment: string }}
   */
  function extractFirstCommentTitle(code, fallbackTitle = 'Code Solution', language = '') {
    if (!code || typeof code !== 'string') {
      return { title: fallbackTitle, hasComment: false, rawComment: '' };
    }

    const lines = code.split(/\r?\n/);
    let i = 0;

    // Skip empty lines or shebang lines (e.g. #!/usr/bin/python)
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line === '' || line.startsWith('#!')) {
        i++;
        continue;
      }
      break;
    }

    if (i < lines.length) {
      const currentLine = lines[i].trim();

      // 1. Check for single-line comments: //, #, --, %
      const singleLineMatch = currentLine.match(/^(\/\/|#|--|%)\s*(.*)$/);
      if (singleLineMatch) {
        const raw = singleLineMatch[2];
        const cleaned = cleanCommentTitle(raw);
        if (cleaned.length > 0) {
          return { title: cleaned, hasComment: true, rawComment: currentLine };
        }
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          const nextMatch = nextLine.match(/^(\/\/|#|--|%)\s*(.*)$/);
          if (nextMatch) {
            const nextCleaned = cleanCommentTitle(nextMatch[2]);
            if (nextCleaned.length > 0) {
              return { title: nextCleaned, hasComment: true, rawComment: nextLine };
            }
          }
        }
      }

      // 2. Check for multi-line block comments: /* ... */
      if (currentLine.startsWith('/*') || currentLine.startsWith('<!--') || currentLine.startsWith('{-') || currentLine.startsWith('"""') || currentLine.startsWith("'''")) {
        let blockContent = [];
        let foundEnd = false;
        let j = i;

        while (j < lines.length && !foundEnd) {
          const l = lines[j];
          blockContent.push(l);
          if (j > i && (l.includes('*/') || l.includes('-->') || l.includes('-}') || l.includes('"""') || l.includes("'''"))) {
            foundEnd = true;
          } else if (j === i && l.length > 4 && (l.slice(2).includes('*/') || l.slice(4).includes('-->') || l.slice(3).includes('"""') || l.slice(3).includes("'''"))) {
            foundEnd = true;
          }
          j++;
          if (j - i > 25) break;
        }

        for (const bLine of blockContent) {
          const cleaned = cleanCommentTitle(bLine);
          if (cleaned.length > 0) {
            return {
              title: cleaned,
              hasComment: true,
              rawComment: blockContent.join('\n')
            };
          }
        }
      }
    }

    // 3. Scan anywhere in the first 20 lines for any comment line
    for (let k = 0; k < Math.min(lines.length, 20); k++) {
      const line = lines[k].trim();
      const match = line.match(/^(\/\/|#|--|\/\*)\s*(.+?)(\*\/)?$/);
      if (match) {
        const candidate = cleanCommentTitle(match[2]);
        if (candidate.length >= 3 && !candidate.startsWith('include') && !candidate.startsWith('import')) {
          return { title: candidate, hasComment: true, rawComment: line };
        }
      }
    }

    // 4. Derive smart title from function/class names
    const derived = deriveTitleFromFunctions(code, language);
    if (derived) {
      return { title: derived, hasComment: false, rawComment: '' };
    }

    // 5. Final fallback
    return { title: fallbackTitle, hasComment: false, rawComment: '' };
  }

  return {
    extractFirstCommentTitle,
    cleanCommentTitle,
    deriveTitleFromFunctions
  };
});
