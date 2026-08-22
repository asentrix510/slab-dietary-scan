// DIETXPLORE — Universal Dark / Light Theme Controller

(function () {
    const STORAGE_KEY = 'dietxplore-theme';
    
    // Determine initial theme (saved in localStorage or default to system/light)
    function getPreferredTheme() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Apply theme to document element
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
        } else {
            document.documentElement.classList.add('light');
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem(STORAGE_KEY, theme);
        updateToggleButtons(theme);
    }

    // Update toggle icons/text
    function updateToggleButtons(theme) {
        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            const icon = btn.querySelector('.theme-toggle-icon');
            if (icon) {
                icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
            }
            btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
            btn.setAttribute('title', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        });
    }

    // Toggle function
    window.toggleTheme = function () {
        const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    };

    // Initialize immediately to prevent flash
    const initialTheme = getPreferredTheme();
    applyTheme(initialTheme);

    // Attach listeners on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        updateToggleButtons(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        
        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            btn.addEventListener('click', window.toggleTheme);
        });
    });
})();
