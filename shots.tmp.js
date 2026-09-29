const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('http://127.0.0.1:8934/index.html');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: process.argv[2] + '/shot1.png' });

  // потыкаем по продуктам поставки, чтобы кадр не был пустым стартовым
  const clickables = await page.$$('canvas');
  if (clickables.length) {
    const box = await clickables[0].boundingBox();
    if (box) {
      // клик по товарам поставки снизу
      await page.mouse.click(box.x + box.width * 0.15, box.y + box.height * 0.72);
      await page.waitForTimeout(400);
      await page.mouse.click(box.x + box.width * 0.32, box.y + box.height * 0.72);
      await page.waitForTimeout(400);
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.72);
      await page.waitForTimeout(800);
    }
  }
  await page.screenshot({ path: process.argv[2] + '/shot2.png' });

  await page.waitForTimeout(3000);
  await page.screenshot({ path: process.argv[2] + '/shot3.png' });

  await browser.close();
})();
