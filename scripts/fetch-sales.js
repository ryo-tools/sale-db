// fetch-sales.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// 3大EC（Amazon, 楽天, Yahoo!）比較対象リスト
const TARGET_PRODUCTS = [
  {
    id: "ssd-kioxia-2tb",
    category: "pc",
    categoryName: "PCパーツ",
    title: "Kioxia EXCERIA G2 NVMe SSD 2TB",
    imageUrl: "https://images-na.ssl-images-amazon.com/images/P/B08N5WRWNW.01.LZZZZZZZ.jpg",
    amazonAsin: "B08N5WRWNW",
    rakutenQuery: "Kioxia EXCERIA G2 2TB SSD",
    yahooQuery: "Kioxia EXCERIA G2 2TB SSD"
  },
  {
    id: "anker-737-powerbank",
    category: "gadget",
    categoryName: "ガジェット",
    title: "Anker 737 Power Bank (24000mAh 140W)",
    imageUrl: "https://images-na.ssl-images-amazon.com/images/P/B0BFL119YF.01.LZZZZZZZ.jpg",
    amazonAsin: "B0BFL119YF",
    rakutenQuery: "Anker 737 Power Bank 24000mAh",
    yahooQuery: "Anker 737 Power Bank 24000mAh"
  },
  {
    id: "savas-whey-protein-1k",
    category: "fitness",
    categoryName: "サプリ・健康",
    title: "ザバス ホエイプロテイン100 リッチショコラ味 1kg",
    imageUrl: "https://images-na.ssl-images-amazon.com/images/P/B01C20I8S8.01.LZZZZZZZ.jpg",
    amazonAsin: "B01C20I8S8",
    rakutenQuery: "ザバス ホエイプロテイン100 リッチショコラ 1kg",
    yahooQuery: "ザバス ホエイプロテイン100 リッチショコラ 1kg"
  }
];

const OUTPUT_PATH = path.join(__dirname, '../public/products.json');

// Amazon価格取得
async function getAmazonData(page, asin) {
  if (!asin) return null;
  try {
    const url = `https://www.amazon.co.jp/dp/${asin}?th=1`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    const priceWholeEl = await page.$('.a-price-whole');
    if (priceWholeEl) {
      const text = await priceWholeEl.textContent();
      const price = parseInt(text.replace(/[^0-9]/g, ''), 10);
      return { store: 'Amazon', price, url };
    }
  } catch (e) {
    console.error(`Amazon error (${asin}):`, e.message);
  }
  return null;
}

// 楽天最安値検索（Webスクレイピング）
async function getRakutenData(page, query) {
  if (!query) return null;
  try {
    const searchUrl = `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(query)}/?s=2`; // 価格が安い順
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    const priceEl = await page.$('.price--21zsg, .item-price, .price');
    const linkEl = await page.$('.item-search-result-item a, .searchresultitem a');
    if (priceEl) {
      const text = await priceEl.textContent();
      const price = parseInt(text.replace(/[^0-9]/g, ''), 10);
      const url = linkEl ? await linkEl.getAttribute('href') : searchUrl;
      return { store: '楽天市場', price, url };
    }
  } catch (e) {
    console.error(`Rakuten error (${query}):`, e.message);
  }
  return null;
}

// Yahoo!ショッピング最安値検索
async function getYahooData(page, query) {
  if (!query) return null;
  try {
    const searchUrl = `https://shopping.yahoo.co.jp/search?p=${encodeURIComponent(query)}&X=2`; // 価格の安い順
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    const priceEl = await page.$('[class*="Price_price"], .mdSearchItemPrice');
    const linkEl = await page.$('[class*="LoopList_item"] a, .mdSearchItemSnippet a');
    if (priceEl) {
      const text = await priceEl.textContent();
      const price = parseInt(text.replace(/[^0-9]/g, ''), 10);
      const url = linkEl ? await linkEl.getAttribute('href') : searchUrl;
      return { store: 'Yahoo!ショッピング', price, url };
    }
  } catch (e) {
    console.error(`Yahoo error (${query}):`, e.message);
  }
  return null;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const results = [];

  for (const item of TARGET_PRODUCTS) {
    console.log(`[Comparing] ${item.title}...`);

    const amazon = await getAmazonData(page, item.amazonAsin);
    await new Promise(r => setTimeout(r, 1500));

    const rakuten = await getRakutenData(page, item.rakutenQuery);
    await new Promise(r => setTimeout(r, 1500));

    const yahoo = await getYahooData(page, item.yahooQuery);
    await new Promise(r => setTimeout(r, 1500));

    const stores = [amazon, rakuten, yahoo].filter(Boolean);
    
    // 最安値ショップの決定
    let lowestPrice = null;
    let lowestStore = null;
    if (stores.length > 0) {
      const sorted = [...stores].sort((a, b) => a.price - b.price);
      lowestPrice = sorted[0].price;
      lowestStore = sorted[0].store;
    }

    results.push({
      id: item.id,
      title: item.title,
      category: item.category,
      categoryName: item.categoryName,
      imageUrl: item.imageUrl,
      lowestPrice,
      lowestStore,
      stores: {
        amazon: amazon || { store: 'Amazon', price: null, url: `https://www.amazon.co.jp/dp/${item.amazonAsin}` },
        rakuten: rakuten || { store: '楽天市場', price: null, url: `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(item.rakutenQuery)}/` },
        yahoo: yahoo || { store: 'Yahoo!ショッピング', price: null, url: `https://shopping.yahoo.co.jp/search?p=${encodeURIComponent(item.yahooQuery)}` }
      },
      updatedAt: new Date().toISOString()
    });
  }

  await browser.close();

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`[Success] Saved ${results.length} compared items to ${OUTPUT_PATH}`);
}

main();