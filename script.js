/**
 * Interactive Deck Application
 * Refactored for modularity, performance (event delegation), and maintainability.
 */

(function () {
    'use strict';

    // --- CONFIGURATION ---
    const CONFIG = {
        SHEET_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQGVQ28mEJ6gBvtT_O7N7sXxw61Kmw9AIbGGyhpJAnHRqh9xZ9dWUbk6w3ly_gI2782pv86GiBnLj3/pub?gid=0&single=true&output=csv",
        ANIMATION_DELAY_MS: 50,
        SCROLL_AMOUNT: 340,
        CATEGORY_MAP: {
            'involvement': 'Активизация вовлечённости',
            'relations': 'Отношения "преподаватель - студенты"',
            'organisational': 'Организация учебного процесса',
            'ai': 'Искусственный интеллект',
            'progress': 'Оценка прогресса'
        }
    };

    // --- STATE MANAGEMENT ---
    const state = {
        allData: [],
        currentFilteredData: [], // Для поиска внутри списка
        isLoaded: false,
        returnToList: false,
        filters: {
            type: '',
            format: '',
            category: ''
        }
    };

    // --- DOM ELEMENTS ---
    const DOM = {
        filters: {
            type: document.getElementById('filter-type'),
            format: document.getElementById('filter-format'),
            category: document.getElementById('filter-category'),
        },
        deck: {
            locked: document.getElementById('locked-deck'),
            wrapper: document.getElementById('slider-wrapper'),
            container: document.getElementById('cards-slider'),
            noResults: document.getElementById('no-results'),
            loader: document.getElementById('loader'),
            error: document.getElementById('error-message'),
            buttons: {
                left: document.getElementById('slide-left'),
                right: document.getElementById('slide-right'),
                viewList: document.getElementById('view-list-btn'),
            }
        },
        modals: {
            details: {
                backdrop: document.getElementById('modal-backdrop'),
                content: document.getElementById('modal-content'),
                elements: {
                    title: document.getElementById('modal-title'),
                    author: document.getElementById('modal-author'),
                    authorInitial: document.getElementById('modal-author-initial'),
                    desc: document.getElementById('modal-desc'),
                    categoryBadge: document.getElementById('modal-category-badge'),
                }
            },
            list: {
                backdrop: document.getElementById('modal-list-backdrop'),
                content: document.getElementById('modal-list-content'),
                itemsContainer: document.getElementById('modal-list-items'),
                searchInput: document.getElementById('list-search-input'),
            }
        }
    };

    // --- UTILS ---

    const Utils = {
        renderMarkdown(text) {
            if (!text) return "";
            try {
                // Ensure marked and DOMPurify are available globally
                if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
                    return this.escapeHtml(text);
                }
                const rawHtml = marked.parse(text);
                return DOMPurify.sanitize(rawHtml);
            } catch (e) {
                console.error("Markdown parsing error:", e);
                return this.escapeHtml(text);
            }
        },

        stripMarkdown(text) {
            if (!text) return "";
            return text
                .replace(/[#*_`~>\[\]]/g, '')
                .replace(/\(.*?\)/g, '')
                .replace(/^\s*-\s+/gm, '');
        },

        escapeHtml(text) {
            if (!text) return "";
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        },

        parseCSV(str) {
            if (!str || str.trim().length === 0) return [];
            const arr = [];
            let quote = false;
            let col = 0, row = 0;

            for (let c = 0; c < str.length; c++) {
                let cc = str[c], nc = str[c + 1];
                arr[row] = arr[row] || [];
                arr[row][col] = arr[row][col] || '';

                if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }
                if (cc == '"') { quote = !quote; continue; }
                if (cc == ',' && !quote) { ++col; continue; }
                if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }
                if (cc == '\n' && !quote) { ++row; col = 0; continue; }
                if (cc == '\r' && !quote) { ++row; col = 0; continue; }

                arr[row][col] += cc;
            }

            if (arr.length === 0) return [];
            const headersRow = arr[0];
            if (!headersRow || headersRow.length === 0) return [];

            const headers = headersRow.map(h => h.trim());

            return arr.slice(1)
                .filter(r => r.length >= headers.length && r.some(cell => cell.trim() !== ''))
                .map(row => {
                    return headers.reduce((obj, header, i) => {
                        obj[header] = row[i] ? row[i].trim() : '';
                        return obj;
                    }, {});
                });
        },

        getCategoryDisplay(rawCategory) {
            const normalized = (rawCategory || "Общее").toLowerCase();
            return CONFIG.CATEGORY_MAP[normalized] || rawCategory || "Общее";
        }
    };

    // --- HTML TEMPLATES ---

    const Templates = {
        card(item) {
            const title = Utils.escapeHtml(item.title || "Без названия");
            const categoryDisplay = Utils.getCategoryDisplay(item.category);
            const descPreview = Utils.escapeHtml(Utils.stripMarkdown(item.desc || ""));

            return `
            <div class="card-inner relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] origin-center shadow-card group-hover/card:shadow-2xl rounded-2xl">
                <!-- FRONT SIDE -->
                <div class="absolute inset-0 w-full h-full [backface-visibility:hidden] bg-bordeaux-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center z-10 overflow-hidden">
                    <div class="absolute -top-16 -right-16 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>

                    <div class="w-full flex justify-center mb-6 relative z-10">
                         <span class="inline-block px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm truncate max-w-full">
                            ${categoryDisplay}
                        </span>
                    </div>

                    <div class="flex-grow flex items-center justify-center relative z-10">
                        <h3 class="text-2xl font-extrabold text-white text-center leading-tight drop-shadow-lg line-clamp-6">
                            ${title}
                        </h3>
                    </div>

                    <div class="mt-4 text-white/40 text-[10px] uppercase tracking-widest">
                        Нажмите
                    </div>
                </div>

                <!-- BACK SIDE -->
                <div class="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white rounded-2xl p-6 flex flex-col z-20 border-2 border-bordeaux-800 overflow-hidden">
                     <div class="h-[55%] w-full overflow-hidden text-sm text-gray-700 leading-relaxed mb-4 text-left">
                        ${descPreview}
                     </div>

                     <div class="mt-auto w-full flex justify-center pb-2">
                        <button type="button" class="view-full-btn px-6 py-2.5 bg-bordeaux-800 hover:bg-bordeaux-900 text-white rounded-full font-bold text-xs uppercase tracking-wide transition-colors shadow-md flex items-center gap-2">
                            <span>Подробнее</span>
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
            `;
        },

        listItem(item) {
            const title = Utils.escapeHtml(item.title || "Без названия");
            const categoryDisplay = Utils.getCategoryDisplay(item.category);

            return `
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 group">
                <div class="pr-4">
                    <h4 class="text-gray-900 font-bold group-hover:text-bordeaux-800 transition-colors">
                        ${title}
                    </h4>
                </div>
                <span class="flex-shrink-0 self-start sm:self-center inline-block px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded border border-gray-200 group-hover:bg-white group-hover:border-bordeaux-200 group-hover:text-bordeaux-700">
                    ${categoryDisplay}
                </span>
            </div>
            `;
        },

        emptyList() {
            return `
            <div class="p-8 text-center text-gray-500">
                <p>Ничего не найдено</p>
            </div>
            `;
        }
    };

    // --- LOGIC ---

    const Logic = {
        async init() {
            try {
                const response = await fetch(CONFIG.SHEET_URL);
                if (!response.ok) throw new Error("Network response was not ok: " + response.statusText);
                const dataText = await response.text();

                try {
                    state.allData = Utils.parseCSV(dataText);
                } catch (parseError) {
                    console.error("Critical Parsing Error:", parseError);
                    throw new Error("Failed to parse CSV data.");
                }

                state.isLoaded = true;

                DOM.deck.loader.style.opacity = '0';
                setTimeout(() => DOM.deck.loader.classList.add('hidden'), 300);

                // Reset filters UI
                DOM.filters.type.value = '';
                DOM.filters.format.value = '';
                DOM.filters.category.value = '';

                this.checkFiltersAndRender();
            } catch (error) {
                console.error("App Init Error:", error);
                DOM.deck.loader.classList.add('hidden');
                DOM.deck.error.classList.remove('hidden');
            }
        },

        getFilteredData() {
            return state.allData.filter(item => {
                const iType = (item.type || '').toLowerCase();
                const iFormat = (item.format || '').toLowerCase();
                const iCategory = (item.category || '').toLowerCase();

                const matchType = state.filters.type === '' ? true : iType.includes(state.filters.type);
                const matchFormat = state.filters.format === '' ? true : iFormat.includes(state.filters.format);
                const matchCategory = state.filters.category === '' ? true : iCategory.includes(state.filters.category);

                return matchType && matchFormat && matchCategory;
            });
        },

        checkFiltersAndRender() {
            if (!state.isLoaded) return;
            const isAtLeastOneSelected = state.filters.type !== '' || state.filters.format !== '' || state.filters.category !== '';

            if (!isAtLeastOneSelected) {
                DOM.deck.locked.classList.remove('hidden');
                DOM.deck.wrapper.classList.add('hidden');
                DOM.deck.noResults.classList.add('hidden');
                DOM.deck.buttons.viewList.classList.add('hidden');
            } else {
                DOM.deck.locked.classList.add('hidden');
                this.renderDeck();
            }
        },

        renderDeck() {
            const data = this.getFilteredData();

            // Clean container
            DOM.deck.container.innerHTML = '';

            if (data.length === 0) {
                DOM.deck.wrapper.classList.add('hidden');
                DOM.deck.noResults.classList.remove('hidden');
                DOM.deck.buttons.viewList.classList.add('hidden');
                return;
            }

            DOM.deck.noResults.classList.add('hidden');
            DOM.deck.wrapper.classList.remove('hidden');
            DOM.deck.buttons.viewList.classList.remove('hidden');

            const fragment = document.createDocumentFragment();

            data.forEach((item, index) => {
                const cardWrapper = document.createElement('div');
                cardWrapper.className = "snap-center flex-shrink-0 w-72 h-96 perspective-[1000px] cursor-pointer group/card transition-transform duration-300 hover:-translate-y-2";
                cardWrapper.style.animationDelay = `${index * CONFIG.ANIMATION_DELAY_MS}ms`;
                cardWrapper.classList.add('animate-fade-in');

                // Store item index for event delegation retrieval
                cardWrapper.dataset.index = state.allData.indexOf(item);

                cardWrapper.innerHTML = Templates.card(item);
                fragment.appendChild(cardWrapper);
            });

            DOM.deck.container.appendChild(fragment);
        },

        renderList(data) {
            DOM.modals.list.itemsContainer.innerHTML = '';

            if (data.length === 0) {
                DOM.modals.list.itemsContainer.innerHTML = Templates.emptyList();
                return;
            }

            const fragment = document.createDocumentFragment();

            data.forEach(item => {
                const div = document.createElement('div');
                div.className = "p-4 border-b border-gray-100 last:border-0 hover:bg-bordeaux-50 cursor-pointer rounded-lg flex items-center justify-between group transition-colors duration-200";
                div.innerHTML = Templates.listItem(item);

                // Store original index
                div.dataset.index = state.allData.indexOf(item);

                div.addEventListener('click', () => {
                    state.returnToList = true;
                    Modals.closeList(true);
                    Modals.openDetails(item);
                });

                fragment.appendChild(div);
            });

            DOM.modals.list.itemsContainer.appendChild(fragment);
        }
    };

    // --- MODALS ---

    const Modals = {
        openDetails(item) {
            const els = DOM.modals.details.elements;

            els.title.textContent = item.title || 'Без названия';
            els.author.textContent = item.author || 'Неизвестен';

            const authorName = item.author || 'A';
            els.authorInitial.textContent = authorName.charAt(0).toUpperCase();

            els.categoryBadge.textContent = Utils.getCategoryDisplay(item.category);
            els.desc.innerHTML = Utils.renderMarkdown(item.desc || "");

            const m = DOM.modals.details;
            m.backdrop.classList.remove('hidden');
            void m.backdrop.offsetWidth; // Force reflow

            m.backdrop.classList.remove('opacity-0');
            m.content.classList.remove('scale-95', 'opacity-0');
            m.content.classList.add('scale-100', 'opacity-100');

            document.body.style.overflow = 'hidden';
        },

        closeDetails() {
            const m = DOM.modals.details;
            m.backdrop.classList.add('opacity-0');
            m.content.classList.remove('scale-100', 'opacity-100');
            m.content.classList.add('scale-95', 'opacity-0');

            setTimeout(() => {
                m.backdrop.classList.add('hidden');

                if (state.returnToList) {
                    state.returnToList = false;
                    this.openList();
                } else {
                    document.body.style.overflow = '';
                }
            }, 300);
        },

        openList() {
            state.currentFilteredData = Logic.getFilteredData();

            // Reset Input
            DOM.modals.list.searchInput.value = '';

            Logic.renderList(state.currentFilteredData);

            const m = DOM.modals.list;
            m.backdrop.classList.remove('hidden');
            void m.backdrop.offsetWidth;
            m.backdrop.classList.remove('opacity-0');
            m.content.classList.remove('scale-95', 'opacity-0');
            m.content.classList.add('scale-100', 'opacity-100');

            document.body.style.overflow = 'hidden';

            setTimeout(() => {
                m.searchInput.focus();
            }, 100);
        },

        closeList(immediate = false) {
            const m = DOM.modals.list;
            m.backdrop.classList.add('opacity-0');
            m.content.classList.remove('scale-100', 'opacity-100');
            m.content.classList.add('scale-95', 'opacity-0');

            setTimeout(() => {
                m.backdrop.classList.add('hidden');
                if (!state.returnToList) {
                    document.body.style.overflow = '';
                }
            }, immediate ? 0 : 300);
        }
    };

    // --- EVENT LISTENERS ---

    function setupEventListeners() {
        // Filters
        const handleFilter = (key, e) => {
            state.filters[key] = e.target.value;
            Logic.checkFiltersAndRender();
        };

        DOM.filters.type.addEventListener('change', (e) => handleFilter('type', e));
        DOM.filters.format.addEventListener('change', (e) => handleFilter('format', e));
        DOM.filters.category.addEventListener('change', (e) => handleFilter('category', e));

        // Slider Navigation
        DOM.deck.buttons.left.addEventListener('click', () =>
            DOM.deck.container.scrollBy({ left: -CONFIG.SCROLL_AMOUNT, behavior: 'smooth' }));
        DOM.deck.buttons.right.addEventListener('click', () =>
            DOM.deck.container.scrollBy({ left: CONFIG.SCROLL_AMOUNT, behavior: 'smooth' }));

        // Event Delegation for Cards (Performance boost)
        DOM.deck.container.addEventListener('click', (e) => {
            const cardWrapper = e.target.closest('.group\\/card');
            if (!cardWrapper) return;

            const inner = cardWrapper.querySelector('.card-inner');
            const isBtn = e.target.closest('.view-full-btn');

            if (isBtn) {
                e.stopPropagation();
                // Get item data from global store using index
                const index = cardWrapper.dataset.index;
                if (index !== undefined) {
                    Modals.openDetails(state.allData[index]);
                }
            } else {
                // Flip Logic
                inner.classList.toggle('[transform:rotateY(180deg)]');
            }
        });

        // View List Button
        DOM.deck.buttons.viewList.addEventListener('click', () => Modals.openList());

        // Search Input in List
        DOM.modals.list.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                Logic.renderList(state.currentFilteredData);
                return;
            }

            const results = state.currentFilteredData.filter(item => {
                const title = (item.title || "").toLowerCase();
                const desc = (item.desc || "").toLowerCase();
                return title.includes(query) || desc.includes(query);
            });
            Logic.renderList(results);
        });

        // Modals closing
        DOM.modals.details.backdrop.addEventListener('click', (e) => {
            if (e.target === DOM.modals.details.backdrop) Modals.closeDetails();
        });

        // Find close buttons inside modals using closest
        document.addEventListener('click', (e) => {
            // Check for close button in Details Modal
            if (e.target.closest('#modal-content button[onclick*="closeModal"]')) {
                Modals.closeDetails();
            }
            // Check for close button in List Modal
            if (e.target.closest('#modal-list-content button[onclick*="closeListModal"]')) {
                Modals.closeList();
            }
        });

        DOM.modals.list.backdrop.addEventListener('click', (e) => {
            if (e.target === DOM.modals.list.backdrop) Modals.closeList();
        });

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!DOM.modals.details.backdrop.classList.contains('hidden')) Modals.closeDetails();
                if (!DOM.modals.list.backdrop.classList.contains('hidden')) Modals.closeList();
            }
        });
    }

    // Expose close functions globally for the onclick attributes in HTML
    // Note: Ideally we remove onclick from HTML, but for compatibility with existing HTML we keep this bridge.
    window.closeModal = () => Modals.closeDetails();
    window.closeListModal = () => Modals.closeList();

    // --- START ---
    setupEventListeners();
    Logic.init();

})();