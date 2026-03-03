// script.js – separate JavaScript file with persistent table scroll

document.addEventListener('DOMContentLoaded', () => {
    // ---------- populate selects (01..12) ----------
    const firstSelect = document.getElementById('first');
    const secondSelect = document.getElementById('second');
    for (let i = 1; i <= 12; i++) {
        const val = i.toString().padStart(2, '0');
        const option1 = new Option(val, val);
        const option2 = new Option(val, val);
        firstSelect.add(option1);
        secondSelect.add(option2);
    }
    firstSelect.value = '01';
    secondSelect.value = '02';

    // ---------- DOM elements ----------
    const showBtn = document.getElementById('showBtn');
    const resultMessage = document.getElementById('resultMessage');
    const imageContainer = document.getElementById('imageContainer');
    const resultImage = document.getElementById('resultImage');

    // modal elements
    const modalOverlay = document.getElementById('modalOverlay');
    const modalImage = document.getElementById('modalImage');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalWrapper = document.getElementById('modalImageWrapper');

    // custom alert
    const customAlert = document.getElementById('customAlert');
    const alertMessage = document.getElementById('alertMessage');
    const alertOkBtn = document.getElementById('alertOkBtn');

    // tab elements
    const tabSelector = document.getElementById('tabSelectorBtn');
    const tabTable = document.getElementById('tabTableBtn');
    const panelSelector = document.getElementById('selectorPanel');
    const panelTable = document.getElementById('tablePanel');
    const tableContainer = document.getElementById('tableContainer');

    // State to preserve table scroll position
    let tableScrollPosition = 0;
    let tableData = null; // Store the table data to avoid rescanning

    // ---------- helper: hide custom alert ----------
    function hideAlert() {
        customAlert.classList.add('hidden');
    }
    alertOkBtn.addEventListener('click', hideAlert);
    customAlert.addEventListener('click', (e) => {
        if (e.target === customAlert) hideAlert();
    });

    // ---------- show image (or popup) ----------
    function showImageForSelection(firstVal, secondVal) {
        const first = firstVal || firstSelect.value;
        const second = secondVal || secondSelect.value;
        const imagePath = `images/${first}-${second}.jpg`;

        const img = new Image();
        img.onload = () => {
            resultMessage.classList.add('hidden');
            imageContainer.classList.remove('hidden');
            resultImage.src = imagePath;
        };
        img.onerror = () => {
            imageContainer.classList.add('hidden');
            resultMessage.classList.remove('hidden');
            resultMessage.textContent = `❌ no image for ${first}–${second}`;
            alertMessage.textContent = `no available image for ${first}–${second}`;
            customAlert.classList.remove('hidden');
        };
        img.src = imagePath;
    }

    showBtn.addEventListener('click', () => showImageForSelection());
    // initial load with default 01-02
    showImageForSelection('01', '02');

    // ---------- open modal with a given image path ----------
    function openModalWithImage(imagePath) {
        modalImage.src = imagePath;
        modalOverlay.classList.remove('hidden');
        resetZoomAndPan();
    }

    // ---------- click on result image -> open modal ----------
    resultImage.addEventListener('click', () => {
        if (!resultImage.src || resultImage.src.endsWith('undefined')) return;
        openModalWithImage(resultImage.src);
    });

    // ---------- modal zoom & drag (FIXED: zooms toward mouse pointer) ----------
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let startX, startY;

    function resetZoomAndPan() {
        scale = 1;
        translateX = 0;
        translateY = 0;
        applyTransform();
    }

    function applyTransform() {
        // Use transform-origin 0 0 for predictable coordinate math
        modalImage.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    modalWrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // Get mouse position relative to the wrapper
        const rect = modalWrapper.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Old scale
        const oldScale = scale;
        
        // Zoom factor (scroll up = zoom in, down = zoom out)
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(5, Math.max(0.8, scale * delta));
        
        if (oldScale !== newScale) {
            // Calculate world coordinates of mouse before zoom
            const worldX = (mouseX - translateX) / oldScale;
            const worldY = (mouseY - translateY) / oldScale;
            
            // Update scale
            scale = newScale;
            
            // Adjust translate so mouse stays over same world coordinate
            translateX = mouseX - worldX * scale;
            translateY = mouseY - worldY * scale;
            
            applyTransform();
        }
    }, { passive: false });

    modalWrapper.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        modalWrapper.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        applyTransform();
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            modalWrapper.style.cursor = 'grab';
        }
    });

    modalWrapper.addEventListener('dragstart', (e) => e.preventDefault());

    // close modal - return to previous tab with preserved state
    function closeModal() {
        modalOverlay.classList.add('hidden');
        
        // After closing modal, we return to the previously active tab
        // If we came from table tab, we're already there (selector tab was never activated)
        // The tab state is preserved by the click handler that opened the modal
    }
    
    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
            closeModal();
        }
    });

    // ---------- TABLE TAB: show all combos in a 12-column grid ----------
    function buildCombinationsTable() {
        // If we already have table data and it's not stale, render it immediately
        if (tableData) {
            renderTable(tableData);
            // Restore scroll position after rendering
            setTimeout(() => {
                tableContainer.scrollTop = tableScrollPosition;
            }, 10);
            return;
        }

        tableContainer.innerHTML = '<p class="loading-message">scanning images folder...</p>';

        // Create an array of all 144 combinations with a "available" flag
        const allCombos = [];
        for (let i = 1; i <= 12; i++) {
            for (let j = 1; j <= 12; j++) {
                allCombos.push({
                    first: i.toString().padStart(2, '0'),
                    second: j.toString().padStart(2, '0'),
                    available: false // will be updated after checks
                });
            }
        }

        let checkedCount = 0;
        
        // Function to check a single combination
        function checkCombo(index) {
            if (index >= allCombos.length) {
                // All checked, store data and render the table
                tableData = allCombos;
                renderTable(allCombos);
                return;
            }
            
            const combo = allCombos[index];
            const imgPath = `images/${combo.first}-${combo.second}.jpg`;
            
            const img = new Image();
            img.onload = () => {
                combo.available = true;
                checkedCount++;
                checkCombo(index + 1);
            };
            img.onerror = () => {
                combo.available = false;
                checkedCount++;
                checkCombo(index + 1);
            };
            img.src = imgPath;
        }
        
        // Start checking from first combo
        checkCombo(0);
    }

    function renderTable(combos) {
        let html = '<div class="combinations-grid">';
        combos.forEach(c => {
            const availableClass = c.available ? 'available' : 'unavailable';
            html += `
                <div class="combination-card ${availableClass}" 
                     data-first="${c.first}" 
                     data-second="${c.second}" 
                     data-available="${c.available}">
                    <div class="stack-numbers">
                        <span class="top">${c.first}</span>
                        <span class="divider">—</span>
                        <span class="bottom">${c.second}</span>
                    </div>
                    <div class="filename-hint">${c.first}-${c.second}.jpg</div>
                </div>
            `;
        });
        html += '</div>';
        tableContainer.innerHTML = html;

        // Add click handlers to available cards
        document.querySelectorAll('.combination-card.available').forEach(card => {
            card.addEventListener('click', () => {
                const first = card.dataset.first;
                const second = card.dataset.second;
                const imagePath = `images/${first}-${second}.jpg`;
                
                // Save current scroll position before leaving
                tableScrollPosition = tableContainer.scrollTop;
                
                // Open the image in modal directly without switching tabs
                openModalWithImage(imagePath);
                
                // Also update the selector tab's image in background (optional)
                // but don't switch tabs
                const tempImg = new Image();
                tempImg.onload = () => {
                    resultMessage.classList.add('hidden');
                    imageContainer.classList.remove('hidden');
                    resultImage.src = imagePath;
                };
                tempImg.src = imagePath;
            });
        });
    }

    // ---------- tab switching with scroll preservation ----------
    function activateSelectorTab() {
        // Save table scroll position before leaving
        if (!panelTable.classList.contains('hidden')) {
            tableScrollPosition = tableContainer.scrollTop;
        }
        
        tabSelector.classList.add('active');
        tabTable.classList.remove('active');
        panelSelector.classList.remove('hidden');
        panelTable.classList.add('hidden');
    }

    function activateTableTab() {
        // Save selector state if needed (not required for this feature)
        
        tabTable.classList.add('active');
        tabSelector.classList.remove('active');
        panelTable.classList.remove('hidden');
        panelSelector.classList.add('hidden');

        // Build/refresh table when switching to it, but preserve scroll
        buildCombinationsTable();
    }

    tabSelector.addEventListener('click', activateSelectorTab);
    tabTable.addEventListener('click', activateTableTab);
    
    // Save scroll position whenever user scrolls in table container
    tableContainer.addEventListener('scroll', () => {
        if (!panelTable.classList.contains('hidden')) {
            tableScrollPosition = tableContainer.scrollTop;
        }
    });
});