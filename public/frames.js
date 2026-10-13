/**
 * Overlay previews of the dashboard.
 *
 * Every preview is an iframe with its own socket, timers and animations. Running all of them at once
 * made the dashboard lag, but pausing them as soon as they left the screen made them blink: every page
 * switch, accordion toggle or scroll reloaded them from zero. Now:
 *  - an iframe is only loaded once it is (nearly) on screen; set its address with GentokFrames.setSrc()
 *    or put it in data-src instead of src in the HTML;
 *  - it is paused (address kept aside, replaced by about:blank) only after it has been off screen for
 *    PARK_AFTER ms, so going back and forth between pages keeps the running preview;
 *  - setSrc() never reloads an iframe whose address did not really change, and a (re)load fades in
 *    instead of showing an empty box.
 * Add data-keep-alive to an iframe to opt out of the pausing (data-src and setSrc still work).
 */
(function () {
    const BLANK = 'about:blank';
    const PARK_AFTER = 30000;
    const watched = new Set();
    const onScreen = new WeakMap();
    const hiddenSince = new WeakMap();
    const isReal = (src) => !!src && !src.startsWith('about:');
    const hasIO = 'IntersectionObserver' in window;

    // Same overlay, ignoring cache busters: "?t=123" used to force a full reload on every settings change
    function key(url) {
        if (!isReal(url)) return '';
        try {
            const u = new URL(url, location.href);
            u.searchParams.delete('t');
            u.searchParams.sort();
            return u.href;
        } catch (e) { return url; }
    }

    const style = document.createElement('style');
    style.textContent = 'iframe.gf-loading{opacity:0}iframe.gf-fade{transition:opacity .28s ease}';
    document.head.appendChild(style);

    function navigate(f, src) {
        f.classList.add('gf-fade', 'gf-loading');
        f.setAttribute('src', src);
    }

    function onLoad(e) {
        const f = e.target;
        if (!isReal(f.getAttribute('src'))) return;
        // short delay: the overlay draws its first frame right after 'load'
        setTimeout(() => f.classList.remove('gf-loading'), 120);
    }

    function park(f) {
        if (f.dataset.keepAlive !== undefined) return;
        const src = f.getAttribute('src');
        if (!isReal(src)) return;
        f.dataset.liveSrc = src;
        f.classList.add('gf-loading');
        f.setAttribute('src', BLANK);
    }

    function wake(f) {
        const src = f.dataset.liveSrc || f.dataset.src;
        if (src && key(src) !== key(f.getAttribute('src'))) navigate(f, src);
        delete f.dataset.liveSrc;
    }

    /** Sets the address of a preview without reloading it for nothing (and without loading it while hidden) */
    function setSrc(f, url) {
        if (!f || !url) return;
        watch(f);
        if (key(url) === key(f.dataset.liveSrc || f.getAttribute('src'))) return;
        if (hasIO && onScreen.get(f) !== true && f.dataset.keepAlive === undefined) {
            // loaded when it shows up
            f.dataset.liveSrc = url;
            if (isReal(f.getAttribute('src'))) { f.classList.add('gf-loading'); f.setAttribute('src', BLANK); }
            return;
        }
        delete f.dataset.liveSrc;
        navigate(f, url);
    }

    const io = hasIO ? new IntersectionObserver((entries) => {
        entries.forEach(e => {
            const f = e.target;
            onScreen.set(f, e.isIntersecting);
            if (e.isIntersecting) { hiddenSince.delete(f); wake(f); } else if (!hiddenSince.has(f)) hiddenSince.set(f, Date.now());
        });
    }, { rootMargin: '300px' }) : null;

    function watch(f) {
        if (watched.has(f)) return;
        watched.add(f);
        f.addEventListener('load', onLoad);
        if (io) io.observe(f);
        else if (f.dataset.src && !isReal(f.getAttribute('src'))) navigate(f, f.dataset.src);
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
        if (!io) return;

        // Pause the previews that have been hidden for a while, and forget the iframes removed from the page
        setInterval(() => {
            const now = Date.now();
            for (const f of watched) {
                if (!f.isConnected) { io.unobserve(f); watched.delete(f); continue; }
                if (onScreen.get(f) === false && now - (hiddenSince.get(f) || now) >= PARK_AFTER) park(f);
            }
        }, 5000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.GentokFrames = {
        setSrc,
        count: () => watched.size,
        running: () => Array.from(watched).filter(f => isReal(f.getAttribute('src'))).length
    };
})();
