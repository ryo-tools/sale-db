// fetch-sales.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// 追跡対象のAmazon ASINリストと初期情報
const TARGET_PRODUCTS = [
  {
    asin: "B08N5WRWNW",
    category: "pc",
    categoryName: "PCパーツ",
    defaultTitle: "Kioxia EXCERIA G2 NVMe SSD 2TB M.2 Type 2280"
  },
  {
    asin: "B0BFL119YF",
    category: "gadget",
    categoryName: "ガジェット",
    defaultTitle: "Anker 737 Power Bank (PowerCore 24000) 140W出力 24000mAh"
  },
  {
    asin: "B01C20I8S8",
    category: "fitness",
    categoryName: "サプリ・健康",
    defaultTitle: "明治 ザバス(SAVAS) ホエイプロテイン100 リッチショコラ味 1,000g"
  },
  {
    asin: "B07Z344MDR",
    category: "daily",
    categoryName: "日用品",
    defaultTitle: "アタックZERO 洗濯洗剤 詰め替え 2150g 大容量"
  },
  {
    asin: "B08HG3YFGG",
    category: "pc",
    categoryName: "PCパーツ",
    defaultTitle: "SanDisk microSDXC 256GB Ultra 120MB/s SDSQUA4-256G"
  },
  {
    asin: "B09V33SGHQ",
    category: "fitness",
    categoryName: "サプリ・健康",
    defaultTitle: "エクスプロージョン ホエイプロテイン 3kg ミルクチョコ味"
  }
];

const OUTPUT_PATH = path.join(__dirname, '../public/products.json'); // 配置場所に合わせて読み込み元調整

async function scrapeAmazonPrice(page, item) {
  const url = `https://www.amazon.co.jp/dp/${item.asin}?th=1`;
  console.log(`[Fetching] ${item.defaultTitle} (${item.asin})...`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // タイトル取得
    let title = item.defaultTitle;
    const titleEl = await page.$('#productTitle');
    if (titleEl) {
      title = (await titleEl.textContent()).trim();
    }

    // 価格取得 (Amazonの主要な価格セレクタを判定)
    let currentPrice = 0;
    let originalPrice = null;

    const priceWholeEl = await page.$('.a-price-whole');
    if (priceWholeEl) {
      const priceText = await priceWholeEl.textContent();
      currentPrice = parseInt(priceText.replace(/[^0-9]/g, ''), 10);
    }

    // 参考価格（元値）の取得
    const basisPriceEl = await page.$('.a-price.a-text-price span.a-offscreen, .basisPrice .a-offscreen');
    if (basisPriceEl) {
      const basisText = await basisPriceEl.textContent();
      const parsedBasis = parseInt(basisText.replace(/[^0-9]/g, ''), 10);
      if (parsedBasis > currentPrice) {
        originalPrice = parsedBasis;
      }
    }

    // 画像URL
    let imageUrl = '';
    const imgEl = await page.$('#landingImage');
    if (imgEl) {
      imageUrl = await imgEl.getAttribute('src');
    }

    // 割引率算出
    let discountRate = 0;
    if (originalPrice && originalPrice > currentPrice) {
      discountRate = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    }

    return {
      id: `asin-${item.asin}`,
      asin: item.asin,
      title: title,
      category: item.category,
      categoryName: item.categoryName,
      currentPrice: currentPrice || 0,
      originalPrice: originalPrice,
      discountRate: discountRate,
      imageUrl: imageUrl || `https://m.media-amazon.com/images/I/614AnAnQe0L._AC_SL1500_.jpg`,
      shopUrl: `https://www.amazon.co.jp/dp/${item.asin}`,
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error(`Error scraping ${item.asin}:`, err.message);
    return null;
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const results = [];

  for (const item of TARGET_PRODUCTS) {
    const data = await scrapeAmazonPrice(page, item);
    if (data && data.currentPrice > 0) {
      results.push(data);
    } else {
      // 取得失敗時はデフォルトフォールバックデータを維持
      results.push({
        id: `asin-${item.asin}`,
        asin: item.asin,
        title: item.defaultTitle,
        category: item.category,
        categoryName: item.categoryName,
        currentPrice: 0,
        originalPrice: null,
        discountRate: 0,
        imageUrl: '',
        shopUrl: `https://www.amazon.co.jp/dp/${item.asin}`,
        updatedAt: new Date().toISOString()
      });
    }
    // Amazonへのアクセス負荷軽減ウェイト
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();

  // JSON保存
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`[Success] Saved ${results.length} items to ${OUTPUT_PATH}`);
}

main();