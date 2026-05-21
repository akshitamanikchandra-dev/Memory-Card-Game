const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  
  const page1 = await browser.newPage();
  const page2 = await browser.newPage();
  
  const errors = [];
  page1.on('pageerror', err => errors.push(`Page 1 Error: ${err.message}`));
  page1.on('console', msg => {
    if (msg.type() === 'error') errors.push(`Page 1 Console Error: ${msg.text()}`);
  });
  
  page2.on('pageerror', err => errors.push(`Page 2 Error: ${err.message}`));
  page2.on('console', msg => {
    if (msg.type() === 'error') errors.push(`Page 2 Console Error: ${msg.text()}`);
  });

  try {
    console.log('Opening Page 1 (Host)...');
    await page1.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    
    // Login Host
    await page1.type('#usernameInput', 'HostPlayer');
    await page1.click('#saveProfileBtn');
    await page1.waitForSelector('#lobbyScreen:not(.hidden)');
    
    // Create Room
    await page1.click('#createRoomBtn');
    await page1.waitForSelector('#roomScreen:not(.hidden)');
    
    const roomId = await page1.$eval('#roomIdLabel', el => el.textContent);
    console.log('Room created with ID:', roomId);
    
    console.log('Opening Page 2 (Joiner)...');
    await page2.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    
    // Login Joiner
    await page2.type('#usernameInput', 'JoinerPlayer');
    await page2.click('#saveProfileBtn');
    await page2.waitForSelector('#lobbyScreen:not(.hidden)');
    
    // Join Room
    await page2.click('#joinRoomToggleBtn');
    await page2.waitForSelector('#joinBox:not(.hidden)');
    await page2.type('#roomIdInput', roomId);
    await page2.click('#joinRoomBtn');
    
    await page2.waitForSelector('#roomScreen:not(.hidden)');
    console.log('Joiner joined the room');
    
    // Wait a bit for sockets to sync
    await new Promise(r => setTimeout(r, 1000));
    
    // Start Game
    console.log('Host clicking Start Game...');
    await page1.click('#startMatchBtn');
    
    await new Promise(r => setTimeout(r, 2000));
    
    const isPage1Playing = await page1.evaluate(() => !document.getElementById('gameBoard').classList.contains('hidden'));
    const isPage2Playing = await page2.evaluate(() => !document.getElementById('gameBoard').classList.contains('hidden'));
    
    console.log('Host transitioned to playing:', isPage1Playing);
    console.log('Joiner transitioned to playing:', isPage2Playing);
    
    if (errors.length > 0) {
      console.log('\n--- BROWSER ERRORS DETECTED ---');
      errors.forEach(e => console.log(e));
    } else {
      console.log('\nNo browser errors detected.');
    }
    
  } catch (err) {
    console.error('Test script failed:', err);
  } finally {
    await browser.close();
  }
})();
