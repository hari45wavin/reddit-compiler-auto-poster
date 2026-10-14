# Contributing to Reddit Compiler Auto-Poster 🎀

Thank you for your interest in contributing to **Reddit Compiler Auto-Poster**! We welcome bug fixes, editor support additions, feature suggestions, UI polish, and documentation improvements.

---

## 🛠️ Local Development Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/hari45wavin/reddit-compiler-auto-poster.git
   cd reddit-compiler-auto-poster
   ```

2. **Load Unpacked in Chrome:**
   - Open Chrome and navigate to `chrome://extensions`.
   - Enable **Developer mode** in the top-right corner.
   - Click **Load unpacked** and select the `reddit-compiler-auto-poster` directory.

3. **Making Changes & Testing:**
   - Modify any content script (`content/compiler.js`, `content/reddit.js`), background worker (`background.js`), or styles.
   - Click the **↻ Reload** button on the extension card in `chrome://extensions`.
   - Test on an online compiler (Programiz, LeetCode, OnlineGDB) and verify on Reddit submit.

---

## 📋 Pull Request Guidelines

1. **Create a Feature Branch:**
   ```bash
   git checkout -b feature/your-awesome-feature
   ```
2. **Commit Conventions:**
   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(scope): new feature description`
   - `fix(scope): bug fix description`
   - `docs(scope): documentation updates`
   - `perf(scope): performance improvements`
3. **Verify Syntax:**
   Ensure no syntax errors before committing:
   ```bash
   node --check background.js content/compiler.js content/reddit.js popup/popup.js
   ```
4. **Submit Your PR:**
   Push your branch and open a Pull Request against the `main` branch with a clear description and testing notes.

---

## 💡 Areas Where We'd Love Help

- 🌐 Adding support for new online IDEs and competitive programming platforms.
- 🎨 New themes and UI animations for the Gen Z floating toolbar.
- ⚡ Faster DOM detection heuristics for Reddit's evolving Web Components.
- 🧪 Automated integration tests using Puppeteer / Playwright.

---

## 📬 Need Help?

Feel free to open an issue or reach out to Hariom Joshi at `harijoshi215@gmail.com`.
