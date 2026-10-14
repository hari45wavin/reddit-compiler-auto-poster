document.addEventListener('DOMContentLoaded', async () => {
  const usernameInput = document.getElementById('usernameInput');
  const detectBtn = document.getElementById('detectBtn');
  const detectedTitle = document.getElementById('detectedTitle');
  const saveBtn = document.getElementById('saveBtn');
  const saveFeedback = document.getElementById('saveFeedback');

  // Load stored settings
  const { settings = {}, activeTitle = '' } = await chrome.storage.local.get(['settings', 'activeTitle']);

  if (settings.username) {
    usernameInput.value = settings.username;
  } else {
    usernameInput.value = 'Icy_Witness7296';
  }

  if (activeTitle) {
    detectedTitle.textContent = `"${activeTitle}"`;
  }

  // Detect session
  detectBtn.addEventListener('click', async () => {
    detectBtn.textContent = '...';
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });
      if (res && res.session && res.session.username) {
        usernameInput.value = res.session.username;
        const current = (await chrome.storage.local.get(['settings'])).settings || {};
        current.username = res.session.username;
        await chrome.storage.local.set({ settings: current });
      }
    } catch(e) {}
    detectBtn.textContent = 'Detect';
  });

  // Save
  saveBtn.addEventListener('click', async () => {
    const val = usernameInput.value.trim() || 'Icy_Witness7296';
    const current = (await chrome.storage.local.get(['settings'])).settings || {};
    current.username = val;
    await chrome.storage.local.set({ settings: current });

    saveFeedback.classList.remove('hidden');
    setTimeout(() => saveFeedback.classList.add('hidden'), 2000);
  });
});
