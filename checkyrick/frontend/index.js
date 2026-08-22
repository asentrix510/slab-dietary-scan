// DIETXPLORE — Neo-Brutalist Interactive Demo Engine

const sampleProducts = {
    'ramen': {
        title: '🍜 INSTANT SPICY RAMEN',
        status: 'warning',
        statusLabel: '2 WARNINGS',
        badgeBg: 'bg-tertiary-container text-on-tertiary-container',
        ingredients: [
            { name: 'ENRICHED WHEAT FLOUR', verdict: 'SAFE', type: 'safe', detail: 'Standard bakery grain base · Contains gluten' },
            { name: 'MONOSODIUM GLUTAMATE (E621)', verdict: 'MSG SENSITIVITY', type: 'warning', detail: 'Chemical flavor potentiator · May trigger headaches' },
            { name: 'GARLIC POWDER & DRIED CHIVES', verdict: 'ALLIUM VIOLATION', type: 'danger', detail: 'Root extracts · Non-compliant for Jain and strict low-FODMAP diets' },
            { name: 'DISODIUM GUANYLATE (E627)', verdict: 'CAUTION', type: 'warning', detail: 'Can be fish/meat derived · Flagged for strict Vegan/Halal' }
        ],
        citations: 'EFSA Food Additives Regulation (EC) 1333/2008 & US FDA 21 CFR § 182.1'
    },
    'energy-bar': {
        title: '🍫 CHOCOLATE PEANUT PROTEIN BAR',
        status: 'danger',
        statusLabel: 'HIGH ALLERGEN ALERT',
        badgeBg: 'bg-error-container text-on-error-container',
        ingredients: [
            { name: 'ROASTED PEANUTS & PEANUT BUTTER', verdict: 'CRITICAL ALLERGEN', type: 'danger', detail: 'Major FDA Priority Allergen (Arachis hypogaea)' },
            { name: 'WHEY PROTEIN ISOLATE', verdict: 'DAIRY ALLERGEN', type: 'danger', detail: 'Bovine milk serum · Incompatible with Vegan & Lactose-Intolerant' },
            { name: 'CERTIFIED GLUTEN-FREE OATS', verdict: 'SAFE', type: 'safe', detail: 'Lab tested <20ppm gluten threshold' },
            { name: 'STEVIA LEAF EXTRACT', verdict: 'SAFE', type: 'safe', detail: 'Non-caloric natural botanical glycoside' }
        ],
        citations: 'FDA Food Allergen Labeling & Consumer Protection Act (FALCPA)'
    },
    'cookies': {
        title: '🍪 BUTTER SHORTBREAD COOKIES',
        status: 'safe',
        statusLabel: 'CLEAN FORMULATION',
        badgeBg: 'bg-primary-container text-on-primary-container',
        ingredients: [
            { name: 'WHEAT FLOUR & PURE BUTTER', verdict: 'SAFE', type: 'safe', detail: 'Clean bakery profile · Contains dairy & wheat gluten' },
            { name: 'NON-BONE-CHAR CANE SUGAR', verdict: 'SAFE', type: 'safe', detail: 'Unbleached natural sucrose' },
            { name: 'MADAGASCAR VANILLA EXTRACT', verdict: 'SAFE', type: 'safe', detail: 'Natural botanical orchid seedpod extract' },
            { name: 'SEA SALT', verdict: 'SAFE', type: 'safe', detail: 'Natural solar evaporated sodium chloride' }
        ],
        citations: 'EU Regulation No 1169/2011 on Food Information to Consumers'
    }
};

function renderDemoProduct(productKey) {
    const product = sampleProducts[productKey];
    if (!product) return;

    const displayContainer = document.getElementById('demoDisplay');
    if (!displayContainer) return;

    let itemsHtml = product.ingredients.map(item => {
        let borderClass = 'border-l-[6px] border-l-primary';
        let badgeColor = 'bg-primary-container text-on-primary-container';
        let icon = 'check_circle';
        let iconColor = 'text-primary';

        if (item.type === 'danger') {
            borderClass = 'border-l-[6px] border-l-[#ba1a1a]';
            badgeColor = 'bg-[#ffdad6] text-[#93000a]';
            icon = 'cancel';
            iconColor = 'text-[#ba1a1a]';
        } else if (item.type === 'warning') {
            borderClass = 'border-l-[6px] border-l-[#636100]';
            badgeColor = 'bg-tertiary-container text-on-tertiary-container';
            icon = 'warning';
            iconColor = 'text-[#636100]';
        }

        return `
            <div class="bg-surface p-4 neo-border-thin flex items-start justify-between gap-4 ${borderClass}">
                <div class="flex items-start gap-3">
                    <span class="material-symbols-outlined ${iconColor} font-bold text-2xl">${icon}</span>
                    <div>
                        <strong class="font-headline-md text-base md:text-lg block uppercase">${item.name}</strong>
                        <span class="font-body-md text-xs md:text-sm text-on-surface-variant">${item.detail}</span>
                    </div>
                </div>
                <span class="${badgeColor} font-label-mono text-[11px] px-2.5 py-1 neo-border-thin whitespace-nowrap self-start">${item.verdict}</span>
            </div>
        `;
    }).join('');

    displayContainer.innerHTML = `
        <div class="flex justify-between items-center mb-6 flex-wrap gap-4 pb-4 border-b-[3px] border-on-surface">
            <h3 class="font-headline-xl text-2xl md:text-3xl uppercase tracking-tight text-on-surface">${product.title}</h3>
            <span class="${product.badgeBg} font-label-mono text-xs md:text-sm px-3 py-1 neo-border font-bold">
                ${product.statusLabel}
            </span>
        </div>
        <div class="flex flex-col gap-3">
            ${itemsHtml}
        </div>
        <div class="mt-6 pt-4 border-t-[3px] border-on-surface flex justify-between items-center flex-wrap gap-3 font-label-mono text-xs text-on-surface-variant">
            <span>AUDIT SOURCE: ${product.citations}</span>
            <a href="scanner.html" class="text-primary font-bold underline hover:text-on-surface transition-colors">SCAN REAL PACKAGING &rarr;</a>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.demo-tab-btn');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => {
                b.classList.remove('active', 'bg-primary-container', 'text-on-primary-container');
                b.classList.add('bg-surface-container-lowest', 'text-on-surface');
            });
            btn.classList.add('active', 'bg-primary-container', 'text-on-primary-container');
            btn.classList.remove('bg-surface-container-lowest', 'text-on-surface');
            renderDemoProduct(btn.dataset.product);
        });
    });

    renderDemoProduct('ramen');
});
