/**
 * Overlay previews only run while they are on screen.
 * Every preview is an iframe with its own socket, timers and animations; they used to keep running in the
 * hidden pages (up to 35+ at once after visiting a few pages), which made the dashboard lag.
 * An iframe that leaves the screen is paused (its address is kept aside and replaced by about:blank),
 * and it is reloaded as soon as it comes back. Add data-keep-alive to an iframe to opt out.
 */
(function () {
    if (!('IntersectionObserver' in window)) return;
    const BLANK = 'about:blank';
    const watched = new Set();
    const onScreen = new WeakMap();
    const isReal = (src) => !!src && !src.startsWith('about:');

    function park(f) {
        if (f.dataset.keepAlive !== undefined) return;
        const src = f.getAttribute('src');
        if (!isReal(src)) return;
        f.dataset.liveSrc = src;
        f.setAttribute('src', BLANK);
    }

    function wake(f) {
        const src = f.dataset.liveSrc;
        if (src && !isReal(f.getAttribute('src'))) f.setAttribute('src', src);
        delete f.dataset.liveSrc;
    }

    const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            onScreen.set(e.target, e.isIntersecting);
            if (e.isIntersecting) wake(e.target); else park(e.target);
        });
    }, { rootMargin: '250px' });

    function watch(f) {
        if (watched.has(f)) return;
        watched.add(f);
        io.observe(f);
    }

    function scan(root) {
        if (root.tagName === 'IFRAME') watch(root);
        else if (root.querySelectorAll) root.querySelectorAll('iframe').forEach(watch);
    }

    function start() {
        scan(document.body);
        new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const n of m.addedNodes) if (n.nodeType === 1 && (n.tagName === 'IFRAME' || n.firstElementChild)) scan(n);
            }
        }).observe(document.body, { childList: true, subtree: true });

        // Code that changes a preview's address while it is hidden reloads it: pause it again,
        // and forget the iframes removed from the page
        setInterval(() => {
            for (const f of watched) {
                if (!f.isConnected) { io.unobserve(f); watched.delete(f); continue; }
                if (onScreen.get(f) === false && isReal(f.getAttribute('src'))) park(f);
            }
        }, 4000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.GentokFrames = { count: () => watched.size, running: () => Array.from(watched).filter(f => isReal(f.getAttribute('src'))).length };
})();
