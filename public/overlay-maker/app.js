/**
 * GENTOK - TikTok Overlay Maker
 * Final Stability & Visibility Overhaul (v12)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ---- DATA & CONSTANTS ----
    let GIFT_DATA = [];
    let availableFonts = [];
    let items = [];
    let selectedIndex = null;
    let currentTheme = 'dark-gamer';
    
    // GUARANTEED BRIGHT DEFAULTS
    const SAFE_DEFAULTS = {
        font: "'Anton', sans-serif", fSize: 22, lSpacing: 0,
        isBold: true, isItalic: false, isUpper: true, isUnderline: false, isStrike: false,
        align: 'center', opacity: 100,
        color1: '#ffffff', color2: '#00f2ff', outlineColor: '#000000', outlineWidth: 1.5
    };
    let globalStyle = { ...SAFE_DEFAULTS };

    const GIFTS_API_URL = 'https://api.gentok.fr/tiktok/gift/fr-FR';
    const FONTS_API_URL = 'https://gentok.fr/api/polices/';
    const STORAGE_KEY = 'gentok_overlay_config_v12'; // VERSION 12

    // ---- ELEMENTS ----
    const el = {
        grid: document.getElementById('overlay-grid'),
        colsInput: document.getElementById('grid-columns'),
        totalInput: document.getElementById('grid-total-items'),
        gapInput: document.getElementById('grid-gap'),
        paddingInput: document.getElementById('grid-padding'),
        iconSizeInput: document.getElementById('icon-size'),
        
        tabBtns: document.querySelectorAll('.nav-tab'),
        tabContents: document.querySelectorAll('.tab-content'),
        presetDots: document.querySelectorAll('.preset-dot'),
        captureArea: document.getElementById('capture-area'),
        customBgLayer: document.getElementById('custom-bg-layer'),
        bgOverlayLayer: document.getElementById('bg-overlay-layer'),
        
        fontSelect: document.getElementById('font-family'),
        fontSize: document.getElementById('font-size'),
        letterSpacing: document.getElementById('letter-spacing'),
        textColor1: document.getElementById('text-color-1'),
        textColor2: document.getElementById('text-color-2'),
        outlineColor: document.getElementById('outline-color'),
        outlineWidth: document.getElementById('outline-width'),
        
        btnBold: document.getElementById('btn-bold'),
        btnItalic: document.getElementById('btn-italic'),
        btnUnderline: document.getElementById('btn-underline'),
        btnStrike: document.getElementById('btn-strike'),
        btnUpper: document.getElementById('btn-upper'),
        
        btnAlignLeft: document.getElementById('btn-align-left'),
        btnAlignCenter: document.getElementById('btn-align-center'),
        btnAlignRight: document.getElementById('btn-align-right'),
        
        itemOpacity: document.getElementById('item-opacity'),
        opacityVal: document.getElementById('opacity-val'),
        
        bgUploadTrigger: document.getElementById('bg-upload-trigger'),
        bgFileInput: document.getElementById('bg-file-input'),
        removeBgBtn: document.getElementById('remove-bg-btn'),
        bgDarkness: document.getElementById('bg-darkness'),
        bgBlur: document.getElementById('bg-blur'),
        
        colsVal: document.getElementById('columns-val'),
        gapVal: document.getElementById('gap-val'),
        paddingVal: document.getElementById('padding-val'),
        iconVal: document.getElementById('icon-val'),
        
        exportFormat: document.getElementById('export-format'),
        downloadBtn: document.getElementById('download-btn'),
        resetBtn: document.getElementById('reset-btn'),

        modalContainer: document.getElementById('modal-container'),
        modalHeader: document.getElementById('modal-title'),
        modalGiftView: document.getElementById('modal-gift-view'),
        modalTextView: document.getElementById('modal-text-view'),
        modalGiftLibrary: document.getElementById('modal-gift-library'),
        modalGiftSearch: document.getElementById('modal-gift-search'),
        modalGiftSort: document.getElementById('modal-gift-sort'),
        modalText1: document.getElementById('modal-text-1'),
        modalText2: document.getElementById('modal-text-2'),
        modalBadge: document.getElementById('modal-badge'),
        saveModalText: document.getElementById('save-modal-text'),
        closeModal: document.getElementById('close-modal')
    };

    // ---- INITIALIZATION ----
    async function init() {
        setupEventListeners();
        populateFonts();
        await Promise.all([fetchAllData(), fetchFonts()]);
        
        if (!loadConfig()) {
            resetAllItems();
        }
        
        syncToolbar(); syncDisplays(); renderGrid();
    }

    function resetAllItems() {
        const count = parseInt(el.totalInput.value) || 12;
        items = [];
        for(let i = 0; i < count; i++) {
            const rG = GIFT_DATA[i % GIFT_DATA.length] || null;
            items.push({
                icon: rG ? rG.icon : "https://p16-va.tiktokcdn.com/obj/tiktok-obj/7027546059275010054.png",
                text1: "NOM", text2: "ACTION", badge: "", style: null 
            });
        }
    }

    async function fetchAllData() {
        try {
            const res = await fetch(GIFTS_API_URL);
            const data = await res.json();
            GIFT_DATA = (Array.isArray(data) ? data : (data.gifts || [])).map(g => ({
                id: g.id, name: g.name, icon: g.url ? `https://images.weserv.nl/?url=${encodeURIComponent(g.url.replace(/^https?:\/\//, ''))}` : '', price: g.diamond_count || 0
            }));
            renderModalGiftLibrary();
        } catch (e) {}
    }

    async function fetchFonts() {
        try {
            const res = await fetch(FONTS_API_URL);
            const data = await res.json();
            availableFonts = data.fonts || [];
            populateFonts();
        } catch (e) {}
    }

    function populateFonts() {
        const cur = el.fontSelect.value;
        el.fontSelect.innerHTML = '<option value="\'Inter\', sans-serif">Inter</option>';
        ['Anton', 'Bebas Neue', 'Outfit', 'Luckiest Guy'].forEach(f => {
            const opt = document.createElement('option');
            const val = `'${f}', sans-serif`;
            opt.value = val; opt.textContent = f; opt.style.fontFamily = val;
            el.fontSelect.appendChild(opt);
        });
        availableFonts.forEach(font => {
            const val = `'${font.name}', sans-serif`;
            const opt = document.createElement('option');
            opt.value = val; opt.textContent = font.name; opt.style.fontFamily = val;
            el.fontSelect.appendChild(opt);
            if (!document.getElementById(`f-${font.name}`)) {
                const s = document.createElement('style'); s.id = `f-${font.name}`;
                s.textContent = `@font-face { font-family: '${font.name}'; src: url('${font.url}'); font-display: swap; }`;
                document.head.appendChild(s);
            }
        });
        el.fontSelect.value = cur || globalStyle.font;
    }

    // ---- RENDERING ----
    function renderGrid() {
        el.grid.style.gridTemplateColumns = `repeat(${el.colsInput.value}, 1fr)`;
        el.grid.style.gap = `${el.gapInput.value}px`;
        el.grid.style.padding = `${el.paddingInput.value}px`;
        el.customBgLayer.style.filter = `blur(${el.bgBlur.value}px)`;
        el.bgOverlayLayer.style.backgroundColor = `rgba(0, 0, 0, ${el.bgDarkness.value})`;

        el.grid.innerHTML = '';
        items.forEach((item, index) => {
            const isSel = selectedIndex === index;
            const s = item.style || globalStyle;
            const cell = document.createElement('div');
            cell.className = `overlay-item ${isSel ? 'selected' : ''}`;
            cell.style.opacity = (s.opacity || 100) / 100;
            
            const deco = (s.isUnderline ? 'underline ' : '') + (s.isStrike ? 'line-through' : '');
            const combinedStyle = `
                font-family: ${s.font}; font-size: ${s.fSize}px; letter-spacing: ${s.lSpacing}px;
                font-weight: ${s.isBold ? '900' : 'normal'}; font-style: ${s.isItalic ? 'italic' : 'normal'};
                text-transform: ${s.isUpper ? 'uppercase' : 'none'}; -webkit-text-stroke: ${s.outlineWidth}px ${s.outlineColor};
                text-align: ${s.align || 'center'}; text-decoration: ${deco}; color: ${s.color1};
            `;

            cell.innerHTML = `
                <div class="icon-wrapper">
                    ${item.badge ? `<div class="gift-badge">${item.badge}</div>` : ''}
                    <img src="${item.icon}" class="item-icon" style="height: ${el.iconSizeInput.value}px" crossorigin="anonymous">
                    <div class="edit-hint-icon" title="Cadeau"><i class="fas fa-image"></i></div>
                </div>
                <div class="item-text" style="${combinedStyle}">
                    <span class="t1" style="color: inherit; font-family: inherit; font-size: inherit;">${item.text1}</span>
                    <span class="t2" style="color: ${s.color2}; font-family: inherit; font-size: 0.9em; display: block;">${item.text2}</span>
                    <div class="edit-pencil-icon" title="Texte"><i class="fas fa-pencil-alt"></i></div>
                </div>
            `;

            cell.onclick = (e) => { e.stopPropagation(); selectedIndex = index; syncToolbar(); renderGrid(); };
            cell.querySelector('.edit-pencil-icon').onclick = (e) => { e.stopPropagation(); openModal('text', index); };
            cell.querySelector('.edit-hint-icon').onclick = (e) => { e.stopPropagation(); openModal('gift', index); };
            el.grid.appendChild(cell);
        });
        saveConfig();
        syncDisplays();
    }

    function syncToolbar() {
        const s = (selectedIndex !== null && items[selectedIndex].style) ? items[selectedIndex].style : globalStyle;
        el.fontSelect.value = s.font || SAFE_DEFAULTS.font; 
        el.fontSize.value = s.fSize || 22; 
        el.letterSpacing.value = s.lSpacing || 0;
        el.textColor1.value = s.color1 || '#ffffff'; 
        el.textColor2.value = s.color2 || '#00f2ff'; 
        el.outlineColor.value = s.outlineColor || '#000000'; 
        el.outlineWidth.value = s.outlineWidth ?? 1.5;
        el.itemOpacity.value = s.opacity ?? 100;
        el.opacityVal.innerText = s.opacity ?? 100;

        el.btnBold.classList.toggle('active', !!s.isBold); 
        el.btnItalic.classList.toggle('active', !!s.isItalic); 
        el.btnUnderline.classList.toggle('active', !!s.isUnderline); 
        el.btnStrike.classList.toggle('active', !!s.isStrike); 
        el.btnUpper.classList.toggle('active', !!s.isUpper);
        
        el.btnAlignLeft.classList.toggle('active', s.align === 'left');
        el.btnAlignCenter.classList.toggle('active', s.align === 'center' || !s.align);
        el.btnAlignRight.classList.toggle('active', s.align === 'right');
    }

    function updateStyleFromToolbar() {
        let align = 'center';
        if(el.btnAlignLeft.classList.contains('active')) align = 'left';
        if(el.btnAlignRight.classList.contains('active')) align = 'right';

        const nS = {
            font: el.fontSelect.value, fSize: parseInt(el.fontSize.value), lSpacing: parseInt(el.letterSpacing.value),
            color1: el.textColor1.value, color2: el.textColor2.value, outlineColor: el.outlineColor.value, outlineWidth: parseFloat(el.outlineWidth.value),
            isBold: el.btnBold.classList.contains('active'), 
            isItalic: el.btnItalic.classList.contains('active'), 
            isUnderline: el.btnUnderline.classList.contains('active'), 
            isStrike: el.btnStrike.classList.contains('active'), 
            isUpper: el.btnUpper.classList.contains('active'),
            align: align, opacity: parseInt(el.itemOpacity.value)
        };
        if (selectedIndex !== null) items[selectedIndex].style = nS;
        else globalStyle = nS;
        renderGrid();
    }

    function renderModalGiftLibrary() {
        const query = (el.modalGiftSearch.value || '').toLowerCase();
        let gifts = GIFT_DATA.filter(g => g.name.toLowerCase().includes(query));
        const sort = el.modalGiftSort.value;
        if(sort === 'price-asc') gifts.sort((a,b) => a.price - b.price);
        else if(sort === 'price-desc') gifts.sort((a,b) => b.price - a.price);
        el.modalGiftLibrary.innerHTML = '';
        gifts.forEach(gift => {
            const div = document.createElement('div'); div.className = 'gift-icon-sel';
            div.innerHTML = `<img src="${gift.icon}" crossorigin="anonymous"><div class="gift-price-tag">${gift.price}</div>`;
            div.onclick = () => { if(selectedIndex !== null) { items[selectedIndex].icon = gift.icon; renderGrid(); closeModal(); } };
            el.modalGiftLibrary.appendChild(div);
        });
    }

    function openModal(type, index) {
        selectedIndex = index; el.modalContainer.classList.remove('hidden');
        if (type === 'gift') { el.modalHeader.innerText = "Icône"; el.modalGiftView.classList.remove('hidden'); el.modalTextView.classList.add('hidden'); renderModalGiftLibrary(); }
        else { el.modalHeader.innerText = "Texte"; el.modalGiftView.classList.add('hidden'); el.modalTextView.classList.remove('hidden'); el.modalText1.value = items[index].text1; el.modalText2.value = items[index].text2; el.modalBadge.value = items[index].badge || ""; }
    }

    function closeModal() { el.modalContainer.classList.add('hidden'); }

    function saveConfig() {
        const config = {
            grid: { cols: el.colsInput.value, total: el.totalInput.value, gap: el.gapInput.value, padding: el.paddingInput.value, iconSize: el.iconSizeInput.value },
            theme: { global: globalStyle, darkness: el.bgDarkness.value, blur: el.bgBlur.value, preset: currentTheme },
            items: items, customBg: el.customBgLayer.style.backgroundImage
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }

    function loadConfig() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        try {
            const c = JSON.parse(raw);
            if(c.grid) { el.colsInput.value = c.grid.cols; el.totalInput.value = c.grid.total; el.gapInput.value = c.grid.gap; el.paddingInput.value = c.grid.padding; el.iconSizeInput.value = c.grid.iconSize; }
            if(c.theme) { globalStyle = c.theme.global || globalStyle; el.bgDarkness.value = c.theme.darkness; el.bgBlur.value = c.theme.blur; currentTheme = c.theme.preset; el.captureArea.className = `preview-container ${currentTheme}`; }
            if(c.items) items = c.items;
            if(c.customBg) el.customBgLayer.style.backgroundImage = c.customBg;
            return true;
        } catch (e) { return false; }
    }

    function syncDisplays() {
        el.colsVal.innerText = el.colsInput.value; el.gapVal.innerText = el.gapInput.value + "px"; el.paddingVal.innerText = el.paddingInput.value + "px"; el.iconVal.innerText = el.iconSizeInput.value + "px"; el.opacityVal.innerText = el.itemOpacity.value;
    }

    function setupEventListeners() {
        el.closeModal.onclick = closeModal;
        el.modalGiftSearch.oninput = renderModalGiftLibrary;
        el.modalGiftSort.onchange = renderModalGiftLibrary;
        el.saveModalText.onclick = () => { if(selectedIndex !== null) { items[selectedIndex].text1 = el.modalText1.value; items[selectedIndex].text2 = el.modalText2.value; items[selectedIndex].badge = el.modalBadge.value; renderGrid(); closeModal(); } };
        el.tabBtns.forEach(btn => { btn.onclick = () => { el.tabBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); const t = `${btn.dataset.tab}-tab`; el.tabContents.forEach(c => c.id === t ? c.classList.remove('hidden') : c.classList.add('hidden')); }; });
        [el.colsInput, el.gapInput, el.paddingInput, el.iconSizeInput].forEach(i => i.oninput = renderGrid);
        el.totalInput.onchange = () => { const count = parseInt(el.totalInput.value) || 0; if (count > items.length) { for (let i = items.length; i < count; i++) items.push({ icon: "https://p16-va.tiktokcdn.com/obj/tiktok-obj/7027546059275010054.png", text1: "NOM", text2: "ACTION", badge: "", style: null }); } else items = items.slice(0, count); renderGrid(); };
        
        el.btnBold.onclick = () => { el.btnBold.classList.toggle('active'); updateStyleFromToolbar(); };
        el.btnItalic.onclick = () => { el.btnItalic.classList.toggle('active'); updateStyleFromToolbar(); };
        el.btnUnderline.onclick = () => { el.btnUnderline.classList.toggle('active'); updateStyleFromToolbar(); };
        el.btnStrike.onclick = () => { el.btnStrike.classList.toggle('active'); updateStyleFromToolbar(); };
        el.btnUpper.onclick = () => { el.btnUpper.classList.toggle('active'); updateStyleFromToolbar(); };
        el.btnAlignLeft.onclick = () => { el.btnAlignLeft.classList.add('active'); el.btnAlignCenter.classList.remove('active'); el.btnAlignRight.classList.remove('active'); updateStyleFromToolbar(); };
        el.btnAlignCenter.onclick = () => { el.btnAlignCenter.classList.add('active'); el.btnAlignLeft.classList.remove('active'); el.btnAlignRight.classList.remove('active'); updateStyleFromToolbar(); };
        el.btnAlignRight.onclick = () => { el.btnAlignRight.classList.add('active'); el.btnAlignLeft.classList.remove('active'); el.btnAlignCenter.classList.remove('active'); updateStyleFromToolbar(); };

        el.itemOpacity.oninput = updateStyleFromToolbar;
        [el.fontSelect, el.fontSize, el.letterSpacing, el.textColor1, el.textColor2, el.outlineColor, el.outlineWidth].forEach(i => i.oninput = updateStyleFromToolbar);

        el.presetDots.forEach(dot => {
            dot.onclick = () => {
                el.presetDots.forEach(d => d.classList.remove('active')); dot.classList.add('active');
                currentTheme = dot.dataset.theme; el.captureArea.className = `preview-container ${currentTheme}`;
                if (currentTheme === 'dark-gamer') globalStyle = { ...SAFE_DEFAULTS, font: "'Anton', sans-serif" };
                else if (currentTheme === 'light-agency') globalStyle = { ...SAFE_DEFAULTS, font: "'Outfit', sans-serif", color1: '#1e293b', color2: '#64748b', outlineWidth: 0 };
                else if (currentTheme === 'glass-clean') globalStyle = { ...SAFE_DEFAULTS, font: "'Inter', sans-serif", isBold: false, isUpper: false };
                else if (currentTheme === 'neon-vibe') globalStyle = { ...SAFE_DEFAULTS, font: "'Bebas Neue', cursive", color1: '#00f2ff', color2: '#ff00ff', outlineWidth: 0 };
                items.forEach(it => it.style = null); syncToolbar(); renderGrid();
            };
        });

        [el.bgDarkness, el.bgBlur].forEach(i => i.oninput = renderGrid);
        el.bgUploadTrigger.onclick = () => el.bgFileInput.click();
        el.bgFileInput.onchange = (e) => { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = (ex) => { el.customBgLayer.style.backgroundImage = `url('${ex.target.result}')`; el.removeBgBtn.classList.remove('hidden'); renderGrid(); }; r.readAsDataURL(f); };
        el.removeBgBtn.onclick = () => { el.customBgLayer.style.backgroundImage = ''; el.removeBgBtn.classList.add('hidden'); renderGrid(); };
        el.downloadBtn.onclick = downloadImage;
        el.resetBtn.onclick = () => { if(confirm("RAZ ?")) { localStorage.removeItem(STORAGE_KEY); location.reload(); } };
        document.querySelector('.workspace').onclick = (e) => { if (e.target.classList.contains('workspace')) { selectedIndex = null; syncToolbar(); renderGrid(); } };
    }

    async function downloadImage() {
        const btn = el.downloadBtn; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ...';
        renderGrid(); await new Promise(r => setTimeout(r, 600));
        const format = el.exportFormat.value;
        try { const canvas = await html2canvas(el.captureArea, { backgroundColor: null, scale: 2, useCORS: true, allowTaint: true }); const link = document.createElement('a'); link.href = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.9); link.download = `gentok-canvas-${Date.now()}.${format}`; link.click(); } catch (e) { Swal.fire({ icon: 'error', title: 'Erreur' }); } finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Télécharger'; }
    }
    init();
});
