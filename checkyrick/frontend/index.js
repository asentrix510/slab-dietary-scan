// DietXplore — Landing Page Interactive Demo & Interactions

const sampleProducts = {
    'ramen': {
        title: '🍜 Spicy Kimchi Instant Ramen',
        status: 'warning',
        statusLabel: '⚠️ 2 Flags (MSG & Allium Conflict)',
        ingredients: [
            { name: 'Wheat Flour (Enriched)', verdict: 'Safe', type: 'safe', detail: 'Contains wheat gluten' },
            { name: 'Monosodium Glutamate (E621)', verdict: 'Sensitivity', type: 'warning', detail: 'Flavor enhancer · May trigger MSG sensitivity or headaches' },
            { name: 'Garlic Powder & Dried Chives', verdict: 'Allium Conflict', type: 'danger', detail: 'Violates Jain & strict low-FODMAP dietary preferences' },
            { name: 'Disodium Guanylate (E627)', verdict: 'Caution', type: 'warning', detail: 'Can be fish or yeast derived · Flagged for strict Vegan diets' },
            { name: 'Palm Oil', verdict: 'Advisory', type: 'warning', detail: 'High saturated fats · Sourced from Elaeis guineensis' }
        ],
        citations: 'EFSA Food Additive Regulation (EC) No 1333/2008 & US FDA 21 CFR § 182.1'
    },
    'energy-bar': {
        title: '🍫 Chocolate Peanut Butter Protein Bar',
        status: 'danger',
        statusLabel: '🚨 High Allergen Alert (Peanuts & Milk)',
        ingredients: [
            { name: 'Peanut Butter & Roasted Peanuts', verdict: 'Severe Allergen', type: 'danger', detail: 'Major FDA Priority Allergen (Peanut protein)' },
            { name: 'Whey Protein Isolate', verdict: 'Dairy Allergen', type: 'danger', detail: 'Derived from bovine milk · Not suitable for lactose-intolerant or vegan' },
            { name: 'Rolled Oats (Gluten-Free)', verdict: 'Safe', type: 'safe', detail: 'Certified <20ppm gluten content' },
            { name: 'Erythritol & Stevia Leaf Extract', verdict: 'Safe / Low Sugar', type: 'safe', detail: 'Non-nutritive plant sweetening compound' },
            { name: 'Soy Lecithin', verdict: 'Soy Allergen', type: 'warning', detail: 'Emulsifier derived from Glycine max (Soybean)' }
        ],
        citations: 'FDA Food Allergen Labeling & Consumer Protection Act (FALCPA)'
    },
    'cookies': {
        title: '🍪 European Butter Shortbread Cookies',
        status: 'safe',
        statusLabel: '✅ Clean Formulation (No Banned Additives)',
        ingredients: [
            { name: 'Wheat Flour & Grass-Fed Butter', verdict: 'Safe', type: 'safe', detail: 'Traditional bakery base · Contains dairy & gluten' },
            { name: 'Unrefined Cane Sugar', verdict: 'Safe', type: 'safe', detail: 'Non-bone-char processed sugar' },
            { name: 'Natural Madagascar Vanilla Extract', verdict: 'Safe', type: 'safe', detail: 'Natural botanical orchid pod extract' },
            { name: 'Sea Salt', verdict: 'Safe', type: 'safe', detail: 'Natural solar evaporated sea salt' }
        ],
        citations: 'EU Regulation No 1169/2011 on Food Information to Consumers'
    }
};

function renderDemoProduct(productKey) {
    const product = sampleProducts[productKey];
    if (!product) return;

    const displayContainer = document.getElementById('demoDisplay');
    if (!displayContainer) return;

    let itemsHtml = product.ingredients.map(item => `
        <div class="preview-item ${item.type}">
            <div class="item-icon">${item.type === 'safe' ? '✓' : item.type === 'danger' ? '✕' : '!'}</div>
            <div class="item-details">
                <strong>${item.name}</strong>
                <span>${item.detail}</span>
            </div>
            <span class="tag-status tag-${item.type}">${item.verdict}</span>
        </div>
    `).join('');

    displayContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
            <h4 style="margin: 0; font-size: 1.1rem; color: var(--text-headings);">${product.title}</h4>
            <span class="badge badge-${product.status}" style="background: ${product.status === 'safe' ? 'var(--status-success-subtle)' : product.status === 'danger' ? 'var(--status-danger-subtle)' : 'var(--status-warning-subtle)'}; color: ${product.status === 'safe' ? 'var(--status-success)' : product.status === 'danger' ? 'var(--status-danger)' : 'var(--status-warning)'};">
                ${product.statusLabel}
            </span>
        </div>
        <div class="preview-results-list" style="padding: 0; gap: 8px;">
            ${itemsHtml}
        </div>
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 0.78rem; color: var(--text-muted); font-family: var(--font-mono);">
            <span>📚 <strong>Source Basis:</strong> ${product.citations}</span>
            <a href="scanner.html" style="color: var(--primary-accent); text-decoration: underline;">Scan your own food →</a>
        </div>
    `;
}

// Attach event listeners for tabs
document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.demo-tab-btn');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderDemoProduct(btn.dataset.product);
        });
    });

    // Initial render
    renderDemoProduct('ramen');
});
