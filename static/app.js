/* ============================================================
   Cosmic Comic Studio — Pure Client-Side Edition
   Uses Pollinations.ai directly + HTML5 Canvas for image processing
   No backend required — deploys 100% on Vercel static hosting
   ============================================================ */

// ── Art Style Modifiers ──────────────────────────────────────
const STYLE_MODIFIERS = {
    watercolor: ", watercolor painting, soft pastel colors, children's storybook illustration, textured paper",
    popart: ", retro comic book style, pop art, halftone dot shading, bold black outlines, ink sketch",
    claymation: ", 3d clay model style, stop-motion animation, plasticine textures, cute clay figurine, studio lighting",
    crayon: ", colored pencil drawing, crayon scribble texture, hand-drawn child sketch, warm colors"
};

// ── Pollinations.ai URL builder ──────────────────────────────
function buildPollinationsUrl(prompt, width, height, seed, style) {
    const mod = STYLE_MODIFIERS[style] || '';
    const full = `${prompt}, children's comic book illustration, vibrant colors, clean vector outlines, child-friendly digital art${mod}`;
    const encoded = encodeURIComponent(full);
    return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true&private=true`;
}

// ── Load URL → Canvas (CORS-safe via fetch → blob → canvas) ──
async function loadImageAsCanvas(url) {
    let objectUrl = null;
    try {
        const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
    } catch (_) {
        try {
            const proxyUrl = `/api/image?url=${encodeURIComponent(url)}`;
            const pRes = await fetch(proxyUrl);
            if (!pRes.ok) throw new Error(`Proxy HTTP ${pRes.status}`);
            const blob = await pRes.blob();
            objectUrl = URL.createObjectURL(blob);
        } catch (proxyErr) {
            throw new Error(`Failed to load image. ${proxyErr.message}`);
        }
    }
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            resolve(c);
        };
        img.onerror = () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to render image on canvas.'));
        };
        img.src = objectUrl;
    });
}

// ── Text wrapping helper ──────────────────────────────────────
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);
    return lines;
}

// ── Canvas: apply comic panel styling (border + badge + narration) ──
function applyComicStyle(srcCanvas, narrationText, panelNumber) {
    const BORDER = 12;
    const FONT = 'bold 17px "Comic Neue", "Comic Sans MS", cursive';
    const LINE_H = 22;
    const PAD = 13;

    const W = srcCanvas.width + BORDER * 2;
    const H = srcCanvas.height + BORDER * 2;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');

    // Black border
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(srcCanvas, BORDER, BORDER);

    ctx.font = FONT;

    // Panel # badge (top-left)
    if (panelNumber != null) {
        const label = `PANEL ${panelNumber}`;
        const tw = ctx.measureText(label).width;
        const bw = tw + 16, bh = 26;
        ctx.fillStyle = '#000';
        ctx.fillRect(BORDER, BORDER, bw, bh);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, BORDER + 8, BORDER + 19);
    }

    // Yellow narration box (bottom)
    if (narrationText && narrationText.trim()) {
        const maxW = W - BORDER * 2 - PAD * 2;
        const lines = wrapText(ctx, narrationText, maxW);
        const boxH = LINE_H * lines.length + PAD * 2;
        const bx = BORDER, bw = W - BORDER * 2;
        const by = H - BORDER - boxH;

        ctx.fillStyle = '#FFF9C4';
        ctx.fillRect(bx, by, bw, boxH);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeRect(bx, by, bw, boxH);

        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        let y = by + PAD + LINE_H - 4;
        for (const line of lines) { ctx.fillText(line, W / 2, y); y += LINE_H; }
        ctx.textAlign = 'left';
    }

    return out;
}

// ── Canvas: apply cover page styling ─────────────────────────
function applyCoverStyle(srcCanvas, title, author) {
    const BORDER = 12;
    const W = srcCanvas.width + BORDER * 2;
    const H = srcCanvas.height + BORDER * 2;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(srcCanvas, BORDER, BORDER);

    // Title box — pink, top
    if (title && title.trim()) {
        const TITLE_FONT = 'bold 30px "Comic Neue", "Comic Sans MS", cursive';
        const PAD = 15, LINE_H = 38;
        ctx.font = TITLE_FONT;
        const maxW = W - BORDER * 2 - 20 - PAD * 2;
        const lines = wrapText(ctx, title, maxW);
        const boxH = LINE_H * lines.length + PAD * 2;
        const bx = BORDER + 10, bw = W - BORDER * 2 - 20;
        const by = BORDER + 10;

        ctx.fillStyle = '#FF80AB';
        ctx.fillRect(bx, by, bw, boxH);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeRect(bx, by, bw, boxH);

        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        let y = by + PAD + LINE_H - 8;
        for (const line of lines) { ctx.fillText(line, W / 2, y); y += LINE_H; }
        ctx.textAlign = 'left';
    }

    // Author box — cyan, bottom
    if (author && author.trim()) {
        const AUTHOR_FONT = 'bold 18px "Comic Neue", "Comic Sans MS", cursive';
        const PAD = 10, LINE_H = 24;
        ctx.font = AUTHOR_FONT;
        const text = `Created by ${author}`;
        const maxW = W - BORDER * 2 - 80 - PAD * 2;
        const lines = wrapText(ctx, text, maxW);
        const boxH = LINE_H * lines.length + PAD * 2;
        const bx = BORDER + 40, bw = W - BORDER * 2 - 80;
        const by = H - BORDER - 20 - boxH;

        ctx.fillStyle = '#80DEEA';
        ctx.fillRect(bx, by, bw, boxH);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeRect(bx, by, bw, boxH);

        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        let y = by + PAD + LINE_H - 4;
        for (const line of lines) { ctx.fillText(line, W / 2, y); y += LINE_H; }
        ctx.textAlign = 'left';
    }

    return out;
}

// ── Panel combining ───────────────────────────────────────────
function combineH(canvases) {
    const W = canvases.reduce((s, c) => s + c.width, 0);
    const H = Math.max(...canvases.map(c => c.height));
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    let x = 0;
    for (const c of canvases) { ctx.drawImage(c, x, Math.floor((H - c.height) / 2)); x += c.width; }
    return out;
}

function combineV(canvases) {
    const W = Math.max(...canvases.map(c => c.width));
    const H = canvases.reduce((s, c) => s + c.height, 0);
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    let y = 0;
    for (const c of canvases) { ctx.drawImage(c, Math.floor((W - c.width) / 2), y); y += c.height; }
    return out;
}

function combineGrid(canvases) {
    const [c0, c1, c2, c3] = canvases;
    const w1 = Math.max(c0 ? c0.width : 0, c2 ? c2.width : 0);
    const w2 = Math.max(c1 ? c1.width : 0, c3 ? c3.width : 0);
    const h1 = Math.max(c0 ? c0.height : 0, c1 ? c1.height : 0);
    const h2 = Math.max(c2 ? c2.height : 0, c3 ? c3.height : 0);
    const out = document.createElement('canvas');
    out.width = w1 + w2; out.height = h1 + h2;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, out.width, out.height);
    if (c0) ctx.drawImage(c0, 0, 0);
    if (c1) ctx.drawImage(c1, w1, 0);
    if (c2) ctx.drawImage(c2, 0, h1);
    if (c3) ctx.drawImage(c3, w1, h1);
    return out;
}

// ── Core: generate a comic page (all client-side) ─────────────
async function generateComicPage(page, onProgress) {
    const { panels, layout, width, height, seed, style, isCover, title, author } = page;

    if (isCover) {
        const prompt = panels[0]?.prompt?.trim();
        if (!prompt) throw new Error('Please enter a cover illustration prompt.');
        const coverH = Math.max(16, 16 * Math.floor((width * 1.5) / 16));
        const url = buildPollinationsUrl(prompt, width, coverH, seed, style);
        onProgress?.('Generating cover illustration...');
        const srcCanvas = await loadImageAsCanvas(url);
        onProgress?.('Applying cover styling...');
        const finalCanvas = applyCoverStyle(srcCanvas, title, author);
        return { finalCanvas, panelSourceUrls: [url] };
    }

    // Regular panels
    const activePanels = panels
        .map((p, i) => ({ ...p, index: i }))
        .filter(p => p.prompt?.trim());

    if (activePanels.length === 0) throw new Error('Please enter at least one illustration prompt.');

    const panelSourceUrls = new Array(panels.length).fill(null);
    let done = 0;

    onProgress?.(`Generating ${activePanels.length} panel(s) concurrently...`);

    const panelResults = await Promise.all(activePanels.map(async (panel) => {
        const panelSeed = seed + panel.index;
        const url = buildPollinationsUrl(panel.prompt, width, height, panelSeed, style);
        panelSourceUrls[panel.index] = url;
        const srcCanvas = await loadImageAsCanvas(url);
        const styled = applyComicStyle(srcCanvas, panel.text || '', panel.index + 1);
        done++;
        onProgress?.(`Styled panel ${done}/${activePanels.length}...`);
        return { index: panel.index, canvas: styled };
    }));

    panelResults.sort((a, b) => a.index - b.index);
    const styledCanvases = panelResults.map(r => r.canvas);

    onProgress?.('Composing final layout...');

    let finalCanvas;
    if (styledCanvases.length === 1) {
        finalCanvas = styledCanvases[0];
    } else if (layout === 'vertical') {
        finalCanvas = combineV(styledCanvases);
    } else if (layout === 'grid' && styledCanvases.length >= 4) {
        finalCanvas = combineGrid(styledCanvases);
    } else {
        finalCanvas = combineH(styledCanvases);
    }

    return { finalCanvas, panelSourceUrls };
}

// ── Regenerate composite from stored URLs (for restore after reload) ──
async function regenerateFromUrls(page) {
    const { panelSourceUrls, panels, layout, isCover, title, author } = page;
    if (!panelSourceUrls?.length) return null;

    if (isCover) {
        const url = panelSourceUrls[0];
        if (!url) return null;
        const src = await loadImageAsCanvas(url);
        return applyCoverStyle(src, title, author);
    }

    const active = panelSourceUrls
        .map((url, i) => ({ url, panel: panels[i], index: i }))
        .filter(p => p.url);
    if (!active.length) return null;

    const results = await Promise.all(active.map(async ({ url, panel, index }) => {
        const src = await loadImageAsCanvas(url);
        const styled = applyComicStyle(src, panel?.text || '', index + 1);
        return { index, canvas: styled };
    }));

    results.sort((a, b) => a.index - b.index);
    const canvases = results.map(r => r.canvas);
    if (canvases.length === 1) return canvases[0];
    if (layout === 'vertical') return combineV(canvases);
    if (layout === 'grid' && canvases.length >= 4) return combineGrid(canvases);
    return combineH(canvases);
}

// ── PDF generation using jsPDF ────────────────────────────────
async function downloadPdfBook(compositeDataUrls) {
    if (!compositeDataUrls.length) {
        alert('No generated pages to export!');
        return;
    }

    const { jsPDF } = window.jspdf;
    let doc = null;

    for (let i = 0; i < compositeDataUrls.length; i++) {
        const dataUrl = compositeDataUrls[i];
        const img = await new Promise(res => {
            const im = new Image();
            im.onload = () => res(im);
            im.src = dataUrl;
        });

        const isLandscape = img.width > img.height;
        if (i === 0) {
            doc = new jsPDF({ orientation: isLandscape ? 'l' : 'p', unit: 'mm', format: 'a4' });
        } else {
            doc.addPage('a4', isLandscape ? 'l' : 'p');
        }

        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();
        const ratio = Math.min(pw / img.width, ph / img.height);
        const dw = img.width * ratio, dh = img.height * ratio;
        const dx = (pw - dw) / 2, dy = (ph - dh) / 2;
        doc.addImage(dataUrl, 'PNG', dx, dy, dw, dh);
    }

    if (doc) doc.save(`cosmic_comic_book_${Date.now()}.pdf`);
}

// ════════════════════════════════════════════════════════════════
// Main App
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

    const STORAGE_KEY = 'cosmic_comic_studio_v3';
    const STORAGE_IDX = 'cosmic_comic_idx_v3';

    // DOM refs
    const form = document.getElementById('comic-form');
    const submitBtn = document.getElementById('submit-btn');
    const downloadBtn = document.getElementById('download-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const printBtn = document.getElementById('print-btn');
    const placeholderBox = document.getElementById('placeholder-box');
    const loaderBox = document.getElementById('loader-box');
    const loaderStatusText = document.getElementById('loader-status-text');
    const loaderSubText = document.getElementById('loader-sub-text');
    const comicImg = document.getElementById('comic-img');
    const comicImgWrapper = document.getElementById('comic-img-wrapper');
    const zoomImgBtn = document.getElementById('zoom-img-btn');
    const statusText = document.getElementById('status-text');
    const autosaveText = document.getElementById('autosave-text');
    const resetStoryBtn = document.getElementById('reset-story-btn');
    const previewModal = document.getElementById('preview-modal');
    const modalImg = document.getElementById('modal-img');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const pageListContainer = document.getElementById('page-list-container');
    const addPageBtn = document.getElementById('add-page-btn');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageIndicator = document.getElementById('page-indicator');
    const printBookContainer = document.getElementById('print-book-container');
    const coverToggle = document.getElementById('cover-toggle');
    const coverInputsContainer = document.getElementById('cover-inputs-container');
    const coverTitleInput = document.getElementById('cover-title');
    const coverAuthorInput = document.getElementById('cover-author');
    const panelsAccordionContainer = document.getElementById('panels-accordion-container');
    const layoutSelectGroup = document.getElementById('layout-select-group');
    const styleSelect = document.getElementById('style-select');

    // Default template
    const DEFAULT_PAGE = () => ({
        layout: 'horizontal',
        width: 512, height: 512, seed: 42,
        style: 'watercolor',
        isCover: false, title: '', author: '',
        panels: [
            { prompt: "A cute happy green dragon flying in a starry sky over a small village", text: "Once upon a time, there was a little dragon who dreamed of flying to the stars..." },
            { prompt: "A cute green dragon landing in a grassy meadow covered in giant glowing flowers", text: "One day, he discovered a secret magical garden where the flowers glowed in the dark." },
            { prompt: '', text: '' },
            { prompt: '', text: '' }
        ],
        panelSourceUrls: [],  // stored in localStorage
        compositeDataUrl: ''  // in-memory ONLY - not persisted
    });

    let book = [];
    let currentPageIndex = 0;

    // ── State persistence ──────────────────────────────────────
    function saveToStorage() {
        try {
            // Exclude compositeDataUrl from serialization (too large, in-memory only)
            const serializable = book.map(({ compositeDataUrl, ...rest }) => rest);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
            localStorage.setItem(STORAGE_IDX, String(currentPageIndex));
            if (autosaveText) autosaveText.textContent = 'Auto-saved';
        } catch (e) {
            console.warn('[Storage] Save failed:', e);
        }
    }

    function loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Restore with empty compositeDataUrl (will regenerate on display)
                    book = parsed.map(p => ({ compositeDataUrl: '', ...p }));
                    const idx = parseInt(localStorage.getItem(STORAGE_IDX) || '0', 10);
                    currentPageIndex = (idx >= 0 && idx < book.length) ? idx : 0;
                    return;
                }
            }
        } catch (e) {
            console.warn('[Storage] Load failed:', e);
        }
        book = [DEFAULT_PAGE()];
        currentPageIndex = 0;
    }

    // ── Input save/load ─────────────────────────────────────────
    function saveCurrentPageInputs() {
        const page = book[currentPageIndex];
        if (!page) return;
        page.layout = document.getElementById('layout-select').value;
        page.width = parseInt(document.getElementById('panel-width').value, 10) || 512;
        page.height = parseInt(document.getElementById('panel-height').value, 10) || 512;
        page.seed = parseInt(document.getElementById('base-seed').value, 10) || 42;
        page.style = styleSelect.value;
        page.isCover = coverToggle.checked;
        page.title = coverTitleInput.value;
        page.author = coverAuthorInput.value;
        page.panels = [
            { prompt: document.getElementById('p1-prompt').value, text: document.getElementById('p1-text').value },
            { prompt: document.getElementById('p2-prompt').value, text: document.getElementById('p2-text').value },
            { prompt: document.getElementById('p3-prompt').value, text: document.getElementById('p3-text').value },
            { prompt: document.getElementById('p4-prompt').value, text: document.getElementById('p4-text').value }
        ];
    }

    function loadPageInputs(index) {
        const page = book[index];
        if (!page) return;
        document.getElementById('layout-select').value = page.layout || 'horizontal';
        document.getElementById('panel-width').value = page.width || 512;
        document.getElementById('panel-height').value = page.height || 512;
        document.getElementById('base-seed').value = page.seed || 42;
        styleSelect.value = page.style || 'watercolor';
        coverToggle.checked = !!page.isCover;
        coverTitleInput.value = page.title || '';
        coverAuthorInput.value = page.author || '';
        const showCover = !!page.isCover;
        coverInputsContainer.style.display = showCover ? 'flex' : 'none';
        panelsAccordionContainer.style.display = showCover ? 'none' : 'block';
        layoutSelectGroup.style.display = showCover ? 'none' : 'block';
        const pp = page.panels;
        ['p1','p2','p3','p4'].forEach((id, i) => {
            const p = pp[i] || { prompt: '', text: '' };
            document.getElementById(`${id}-prompt`).value = p.prompt || '';
            document.getElementById(`${id}-text`).value = p.text || '';
        });
        // Default open panels 1 & 2
        ['acc-panel-1','acc-panel-2'].forEach(id => document.getElementById(id)?.classList.add('active'));
        ['acc-panel-3','acc-panel-4'].forEach(id => document.getElementById(id)?.classList.remove('active'));
    }

    // ── Render sidebar page list ───────────────────────────────
    function renderPageList() {
        pageListContainer.innerHTML = '';
        book.forEach((page, index) => {
            const item = document.createElement('div');
            item.className = `page-item ${index === currentPageIndex ? 'active' : ''}`;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'page-btn-select';
            const icon = page.isCover ? 'fa-book-open' : 'fa-file-invoice';
            const label = page.isCover ? 'Cover Page' : `Page ${index + 1}`;
            btn.innerHTML = `<i class="fa-solid ${icon}"></i><span>${label}</span>`;

            const badge = document.createElement('span');
            const hasImage = page.compositeDataUrl || (page.panelSourceUrls && page.panelSourceUrls.some(Boolean));
            badge.className = `page-status-badge ${hasImage ? 'badge-ready' : 'badge-pending'}`;
            badge.innerHTML = hasImage ? `<i class="fa-solid fa-check"></i> Ready` : 'Draft';
            btn.appendChild(badge);

            btn.addEventListener('click', () => {
                saveCurrentPageInputs();
                currentPageIndex = index;
                renderPageList();
                loadPageInputs(index);
                updateWorkspaceView();
                saveToStorage();
            });
            item.appendChild(btn);

            if (book.length > 1) {
                const del = document.createElement('button');
                del.type = 'button';
                del.className = 'page-delete-btn';
                del.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                del.title = `Delete ${label}`;
                del.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete ${label}?`)) {
                        book.splice(index, 1);
                        if (currentPageIndex >= book.length) currentPageIndex = book.length - 1;
                        renderPageList();
                        loadPageInputs(currentPageIndex);
                        updateWorkspaceView();
                        saveToStorage();
                        statusText.innerHTML = `<i class="fa-solid fa-trash" style="color:var(--color-pink)"></i> Page deleted.`;
                    }
                });
                item.appendChild(del);
            }

            pageListContainer.appendChild(item);
        });
    }

    // ── Update canvas view ─────────────────────────────────────
    function updateWorkspaceView() {
        const page = book[currentPageIndex];
        if (!page) return;

        pageIndicator.textContent = `Page ${currentPageIndex + 1} of ${book.length}`;
        prevPageBtn.disabled = currentPageIndex === 0;
        nextPageBtn.disabled = currentPageIndex === book.length - 1;

        if (page.compositeDataUrl) {
            // Already generated and cached in memory
            showComicImage(page.compositeDataUrl);
        } else if (page.panelSourceUrls?.some(Boolean)) {
            // Has source URLs — restore from them
            showLoader('Restoring your comic page...', 'Re-applying comic styling from saved panel data...');
            regenerateFromUrls(page).then(canvas => {
                if (canvas) {
                    page.compositeDataUrl = canvas.toDataURL('image/png');
                    showComicImage(page.compositeDataUrl);
                    renderPageList();
                } else {
                    showPlaceholder();
                }
            }).catch(() => showPlaceholder());
        } else {
            showPlaceholder();
        }

        const anyGenerated = book.some(p => p.compositeDataUrl || p.panelSourceUrls?.some(Boolean));
        downloadPdfBtn.disabled = !anyGenerated;
        printBtn.disabled = !anyGenerated;
    }

    function showPlaceholder() {
        loaderBox.style.display = 'none';
        comicImgWrapper.style.display = 'none';
        placeholderBox.style.display = 'block';
        downloadBtn.disabled = true;
    }

    function showLoader(status, sub) {
        placeholderBox.style.display = 'none';
        comicImgWrapper.style.display = 'none';
        if (loaderStatusText) loaderStatusText.textContent = status || 'Generating...';
        if (loaderSubText) loaderSubText.textContent = sub || '';
        loaderBox.style.display = 'block';
    }

    function showComicImage(dataUrl) {
        loaderBox.style.display = 'none';
        placeholderBox.style.display = 'none';
        comicImg.src = dataUrl;
        comicImgWrapper.style.display = 'flex';
        downloadBtn.disabled = false;
    }

    // ── Cover toggle ─────────────────────────────────────────
    coverToggle.addEventListener('change', () => {
        const on = coverToggle.checked;
        coverInputsContainer.style.display = on ? 'flex' : 'none';
        panelsAccordionContainer.style.display = on ? 'none' : 'block';
        layoutSelectGroup.style.display = on ? 'none' : 'block';
        if (on && !document.getElementById('p1-prompt').value.trim()) {
            document.getElementById('p1-prompt').value = 'A grand illustration of a dragon, cover art';
        }
        saveCurrentPageInputs();
        saveToStorage();
    });

    // ── Auto-save on input changes ────────────────────────────
    form.querySelectorAll('input, textarea, select').forEach(el => {
        el.addEventListener('input', () => { saveCurrentPageInputs(); saveToStorage(); });
        el.addEventListener('change', () => { saveCurrentPageInputs(); saveToStorage(); });
    });

    // ── Pagination ────────────────────────────────────────────
    prevPageBtn.addEventListener('click', () => {
        if (currentPageIndex > 0) {
            saveCurrentPageInputs();
            currentPageIndex--;
            renderPageList(); loadPageInputs(currentPageIndex); updateWorkspaceView(); saveToStorage();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        if (currentPageIndex < book.length - 1) {
            saveCurrentPageInputs();
            currentPageIndex++;
            renderPageList(); loadPageInputs(currentPageIndex); updateWorkspaceView(); saveToStorage();
        }
    });

    // ── Add page ──────────────────────────────────────────────
    addPageBtn.addEventListener('click', () => {
        saveCurrentPageInputs();
        book.push({ ...DEFAULT_PAGE(), seed: 42 + book.length * 10 });
        currentPageIndex = book.length - 1;
        renderPageList(); loadPageInputs(currentPageIndex); updateWorkspaceView(); saveToStorage();
        statusText.innerHTML = `<i class="fa-solid fa-folder-plus" style="color:var(--color-violet)"></i> Created Page ${book.length}.`;
    });

    // ── Reset ─────────────────────────────────────────────────
    resetStoryBtn.addEventListener('click', () => {
        if (confirm('Start a new story? All current pages will be reset.')) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_IDX);
            book = [DEFAULT_PAGE()];
            currentPageIndex = 0;
            renderPageList(); loadPageInputs(0); updateWorkspaceView(); saveToStorage();
            statusText.innerHTML = `<i class="fa-solid fa-rotate-left" style="color:var(--color-pink)"></i> Started a new story!`;
        }
    });

    // ── Image preview modal ───────────────────────────────────
    zoomImgBtn?.addEventListener('click', () => { modalImg.src = comicImg.src; previewModal.style.display = 'flex'; });
    comicImg.addEventListener('click', () => { modalImg.src = comicImg.src; previewModal.style.display = 'flex'; });
    closeModalBtn?.addEventListener('click', () => { previewModal.style.display = 'none'; });
    previewModal.addEventListener('click', e => { if (e.target === previewModal) previewModal.style.display = 'none'; });

    // ── Form submit: generate page ────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveCurrentPageInputs();

        const page = book[currentPageIndex];
        const hasPrompt = page.panels.some(p => p.prompt?.trim());
        if (!hasPrompt && !page.isCover) {
            alert('Please enter at least one illustration prompt.');
            return;
        }

        // Lock UI
        showLoader('Contacting Pollinations.ai GPU cluster...', 'Generating comic illustrations in parallel...');
        [submitBtn, addPageBtn, prevPageBtn, nextPageBtn, downloadPdfBtn, printBtn].forEach(b => { if (b) b.disabled = true; });
        statusText.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color:var(--color-violet)"></i> Generating Page ${currentPageIndex + 1}...`;

        try {
            const { finalCanvas, panelSourceUrls } = await generateComicPage(page, (msg) => {
                if (loaderStatusText) loaderStatusText.textContent = msg;
            });

            page.panelSourceUrls = panelSourceUrls;
            page.compositeDataUrl = finalCanvas.toDataURL('image/png');
            saveToStorage();

            showComicImage(page.compositeDataUrl);
            submitBtn.disabled = false;
            addPageBtn.disabled = false;
            renderPageList();
            updateWorkspaceView();
            statusText.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--color-emerald)"></i> Page ${currentPageIndex + 1} generated!`;

        } catch (err) {
            console.error('[Comic] Generation error:', err);
            showPlaceholder();
            submitBtn.disabled = false;
            addPageBtn.disabled = false;
            updateWorkspaceView();
            statusText.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color:var(--color-rose)"></i> Error: ${err.message}`;
            alert(`Generation failed: ${err.message}`);
        }
    });

    // ── Download PNG ──────────────────────────────────────────
    downloadBtn.addEventListener('click', () => {
        const dataUrl = book[currentPageIndex]?.compositeDataUrl;
        if (!dataUrl) return;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `comic_page_${currentPageIndex + 1}_${Date.now()}.png`;
        a.click();
    });

    // ── Download PDF ──────────────────────────────────────────
    downloadPdfBtn.addEventListener('click', async () => {
        statusText.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color:var(--color-violet)"></i> Compiling PDF...`;
        downloadPdfBtn.disabled = true;

        // Collect or regenerate composites for all pages that have source URLs
        const composites = [];
        for (const page of book) {
            if (page.compositeDataUrl) {
                composites.push(page.compositeDataUrl);
            } else if (page.panelSourceUrls?.some(Boolean)) {
                try {
                    const canvas = await regenerateFromUrls(page);
                    if (canvas) {
                        page.compositeDataUrl = canvas.toDataURL('image/png');
                        composites.push(page.compositeDataUrl);
                    }
                } catch (e) {
                    console.warn('Could not regenerate page for PDF:', e);
                }
            }
        }

        if (!composites.length) {
            alert('Generate at least one page first!');
            downloadPdfBtn.disabled = false;
            return;
        }

        try {
            await downloadPdfBook(composites);
            statusText.innerHTML = `<i class="fa-solid fa-file-pdf" style="color:var(--color-emerald)"></i> PDF downloaded!`;
        } catch (err) {
            alert(`PDF export failed: ${err.message}`);
            statusText.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color:var(--color-rose)"></i> PDF export failed.`;
        }
        downloadPdfBtn.disabled = false;
    });

    // ── Print ──────────────────────────────────────────────────
    printBtn.addEventListener('click', async () => {
        printBookContainer.innerHTML = '';
        for (const page of book) {
            let dataUrl = page.compositeDataUrl;
            if (!dataUrl && page.panelSourceUrls?.some(Boolean)) {
                try {
                    const canvas = await regenerateFromUrls(page);
                    if (canvas) dataUrl = canvas.toDataURL('image/png');
                } catch (e) { /* skip */ }
            }
            if (dataUrl) {
                const img = document.createElement('img');
                img.src = dataUrl;
                img.className = 'print-page-img';
                printBookContainer.appendChild(img);
            }
        }
        if (!printBookContainer.children.length) {
            alert('Please generate at least one page first.');
            return;
        }
        window.print();
    });

    // ── INIT ──────────────────────────────────────────────────
    loadFromStorage();
    renderPageList();
    loadPageInputs(currentPageIndex);
    updateWorkspaceView();
});
