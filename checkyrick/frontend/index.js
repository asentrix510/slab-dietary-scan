// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        const target = document.querySelector(targetId);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Copy Code Button
const copyCodeBtn = document.getElementById('copyCodeBtn');
if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', () => {
        const codeBlock = document.querySelector('.code-block code');
        if (codeBlock) {
            navigator.clipboard.writeText(codeBlock.innerText).then(() => {
                copyCodeBtn.textContent = 'Copied!';
                copyCodeBtn.style.color = '#3FB950';
                setTimeout(() => {
                    copyCodeBtn.textContent = 'Copy';
                    copyCodeBtn.style.color = '';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy code', err);
            });
        }
    });
}

// Navbar scroll subtle background change
const navbar = document.querySelector('.navbar');
if (navbar) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.borderBottomColor = '#58A6FF40';
        } else {
            navbar.style.borderBottomColor = '#30363D';
        }
    });
}

console.log('%c⚡ Dietary Deep Scan System Initialized (webcmd.dev design system)', 'font-family: monospace; font-size: 14px; font-weight: bold; color: #58A6FF;');
