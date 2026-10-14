# 🚀 Reddit Code Poster (Chrome & Brave Extension)

A lightweight, high-performance Manifest V3 browser extension for **Google Chrome** and **Brave Browser** that automates sharing code from online compilers to your personal Reddit profile (`u/Icy_Witness7296`).

---

## 🎯 What This Extension Does

1. **Auto-Extracts Dynamic Title from Code Comments**:
   - Reads the first comment line of your code dynamically (e.g. `// Basic string concepts and operations.`, `// Two Sum`, `# Palindrome Check`, `/* Binary Search */`, `""" Merge Intervals """`, or LeetCode question title).
   - **Never hardcodes fixed titles**. The title changes in real time whenever your code comment changes.

2. **Intentional Saving & 3-Slot History**:
   - **No Accidental Overwrites**: Your code is NOT continuously overwritten on keystrokes. It is only saved when you click **`💾 Save`** or **`🚀 Share to Reddit`**.
   - **Retains Last 3 Saves**: Stores up to 3 saved codes chronologically with their titles, line counts, and timestamps.
   - **Auto-Saves on Share**: Whenever you click **`🚀 Share to Reddit`**, the current code is automatically stored in your 3-slot history!

3. **Floating Toolbar & Code Manager on Compiler Tabs**:
   - Appears at the bottom-right of online compilers (Programiz, LeetCode, OnlineGDB, Replit, etc.).
   - **`🚀 Share to Reddit`**: Opens Reddit with your profile & dynamic title, and saves your code to history.
   - **`💾 Save`**: 1-click saves current code into your 3-slot history.
   - **`📂 Load ▾`**: Opens the Code Manager popup where you can:
     - ⚡ Load any of your **last 3 saved codes** with individual "Load" buttons.
     - 📋 Select and insert **Starter Code Snippets** (C++, Python, Java, JavaScript) via page-level `MAIN` world script execution.
   - Displays live title preview: `📝 "[Your Comment Title]"`.

4. **Automated Reddit Community & Dynamic Title Insertion**:
   - Opens Reddit directly with your profile pre-selected (`u/Icy_Witness7296`).
   - **Solves Reddit's Community Reset Behavior**: Reddit's modern Lit/Shreddit web components reset the post title whenever the community loads or changes. The extension penetrates all Shadow DOM roots (`shreddit-composer`, `faceplate-textarea-input`, etc.) and sets your dynamic comment title **after** the community is selected.
   - Watches for 15 seconds to prevent Reddit from reverting the title to default text.

5. **Floating Status Pill on Reddit**:
   - Shows your active profile badge (`u/Icy_Witness7296`), the dynamic title, status `✓ Ready (Click Post)`, and an `Apply Title ↻` button to re-trigger anytime.

6. **User-Controlled Posting**:
   - Fills all fields automatically, leaving only the native Reddit **Post** button for you to click.

---

## 📂 Project Structure

```text
reddit-compiler-auto-poster/
├── manifest.json              # Manifest V3 configuration with CSS and host permissions
├── background.js              # Service worker (session sync, tabs routing to u/Icy_Witness7296)
├── README.md                  # Documentation
├── icons/                     # Extension icons (16px, 48px, 128px)
├── content/
│   ├── compiler.js            # Auto-save/restore, dynamic comment parser, floating Share button
│   ├── compiler.css           # Styling for compiler floating button & title preview
│   ├── reddit.js              # Shadow-DOM piercing, community verification, post-community title writer
│   └── reddit.css             # Styling for floating status pill on Reddit
└── popup/
    ├── popup.html             # Extension popup interface
    ├── popup.js               # Settings & profile detector
    └── popup.css              # Dark theme styling
```

---

## ⚡ How to Load & Test in Chrome / Brave

1. Open extension manager:
   - **Chrome**: `chrome://extensions`
   - **Brave**: `brave://extensions`
2. Enable **Developer mode** (toggle in the top-right corner).
3. If previously installed, click the **🔄 Reload (Refresh)** icon on the **Reddit Code Poster** tile.
   *(Or click "Load unpacked" and select `C:\Users\ASUS\.gemini\antigravity\scratch\reddit-compiler-auto-poster`)*.
4. Open [Programiz C++ Compiler](https://www.programiz.com/cpp-programming/online-compiler/):
   - Notice the floating **🚀 Share to Reddit** button at the bottom-right.
   - Type any comment on line 1 (e.g. `// Binary Search Algorithm`).
   - Notice the button preview updates live to: `📝 "Binary Search Algorithm"`.
5. Click **🚀 Share to Reddit** (or Programiz's native Share button):
   - Reddit opens with community locked to **`u/Icy_Witness7296`**.
   - The title is automatically filled with your code comment title.
   - The floating status pill shows `✓ Ready (Click Post)`.
   - Simply click the native Reddit **Post** button!
