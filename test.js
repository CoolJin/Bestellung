const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
      if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text());
  });
  page.on('pageerror', error => console.error('PAGE ERROR UNCAUGHT:', error));

  try {
    await page.goto('http://localhost:8080/');
    await page.waitForTimeout(1000);

    const log = await page.evaluate(async () => {
        window.app.state.currentUser = { username: 'admin', role: 'admin' };
        window.app.updateUI();
        window.app.navigateTo('admin');

        const mockList = document.getElementById('orders-list');
        if (mockList) {
            mockList.dataset.activeTab = 'users';
        }

        const evt = new CustomEvent('admin-tab-changed', { detail: { tab: 'users' } });
        window.dispatchEvent(evt);

        await new Promise(r => setTimeout(r, 1000));

        const inputName = document.getElementById('new-user-name');
        const inputPass = document.getElementById('new-user-pass');
        if (inputName && inputPass) {
            inputName.value = 'testuser2';
            inputPass.value = 'testpass2';
        }

        const btn = document.getElementById('create-user-btn');
        if (btn) btn.click();

        await new Promise(r => setTimeout(r, 2000));

        const adminMsg = document.getElementById('admin-msg');
        return adminMsg ? adminMsg.textContent : 'none';
    });

    console.log("Create user log:", log);
    await page.screenshot({ path: 'glass-surface-test.png' });

  } catch (err) {
    console.error("Test failed", err);
  } finally {
    await browser.close();
  }
})();
