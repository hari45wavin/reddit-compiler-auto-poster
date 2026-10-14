# Chrome Web Store Listing — Reddit Code Poster

> Last Updated: 2026-10-11

## Store Listing

**Extension Name** [REQUIRED]
Reddit Code Poster - Online Compiler Auto-Share

**Short Description** [REQUIRED]
Automatically share code from online compilers to your Reddit profile with the title from the first comment in the background.

**Detailed Description** [REQUIRED]
Automatically share your programming solutions and snippets from any online compiler directly to your Reddit profile or community.

Save time when coding on platforms like OnlineGDB, Programiz, Replit, LeetCode, HackerRank, CodeChef, and more. When you click share, Reddit Code Poster extracts your code, derives the post title from the first comment in your code, formats the snippet, and posts it to your Reddit account in the background.

Key Features:
- First-Comment Title Detection: Automatically reads comments like `// Reverse a Linked List`, `# Two Sum Solution`, or `/* QuickSort */` and sets them as the post title.
- Complete Background Posting: Posts directly to your Reddit account in the background. You can close the tab immediately without waiting for Reddit to load.
- Profile or Subreddit Destination: Choose between posting to your own profile (u/username) or any specific subreddit community.
- Dual Browser Compatibility: Works seamlessly on Google Chrome and Brave Browser.
- Clean Code Formatting: Posts formatted Markdown code blocks along with original compiler source links.
- Interactive Extension Popup: Quick test button, active Reddit session detection, and real-time history tracking.

How to Use:
1. Ensure you are signed into your Reddit account in your browser.
2. Open any online compiler or coding site and write your code.
3. Add a title in the first comment (e.g., `// Two Sum Problem`).
4. Click the compiler's Share button or the floating "Post to Reddit" action button.
5. The extension handles the rest in the background!

Privacy & Security:
Reddit Code Poster operates locally on your machine and communicates directly with Reddit using your active session. It does not run external servers, collect personal data, or sell information to third parties.

**Category** [REQUIRED]
Developer Tools

**Single Purpose** [REQUIRED]
Automates posting code solutions from online compilers to a user's Reddit profile or subreddit with titles derived from code comments.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | icons/icon-128.png |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Saves user preferences (Reddit username, post formatting, auto-close behavior) and local posting history. |
| `cookies` | permissions | Reads Reddit session tokens to authenticate submission requests directly from the background service worker. |
| `notifications` | permissions | Displays desktop notifications confirming whether the post succeeded or failed, with direct links to view the post. |
| `tabs` | permissions | Monitors the URL of Reddit submit tabs to execute background posting and optionally close redundant redirect tabs. |
| `scripting` | permissions | Enables the manual "Post Active Tab's Code Now" button to inspect and extract code snippets from the active tab. |
| `tabGroups` | permissions | Automatically groups coding session tabs (compiler, reddit, docs) together into a color-coded, labeled work group. |
| `*://*.reddit.com/*` | host_permissions | Allows background HTTP requests to Reddit API endpoints (/api/me.json and /api/submit) to post code on the user's behalf. |
| `*://reddit.com/*` | host_permissions | Ensures compatibility with top-level Reddit domains. |
| `*://*.redd.it/*` | host_permissions | Resolves Reddit short links and media domains. |
| `<all_urls>` | host_permissions | Required to detect code editors and extract code comments across diverse online compiler platforms (OnlineGDB, Replit, LeetCode, Programiz, etc.). |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

The extension operates completely on-device. Code snippets and session tokens are transmitted solely to reddit.com to create the requested post. No telemetry or analytics are collected.

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Distribution

**Visibility**: Public  
**Regions**: All regions  

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.1.0 | 2026-10-11 | Added on-compiler floating pill toolbar, auto-save/restore code, auto-popup card, smart tab grouping, and automatic captcha bypass | Draft |
| 1.0.0 | 2026-10-11 | Initial release with background Reddit posting, comment title extraction, and Brave/Chrome support | Draft |
