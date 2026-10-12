
// [URL CLEANUP] Remove 'v=' parameter and ensure default route
window.addEventListener('load', () => {
    // 1. Remove cache buster query param if present
    if (window.location.search.includes('v=')) {
        const url = new URL(window.location.href);
        url.searchParams.delete('v');
        window.history.replaceState({}, '', url.toString());
    }

    // 2. Force Dashboard if no hash is present
    if (!window.location.hash) {
        window.location.hash = 'dashboard';
        if (typeof showSection === 'function') showSection('dashboard');
    } else {
        // Ensure the correct section is shown based on hash
        const section = window.location.hash.substring(1);
        if (typeof showSection === 'function') showSection(section);
    }
});
