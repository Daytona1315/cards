/**
 * Interactive Deck Application - Optimized Version
 * Features: Data Normalization, Debounced Search, Multiple Categories, Intersection Observer
 */

(function () {
    'use strict';

    // --- CONFIGURATION ---
    const CONFIG = {
        SHEET_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQGVQ28mEJ6gBvtT_O7N7sXxw61Kmw9AIbGGyhpJAnHRqh9xZ9dWUbk6w3ly_gI2782pv86GiBnLj3/pub?gid=0&single=true&output=csv",
        ANIMATION_DELAY_MS: 50,
        SCROLL_AMOUNT: 340,
        SEARCH_DEBOUNCE_MS: 300,
        CATEGORY_MAP: {
            'involvement': 'Активизация вовлечённости',
            'relations': 'Отношения "преподаватель - студенты"',
            'organisational': 'Организация учебного процесса',
            'ai': 'Искусственный интеллект',
            'progress': 'Оценка прогресса',
            'common': 'Общее'
        }
    };

    // --- STATE MANAGEMENT ---
    const state = {
        allData: [], // Содержит нормализованные данные
        currentFilteredData: [],
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
        debounce(fn, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => fn.apply(this, args), wait);
            };
        },

        renderMarkdown(text) {
            if (!text) return "";
            try {
                if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
                    return this.escapeHtml(text);
                }
                const rawHtml = marked.parse(text);
                return DOMPurify.sanitize(rawHtml);
            } catch (e) {
                console.error("Markdown error:", e);
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
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return String(text).replace(/[&<>"']/g, m => map[m]);
        },

        parseCSV(str) {
            if (!str || !str.trim()) return [];
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
                arr[row][col] += cc;
            }
            if (!arr.length) return [];
            const headers = arr[0].map(h => h.trim());
            return arr.slice(1)
                .filter(r => r.length >= headers.length && r.some(cell => cell.trim()))
                .map(row => headers.reduce((obj, h, i) => {
                    obj[h] = row[i] ? row[i].trim() : '';
                    return obj;
                }, {}));
        },

        parseCategories(raw) {
            if (!raw) return ['common'];
            return raw.split(',').map(c => c.trim().toLowerCase()).filter(c => c);
        },

        getCategoryDisplay(key) {
            return CONFIG.CATEGORY_MAP[key] || key || CONFIG.CATEGORY_MAP.common;
        },

        renderBadges(categories, isDark = false) {
            const theme = isDark
                ? "bg-white/10 backdrop-blur-md border border-white/20 text-white"
                : "bg-gray-100 text-gray-500 border-gray-200 group-hover:bg-white group-hover:border-bordeaux-200 group-hover:text-bordeaux-700";
            return categories.map(cat => `
                <span class="inline-block px-2 py-1 ${theme} text-[10px] font-bold uppercase tracking-wider rounded border shadow-sm">
                    ${this.getCategoryDisplay(cat)}
                </span>
            `).join('');
        }
    };

    // --- HTML TEMPLATES ---
    const Templates = {
        card(item) {
            return `
            <div class="card-inner relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] origin-center shadow-card group-hover/card:shadow-2xl rounded-2xl">
                <div class="absolute inset-0 w-full h-full [backface-visibility:hidden] bg-bordeaux-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center z-10 overflow-hidden">
                    <div class="absolute -top-16 -right-16 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
                    <div class="w-full flex flex-wrap justify-center gap-1 mb-6 relative z-10">
                         ${Utils.renderBadges(item._cats, true)}
                    </div>
                    <div class="flex-grow flex items-center justify-center relative z-10">
                        <h3 class="text-2xl font-extrabold text-white text-center leading-tight drop-shadow-lg line-clamp-6">${item._safeTitle}</h3>
                    </div>
                    <div class="mt-4 text-white/40 text-[10px] uppercase tracking-widest">Нажмите</div>
                </div>
                <div class="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white rounded-2xl p-6 flex flex-col z-20 border-2 border-bordeaux-800 overflow-hidden">
                     <div class="h-[55%] w-full overflow-hidden text-sm text-gray-700 leading-relaxed mb-4 text-left">${item._descPreview}</div>
                     <div class="mt-auto w-full flex justify-center pb-2">
                        <button type="button" class="view-full-btn px-6 py-2.5 bg-bordeaux-800 hover:bg-bordeaux-900 text-white rounded-full font-bold text-xs uppercase tracking-wide transition-colors shadow-md flex items-center gap-2">
                            <span>Подробнее</span>
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </button>
                    </div>
                </div>
            </div>`;
        },

        listItem(item) {
            return `
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 group w-full">
                <div class="pr-4">
                    <h4 class="text-gray-900 font-bold group-hover:text-bordeaux-800 transition-colors">${item._safeTitle}</h4>
                </div>
                <div class="flex flex-wrap gap-1 sm:justify-end shrink-0">
                    ${Utils.renderBadges(item._cats, false)}
                </div>
            </div>`;
        }
    };

    // --- LOGIC ---
    const Logic = {
        async init() {
            try {
                const response = await fetch(CONFIG.SHEET_URL);
                const dataText = await response.text();
                const rawData = Utils.parseCSV(dataText);

                // Нормализация данных для производительности
                state.allData = rawData.map(item => ({
                    ...item,
                    _cats: Utils.parseCategories(item.category),
                    _safeTitle: Utils.escapeHtml(item.title || "Без названия"),
                    _descPreview: Utils.escapeHtml(Utils.stripMarkdown(item.desc || ""))
                }));

                state.isLoaded = true;
                DOM.deck.loader.classList.add('hidden');
                this.checkFiltersAndRender();
            } catch (error) {
                console.error("Init Error:", error);
                DOM.deck.loader.classList.add('hidden');
                DOM.deck.error.classList.remove('hidden');
            }
        },

        getFilteredData() {
            return state.allData.filter(item => {
                const matchType = !state.filters.type || (item.type || '').toLowerCase().includes(state.filters.type.toLowerCase());
                const matchFormat = !state.filters.format || (item.format || '').toLowerCase().includes(state.filters.format.toLowerCase());
                const matchCategory = !state.filters.category || item._cats.includes(state.filters.category.toLowerCase());
                return matchType && matchFormat && matchCategory;
            });
        },

        checkFiltersAndRender() {
            const hasFilter = state.filters.type || state.filters.format || state.filters.category;
            if (!hasFilter) {
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

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.remove('opacity-0', 'translate-y-4');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });

            data.forEach((item) => {
                const cardWrapper = document.createElement('div');
                cardWrapper.className = "snap-center flex-shrink-0 w-72 h-96 perspective-[1000px] cursor-pointer group/card transition-all duration-500 opacity-0 translate-y-4";
                cardWrapper.dataset.index = state.allData.indexOf(item);
                cardWrapper.innerHTML = Templates.card(item);
                DOM.deck.container.appendChild(cardWrapper);
                observer.observe(cardWrapper);
            });
        },

        renderList(data) {
            DOM.modals.list.itemsContainer.innerHTML = '';
            if (data.length === 0) {
                DOM.modals.list.itemsContainer.innerHTML = '<div class="p-8 text-center text-gray-500">Ничего не найдено</div>';
                return;
            }

            const fragment = document.createDocumentFragment();
            data.forEach(item => {
                const div = document.createElement('div');
                div.className = "p-4 border-b border-gray-100 last:border-0 hover:bg-bordeaux-50 cursor-pointer rounded-lg transition-colors duration-200";
                div.innerHTML = Templates.listItem(item);
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
            els.title.textContent = item._safeTitle;
            els.author.textContent = item.author || 'Неизвестен';
            els.authorInitial.textContent = (item.author || 'A').charAt(0).toUpperCase();
            els.categoryBadge.innerHTML = Utils.renderBadges(item._cats, false);
            els.desc.innerHTML = Utils.renderMarkdown(item.desc || "");

            const m = DOM.modals.details;
            m.backdrop.classList.remove('hidden');
            setTimeout(() => {
                m.backdrop.classList.remove('opacity-0');
                m.content.classList.remove('scale-95', 'opacity-0');
            }, 10);
            document.body.style.overflow = 'hidden';
        },

        closeDetails() {
            const m = DOM.modals.details;
            m.backdrop.classList.add('opacity-0');
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
            DOM.modals.list.searchInput.value = '';
            Logic.renderList(state.currentFilteredData);
            const m = DOM.modals.list;
            m.backdrop.classList.remove('hidden');
            setTimeout(() => {
                m.backdrop.classList.remove('opacity-0');
                m.content.classList.remove('scale-95', 'opacity-0');
            }, 10);
            document.body.style.overflow = 'hidden';
        },

        closeList(immediate = false) {
            const m = DOM.modals.list;
            m.backdrop.classList.add('opacity-0');
            m.content.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                m.backdrop.classList.add('hidden');
                if (!state.returnToList) document.body.style.overflow = '';
            }, immediate ? 0 : 300);
        }
    };

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        const handleFilter = (key, e) => {
            state.filters[key] = e.target.value;
            Logic.checkFiltersAndRender();
        };

        DOM.filters.type.addEventListener('change', (e) => handleFilter('type', e));
        DOM.filters.format.addEventListener('change', (e) => handleFilter('format', e));
        DOM.filters.category.addEventListener('change', (e) => handleFilter('category', e));

        DOM.deck.buttons.left.addEventListener('click', () => DOM.deck.container.scrollBy({ left: -CONFIG.SCROLL_AMOUNT, behavior: 'smooth' }));
        DOM.deck.buttons.right.addEventListener('click', () => DOM.deck.container.scrollBy({ left: CONFIG.SCROLL_AMOUNT, behavior: 'smooth' }));

        DOM.deck.container.addEventListener('click', (e) => {
            const cardWrapper = e.target.closest('.group\\/card');
            if (!cardWrapper) return;
            const inner = cardWrapper.querySelector('.card-inner');
            if (e.target.closest('.view-full-btn')) {
                Modals.openDetails(state.allData[cardWrapper.dataset.index]);
            } else {
                inner.classList.toggle('[transform:rotateY(180deg)]');
            }
        });

        DOM.deck.buttons.viewList.addEventListener('click', () => Modals.openList());

        DOM.modals.list.searchInput.addEventListener('input', Utils.debounce((e) => {
            const q = e.target.value.toLowerCase().trim();
            const results = state.currentFilteredData.filter(item =>
                item._safeTitle.toLowerCase().includes(q) || (item.desc || "").toLowerCase().includes(q)
            );
            Logic.renderList(results);
        }, CONFIG.SEARCH_DEBOUNCE_MS));

        DOM.modals.details.backdrop.addEventListener('click', (e) => { if (e.target === DOM.modals.details.backdrop) Modals.closeDetails(); });
        DOM.modals.list.backdrop.addEventListener('click', (e) => { if (e.target === DOM.modals.list.backdrop) Modals.closeList(); });

        window.closeModal = () => Modals.closeDetails();
        window.closeListModal = () => Modals.closeList();

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                Modals.closeDetails();
                Modals.closeList();
            }
        });
    }

    setupEventListeners();
    Logic.init();

})();