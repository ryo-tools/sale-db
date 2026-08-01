let productsData = [];
let currentCategory = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  await loadProducts();
  setupEventListeners();
});

async function loadProducts() {
  try {
    const res = await fetch('products.json');
    productsData = await res.json();
    
    updateHeaderStats();
    renderProducts();
  } catch (err) {
    console.error('Failed to load products.json:', err);
  }
}

function updateHeaderStats() {
  const totalCount = productsData.length;
  const discountCount = productsData.filter(p => p.discountRate > 0).length;
  
  document.getElementById('total-count').textContent = totalCount;
  document.getElementById('discount-count').textContent = discountCount;
  
  if (productsData.length > 0) {
    const latestDate = new Date(productsData[0].updatedAt);
    document.getElementById('last-updated').textContent = latestDate.toLocaleDateString('ja-JP') + ' ' + latestDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  const searchVal = document.getElementById('search-input').value.toLowerCase().trim();
  const sortVal = document.getElementById('sort-select').value;

  let filtered = productsData.filter(p => {
    if (currentCategory === 'all') return true;
    return p.category === currentCategory;
  });

  if (searchVal) {
    filtered = filtered.filter(p => p.title.toLowerCase().includes(searchVal));
  }

  filtered.sort((a, b) => {
    if (sortVal === 'discount-desc') return b.discountRate - a.discountRate;
    if (sortVal === 'price-asc') return a.currentPrice - b.currentPrice;
    if (sortVal === 'price-desc') return b.currentPrice - a.currentPrice;
    if (sortVal === 'updated') return new Date(b.updatedAt) - new Date(a.updatedAt);
    return 0;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-sub); padding: 40px 0;">該当する商品が見つかりませんでした。</p>`;
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <article class="product-card">
      ${p.discountRate > 0 ? `<div class="discount-badge">-${p.discountRate}% OFF</div>` : ''}
      <div class="card-img-wrap">
        <img src="${p.imageUrl}" alt="${p.title}" loading="lazy">
      </div>
      <div class="card-body">
        <span class="card-category">${p.categoryName}</span>
        <h2 class="card-title">${p.title}</h2>
        <div class="price-row">
          <span class="current-price">¥${p.currentPrice.toLocaleString()}</span>
          ${p.originalPrice ? `<span class="original-price">¥${p.originalPrice.toLocaleString()}</span>` : ''}
        </div>
        <div class="card-actions">
          <a href="${p.shopUrl}" class="btn-buy" target="_blank" rel="noopener noreferrer">Amazonで最安値をチェック ➔</a>
        </div>
      </div>
    </article>
  `).join('');
}

function setupEventListeners() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      tabs.forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      currentCategory = e.target.getAttribute('data-category');
      renderProducts();
    });
  });

  document.getElementById('search-input').addEventListener('input', renderProducts);
  document.getElementById('sort-select').addEventListener('change', renderProducts);
}