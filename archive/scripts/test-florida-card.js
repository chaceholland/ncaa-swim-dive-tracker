const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://floridagators.com/sports/mens-swimming-and-diving/roster', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  
  const data = await page.evaluate(() => {
    const card = document.querySelector('.s-person-card');
    if (!card) return { error: 'No card found' };
    
    // Get all data attributes
    const allAttrs = {};
    for (const attr of card.attributes) {
      allAttrs[attr.name] = attr.value;
    }
    
    // Get full text
    const fullText = card.textContent.trim().substring(0, 200);
    
    // Get all inner elements
    const els = card.querySelectorAll('*');
    const elemInfo = Array.from(els).slice(0, 20).map(el => ({
      tag: el.tagName,
      class: el.className.substring(0, 60),
      text: el.textContent.trim().substring(0, 50),
      dataAttrs: Array.from(el.attributes).filter(a => a.name.startsWith('data')).map(a => `${a.name}=${a.value.substring(0, 30)}`)
    }));
    
    return { attrs: allAttrs, fullText, elemInfo };
  });
  
  console.log('Card attrs:', JSON.stringify(data.attrs));
  console.log('Full text:', data.fullText);
  console.log('\nElements:');
  data.elemInfo.forEach(e => console.log(`  ${e.tag} [${e.class}] text="${e.text}" data=[${e.dataAttrs}]`));
  
  await browser.close();
})();
