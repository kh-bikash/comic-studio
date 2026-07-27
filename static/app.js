document.addEventListener('DOMContentLoaded', () => {
    // LocalStorage Keys
    const STORAGE_KEY_BOOK = 'cosmic_comic_book_v2';
    const STORAGE_KEY_INDEX = 'cosmic_comic_current_index_v2';

    // UI Elements
    const form = document.getElementById('comic-form');
    const submitBtn = document.getElementById('submit-btn');
    const downloadBtn = document.getElementById('download-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const printBtn = document.getElementById('print-btn');
    
    const placeholderBox = document.getElementById('placeholder-box');
    const loaderBox = document.getElementById('loader-box');
    const comicImg = document.getElementById('comic-img');
    const comicImgWrapper = document.getElementById('comic-img-wrapper');
    const zoomImgBtn = document.getElementById('zoom-img-btn');
    const statusText = document.getElementById('status-text');
    const autosaveText = document.getElementById('autosave-text');
    const resetStoryBtn = document.getElementById('reset-story-btn');
    
    // Modal Elements
    const previewModal = document.getElementById('preview-modal');
    const modalImg = document.getElementById('modal-img');
    const closeModalBtn = document.getElementById('close-modal-btn');
    
    // Page Manager UI Elements
    const pageListContainer = document.getElementById('page-list-container');
    const addPageBtn = document.getElementById('add-page-btn');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageIndicator = document.getElementById('page-indicator');
    const printBookContainer = document.getElementById('print-book-container');

    // Cover Page Elements
    const coverToggle = document.getElementById('cover-toggle');
    const coverInputsContainer = document.getElementById('cover-inputs-container');
    const coverTitleInput = document.getElementById('cover-title');
    const coverAuthorInput = document.getElementById('cover-author');
    const panelsAccordionContainer = document.getElementById('panels-accordion-container');
    const layoutSelectGroup = document.getElementById('layout-select-group');
    const styleSelect = document.getElementById('style-select');

    // Default Starting Book Template
    const defaultBook = [
        {
            layout: "horizontal",
            width: 512,
            height: 512,
            seed: 42,
            style: "watercolor",
            isCover: false,
            title: "",
            author: "",
            panels: [
                {
                    prompt: "A cute happy green dragon flying in a starry sky over a small village",
                    text: "Once upon a time, there was a little dragon who dreamed of flying to the stars..."
                },
                {
                    prompt: "A cute green dragon landing in a grassy meadow covered in giant glowing flowers",
                    text: "One day, he discovered a secret magical garden where the flowers glowed in the dark."
                },
                { prompt: "", text: "" },
                { prompt: "", text: "" }
            ],
            imageUrl: ""
        }
    ];

    let book = [];
    let currentPageIndex = 0;

    // Load state from localStorage or use defaults
    function initBookState() {
        try {
            const savedBook = localStorage.getItem(STORAGE_KEY_BOOK);
            const savedIndex = localStorage.getItem(STORAGE_KEY_INDEX);
            
            if (savedBook) {
                const parsed = JSON.parse(savedBook);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    book = parsed;
                } else {
                    book = JSON.parse(JSON.stringify(defaultBook));
                }
            } else {
                book = JSON.parse(JSON.stringify(defaultBook));
            }

            if (savedIndex !== null) {
                const idx = parseInt(savedIndex, 10);
                if (!isNaN(idx) && idx >= 0 && idx < book.length) {
                    currentPageIndex = idx;
                } else {
                    currentPageIndex = 0;
                }
            } else {
                currentPageIndex = 0;
            }
        } catch (e) {
            console.warn('[LocalStorage] Could not load saved book state, using defaults:', e);
            book = JSON.parse(JSON.stringify(defaultBook));
            currentPageIndex = 0;
        }
    }

    // Save current book state to localStorage
    function saveStateToLocalStorage() {
        try {
            localStorage.setItem(STORAGE_KEY_BOOK, JSON.stringify(book));
            localStorage.setItem(STORAGE_KEY_INDEX, currentPageIndex.toString());
            
            if (autosaveText) {
                autosaveText.textContent = 'Auto-saved';
            }
        } catch (e) {
            console.error('[LocalStorage] Failed to save state:', e);
        }
    }

    // Cover Page toggle event handler
    coverToggle.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        coverInputsContainer.style.display = isChecked ? 'flex' : 'none';
        panelsAccordionContainer.style.display = isChecked ? 'none' : 'block';
        layoutSelectGroup.style.display = isChecked ? 'none' : 'block';
        
        // Pre-populate panel 1 with default prompt if empty and cover is activated
        const p1PromptVal = document.getElementById('p1-prompt').value.trim();
        if (isChecked && p1PromptVal === "") {
            document.getElementById('p1-prompt').value = "A grand illustration of a green dragon, cover art";
        }
        
        saveCurrentPageInputs();
        saveStateToLocalStorage();
    });

    // Attach reactive input handlers to auto-save as user types/changes inputs
    const formInputElements = form.querySelectorAll('input, textarea, select');
    formInputElements.forEach(elem => {
        elem.addEventListener('input', () => {
            saveCurrentPageInputs();
            saveStateToLocalStorage();
        });
        elem.addEventListener('change', () => {
            saveCurrentPageInputs();
            saveStateToLocalStorage();
        });
    });

    // Initialize UI State
    initBookState();
    renderPageList();
    loadPageInputs(currentPageIndex);
    updateWorkspaceView();

    // Add New Page
    addPageBtn.addEventListener('click', () => {
        saveCurrentPageInputs();
        
        // Push a fresh new page template
        book.push({
            layout: "horizontal",
            width: 512,
            height: 512,
            seed: 42 + book.length * 10,
            style: "watercolor",
            isCover: false,
            title: "",
            author: "",
            panels: [
                { prompt: "", text: "" },
                { prompt: "", text: "" },
                { prompt: "", text: "" },
                { prompt: "", text: "" }
            ],
            imageUrl: ""
        });
        
        currentPageIndex = book.length - 1;
        renderPageList();
        loadPageInputs(currentPageIndex);
        updateWorkspaceView();
        saveStateToLocalStorage();
        
        statusText.innerHTML = `<i class="fa-solid fa-folder-plus" style="color: var(--color-violet);"></i> Created Page ${book.length}.`;
    });

    // Previous Page Navigation
    prevPageBtn.addEventListener('click', () => {
        if (currentPageIndex > 0) {
            saveCurrentPageInputs();
            currentPageIndex--;
            renderPageList();
            loadPageInputs(currentPageIndex);
            updateWorkspaceView();
            saveStateToLocalStorage();
        }
    });

    // Next Page Navigation
    nextPageBtn.addEventListener('click', () => {
        if (currentPageIndex < book.length - 1) {
            saveCurrentPageInputs();
            currentPageIndex++;
            renderPageList();
            loadPageInputs(currentPageIndex);
            updateWorkspaceView();
            saveStateToLocalStorage();
        }
    });

    // Start New Story / Reset All Action
    resetStoryBtn.addEventListener('click', () => {
        if (confirm('Start a new comic story? This will reset all current pages to a fresh template.')) {
            localStorage.removeItem(STORAGE_KEY_BOOK);
            localStorage.removeItem(STORAGE_KEY_INDEX);
            book = JSON.parse(JSON.stringify(defaultBook));
            currentPageIndex = 0;
            renderPageList();
            loadPageInputs(currentPageIndex);
            updateWorkspaceView();
            saveStateToLocalStorage();
            statusText.innerHTML = `<i class="fa-solid fa-rotate-left" style="color: var(--color-pink);"></i> Reset storybook to new template.`;
        }
    });

    // Save inputs of the active page into state object
    function saveCurrentPageInputs() {
        if (!book[currentPageIndex]) return;
        const page = book[currentPageIndex];
        
        page.layout = document.getElementById('layout-select').value;
        page.width = parseInt(document.getElementById('panel-width').value, 10) || 512;
        page.height = parseInt(document.getElementById('panel-height').value, 10) || 512;
        page.seed = parseInt(document.getElementById('base-seed').value, 10) || 42;
        page.style = styleSelect.value;
        page.isCover = coverToggle.checked;
        page.title = coverTitleInput.value;
        page.author = coverAuthorInput.value;
        
        page.panels = [
            {
                prompt: document.getElementById('p1-prompt').value,
                text: document.getElementById('p1-text').value
            },
            {
                prompt: document.getElementById('p2-prompt').value,
                text: document.getElementById('p2-text').value
            },
            {
                prompt: document.getElementById('p3-prompt').value,
                text: document.getElementById('p3-text').value
            },
            {
                prompt: document.getElementById('p4-prompt').value,
                text: document.getElementById('p4-text').value
            }
        ];
    }

    // Load inputs of a selected page into the HTML form
    function loadPageInputs(index) {
        if (!book[index]) return;
        const page = book[index];
        
        document.getElementById('layout-select').value = page.layout || "horizontal";
        document.getElementById('panel-width').value = page.width || 512;
        document.getElementById('panel-height').value = page.height || 512;
        document.getElementById('base-seed').value = page.seed || 42;
        styleSelect.value = page.style || "watercolor";
        
        coverToggle.checked = !!page.isCover;
        coverTitleInput.value = page.title || "";
        coverAuthorInput.value = page.author || "";
        
        // Trigger Layout visibility
        coverInputsContainer.style.display = page.isCover ? 'flex' : 'none';
        panelsAccordionContainer.style.display = page.isCover ? 'none' : 'block';
        layoutSelectGroup.style.display = page.isCover ? 'none' : 'block';
        
        document.getElementById('p1-prompt').value = page.panels[0] ? page.panels[0].prompt : "";
        document.getElementById('p1-text').value = page.panels[0] ? page.panels[0].text : "";
        
        document.getElementById('p2-prompt').value = page.panels[1] ? page.panels[1].prompt : "";
        document.getElementById('p2-text').value = page.panels[1] ? page.panels[1].text : "";
        
        document.getElementById('p3-prompt').value = page.panels[2] ? page.panels[2].prompt : "";
        document.getElementById('p3-text').value = page.panels[2] ? page.panels[2].text : "";
        
        document.getElementById('p4-prompt').value = page.panels[3] ? page.panels[3].prompt : "";
        document.getElementById('p4-text').value = page.panels[3] ? page.panels[3].text : "";
        
        // Open Panel 1 & 2 by default
        const acc1 = document.getElementById('acc-panel-1');
        const acc2 = document.getElementById('acc-panel-2');
        const acc3 = document.getElementById('acc-panel-3');
        const acc4 = document.getElementById('acc-panel-4');
        if (acc1) acc1.classList.add('active');
        if (acc2) acc2.classList.add('active');
        if (acc3) acc3.classList.remove('active');
        if (acc4) acc4.classList.remove('active');
    }

    // Render page items on the sidebar navigator
    function renderPageList() {
        pageListContainer.innerHTML = '';
        book.forEach((page, index) => {
            const pageItem = document.createElement('div');
            pageItem.className = `page-item ${index === currentPageIndex ? 'active' : ''}`;
            
            // Select Page Button
            const selectBtn = document.createElement('button');
            selectBtn.type = 'button';
            selectBtn.className = 'page-btn-select';
            
            const icon = page.isCover ? 'fa-book-open' : 'fa-file-invoice';
            const pageLabel = page.isCover ? 'Cover Page' : `Page ${index + 1}`;
            
            selectBtn.innerHTML = `
                <i class="fa-solid ${icon}"></i>
                <span>${pageLabel}</span>
            `;
            
            // Status Badge
            const statusBadge = document.createElement('span');
            if (page.imageUrl) {
                statusBadge.className = 'page-status-badge badge-ready';
                statusBadge.innerHTML = `<i class="fa-solid fa-check"></i> Ready`;
            } else {
                statusBadge.className = 'page-status-badge badge-pending';
                statusBadge.textContent = `Draft`;
            }
            
            selectBtn.appendChild(statusBadge);

            selectBtn.addEventListener('click', () => {
                saveCurrentPageInputs();
                currentPageIndex = index;
                renderPageList();
                loadPageInputs(currentPageIndex);
                updateWorkspaceView();
                saveStateToLocalStorage();
            });
            
            pageItem.appendChild(selectBtn);
            
            // Delete Page Button (Only if more than 1 page exists)
            if (book.length > 1) {
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'page-delete-btn';
                deleteBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i>`;
                deleteBtn.title = `Delete ${pageLabel}`;
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete ${pageLabel}?`)) {
                        saveCurrentPageInputs();
                        book.splice(index, 1);
                        if (currentPageIndex >= book.length) {
                            currentPageIndex = book.length - 1;
                        }
                        renderPageList();
                        loadPageInputs(currentPageIndex);
                        updateWorkspaceView();
                        saveStateToLocalStorage();
                        statusText.innerHTML = `<i class="fa-solid fa-trash" style="color: var(--color-pink);"></i> Page deleted.`;
                    }
                });
                pageItem.appendChild(deleteBtn);
            }
            
            pageListContainer.appendChild(pageItem);
        });
    }

    // Update Storybook Canvas Workspace based on active page
    function updateWorkspaceView() {
        const page = book[currentPageIndex];
        if (!page) return;
        
        // 1. Update pagination count text
        pageIndicator.textContent = `Page ${currentPageIndex + 1} of ${book.length}`;
        
        // 2. Disable/Enable arrow navigation buttons
        prevPageBtn.disabled = currentPageIndex === 0;
        nextPageBtn.disabled = currentPageIndex === book.length - 1;
        
        // 3. Render image or show placeholder
        if (page.imageUrl) {
            placeholderBox.style.display = 'none';
            loaderBox.style.display = 'none';
            comicImg.src = page.imageUrl.includes('?') ? page.imageUrl : `${page.imageUrl}?t=${new Date().getTime()}`;
            comicImgWrapper.style.display = 'flex';
            downloadBtn.disabled = false;
        } else {
            comicImgWrapper.style.display = 'none';
            loaderBox.style.display = 'none';
            placeholderBox.style.display = 'block';
            downloadBtn.disabled = true;
        }
        
        // 4. Update bulk buttons (Download PDF / Print Book)
        const hasGeneratedPages = book.some(p => p.imageUrl !== '');
        downloadPdfBtn.disabled = !hasGeneratedPages;
        printBtn.disabled = !hasGeneratedPages;
    }

    // Image Zoom / Preview Modal
    function openPreviewModal(imgSrc) {
        if (!imgSrc) return;
        modalImg.src = imgSrc;
        previewModal.style.display = 'flex';
    }

    function closePreviewModal() {
        previewModal.style.display = 'none';
    }

    if (zoomImgBtn) {
        zoomImgBtn.addEventListener('click', () => {
            openPreviewModal(comicImg.src);
        });
    }
    comicImg.addEventListener('click', () => {
        openPreviewModal(comicImg.src);
    });
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closePreviewModal);
    }
    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) {
            closePreviewModal();
        }
    });

    // Form Submission: Generate current page
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveCurrentPageInputs();
        saveStateToLocalStorage();
        
        const page = book[currentPageIndex];
        const hasPrompt = page.panels.some(p => p.prompt.trim() !== '');
        
        if (!hasPrompt) {
            alert('Please enter at least one illustration prompt for the current page.');
            return;
        }
        
        // Toggle loader state
        placeholderBox.style.display = 'none';
        comicImgWrapper.style.display = 'none';
        loaderBox.style.display = 'block';
        
        submitBtn.disabled = true;
        addPageBtn.disabled = true;
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        downloadPdfBtn.disabled = true;
        printBtn.disabled = true;
        
        statusText.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--color-violet);"></i> Generating Page ${currentPageIndex + 1}...`;
        
        const requestBody = {
            panels: page.panels,
            layout: page.layout,
            width: page.width,
            height: page.height,
            seed: page.seed,
            style: page.style,
            is_cover: !!page.isCover,
            title: page.title,
            author: page.author
        };
        
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Save image URL to page state
                page.imageUrl = data.url;
                saveStateToLocalStorage();
                
                comicImg.src = `${page.imageUrl}?t=${new Date().getTime()}`;
                comicImg.onload = () => {
                    loaderBox.style.display = 'none';
                    comicImgWrapper.style.display = 'flex';
                    
                    submitBtn.disabled = false;
                    addPageBtn.disabled = false;
                    renderPageList();
                    updateWorkspaceView();
                    
                    statusText.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--color-emerald);"></i> Page ${currentPageIndex + 1} generated successfully!`;
                };
            } else {
                throw new Error(data.detail || 'An unknown error occurred during generation.');
            }
        } catch (error) {
            console.error('[Client] Page generation error:', error);
            loaderBox.style.display = 'none';
            placeholderBox.style.display = 'block';
            
            submitBtn.disabled = false;
            addPageBtn.disabled = false;
            updateWorkspaceView();
            
            statusText.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color: var(--color-rose);"></i> Generation failed: ${error.message}`;
            alert(`Generation failed: ${error.message}`);
        }
    });

    // Action: Save Current Page Image
    downloadBtn.addEventListener('click', () => {
        const page = book[currentPageIndex];
        if (!page.imageUrl) return;
        
        const link = document.createElement('a');
        link.href = page.imageUrl;
        link.download = `comic_page_${currentPageIndex + 1}_${new Date().getTime()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Action: Download Compiled PDF
    downloadPdfBtn.addEventListener('click', async () => {
        const activeUrls = book.map(p => p.imageUrl).filter(url => url !== '');
        
        if (activeUrls.length === 0) {
            alert('Please generate at least one page before downloading the PDF book!');
            return;
        }
        
        statusText.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color: var(--color-violet);"></i> Compiling PDF book...`;
        downloadPdfBtn.disabled = true;
        
        try {
            const response = await fetch('/api/download_pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: activeUrls })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                const link = document.createElement('a');
                link.href = data.url;
                link.download = `my_comic_book_${new Date().getTime()}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                statusText.innerHTML = `<i class="fa-solid fa-file-pdf" style="color: var(--color-emerald);"></i> PDF compiled and downloaded successfully!`;
            } else {
                throw new Error(data.detail || 'PDF compilation failed.');
            }
        } catch (error) {
            console.error('[Client] PDF compile error:', error);
            alert(`Failed to compile PDF: ${error.message}`);
            statusText.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color: var(--color-rose);"></i> PDF export failed.`;
        } finally {
            downloadPdfBtn.disabled = false;
        }
    });

    // Action: Print Comic Book
    printBtn.addEventListener('click', () => {
        printBookContainer.innerHTML = '';
        
        book.forEach((page) => {
            if (page.imageUrl) {
                const img = document.createElement('img');
                img.src = page.imageUrl;
                img.className = 'print-page-img';
                printBookContainer.appendChild(img);
            }
        });
        
        if (printBookContainer.children.length === 0) {
            alert('Please generate at least one page to print.');
            return;
        }
        
        window.print();
    });
});
