// --- APP LOGIC ---

// CONFIG
const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQGVQ28mEJ6gBvtT_O7N7sXxw61Kmw9AIbGGyhpJAnHRqh9xZ9dWUbk6w3ly_gI2782pv86GiBnLj3/pub?gid=0&single=true&output=csv";

// STATE
let methodologies = [];
let isLoaded = false;
let returnToList = false; // Флаг для возврата в список после просмотра деталей
const filters = { type: '', format: '', category: '' };

const categoryMap = {
    'involvement': 'Активизация вовлечённости',
    'relations': 'Отношения "преподаватель - студенты"',
    'organisational': 'Организация учебного процесса',
    'ai': 'Искусственный интеллект',
    'progress': 'Оценка прогресса'
};

// DOM ELEMENTS
const filterTypeSelect = document.getElementById('filter-type');
const filterFormatSelect = document.getElementById('filter-format');
const filterCategorySelect = document.getElementById('filter-category');

const lockedDeckEl = document.getElementById('locked-deck');
const sliderWrapperEl = document.getElementById('slider-wrapper');
const cardsSliderEl = document.getElementById('cards-slider');
const noResultsEl = document.getElementById('no-results');
const loaderEl = document.getElementById('loader');
const btnLeft = document.getElementById('slide-left');
const btnRight = document.getElementById('slide-right');
const btnViewList = document.getElementById('view-list-btn'); // Новая кнопка

// Modal Elements (Details)
const modalBackdrop = document.getElementById('modal-backdrop');
const modalContent = document.getElementById('modal-content');
const modalTitle = document.getElementById('modal-title');
const modalAuthor = document.getElementById('modal-author');
const modalAuthorInitial = document.getElementById('modal-author-initial');
const modalDesc = document.getElementById('modal-desc');
const modalCategoryBadge = document.getElementById('modal-category-badge');

// Modal Elements (List)
const modalListBackdrop = document.getElementById('modal-list-backdrop');
const modalListContent = document.getElementById('modal-list-content');
const modalListItems = document.getElementById('modal-list-items');

// --- MARKDOWN HELPERS ---
function renderMarkdown(text) {
    if (!text) return "";
    try {
        const rawHtml = marked.parse(text);
        return DOMPurify.sanitize(rawHtml);
    } catch (e) {
        console.error("Markdown parsing error:", e);
        return escapeHtml(text);
    }
}

function stripMarkdown(text) {
    if (!text) return "";
    return text
        .replace(/[#*_`~>\[\]]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/^\s*-\s+/gm, '');
}

// --- INIT ---
async function initApp() {
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        if (!response.ok) throw new Error("Network response was not ok: " + response.statusText);
        const dataText = await response.text();

        try {
            methodologies = parseCSV(dataText);
        } catch (parseError) {
            console.error("Critical Parsing Error:", parseError);
            throw new Error("Failed to parse CSV data.");
        }

        isLoaded = true;

        loaderEl.style.opacity = '0';
        setTimeout(() => loaderEl.classList.add('hidden'), 300);

        filterTypeSelect.value = '';
        filterFormatSelect.value = '';
        filterCategorySelect.value = '';

        checkFiltersAndRender();
    } catch (error) {
        console.error("Application Initialization Error:", error);
        loaderEl.classList.add('hidden');
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
            errorEl.classList.remove('hidden');
        }
    }
}

function parseCSV(str) {
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
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// --- FILTERING ---
function handleFilterChange(key, event) {
    filters[key] = event.target.value;
    checkFiltersAndRender();
}

filterTypeSelect.addEventListener('change', (e) => handleFilterChange('type', e));
filterFormatSelect.addEventListener('change', (e) => handleFilterChange('format', e));
filterCategorySelect.addEventListener('change', (e) => handleFilterChange('category', e));

const SCROLL_AMOUNT = 340;
btnLeft.addEventListener('click', () => cardsSliderEl.scrollBy({ left: -SCROLL_AMOUNT, behavior: 'smooth' }));
btnRight.addEventListener('click', () => cardsSliderEl.scrollBy({ left: SCROLL_AMOUNT, behavior: 'smooth' }));

// Открытие списка по клику на новую кнопку
btnViewList.addEventListener('click', openListModal);

function checkFiltersAndRender() {
    if (!isLoaded) return;
    const isAtLeastOneSelected = filters.type !== '' || filters.format !== '' || filters.category !== '';

    if (!isAtLeastOneSelected) {
        lockedDeckEl.classList.remove('hidden');
        sliderWrapperEl.classList.add('hidden');
        noResultsEl.classList.add('hidden');
        btnViewList.classList.add('hidden'); // Скрываем кнопку списка
    } else {
        lockedDeckEl.classList.add('hidden');
        filterAndRenderCards();
    }
}

// Получение отфильтрованных данных (для повторного использования в списке)
function getFilteredData() {
    return methodologies.filter(item => {
        const iType = (item.type || '').toLowerCase();
        const iFormat = (item.format || '').toLowerCase();
        const iCategory = (item.category || '').toLowerCase();

        const matchType = filters.type === '' ? true : iType.includes(filters.type);
        const matchFormat = filters.format === '' ? true : iFormat.includes(filters.format);
        const matchCategory = filters.category === '' ? true : iCategory.includes(filters.category);

        return matchType && matchFormat && matchCategory;
    });
}

function filterAndRenderCards() {
    const filteredData = getFilteredData();

    cardsSliderEl.innerHTML = '';

    if (filteredData.length === 0) {
        sliderWrapperEl.classList.add('hidden');
        noResultsEl.classList.remove('hidden');
        btnViewList.classList.add('hidden'); // Скрываем кнопку списка
        return;
    }

    noResultsEl.classList.add('hidden');
    sliderWrapperEl.classList.remove('hidden');
    btnViewList.classList.remove('hidden'); // Показываем кнопку списка

    filteredData.forEach((item, index) => {
        const cardElement = createCardElement(item);
        cardElement.style.animationDelay = `${index * 50}ms`;
        cardElement.classList.add('animate-fade-in');
        cardsSliderEl.appendChild(cardElement);
    });
}

function createCardElement(item) {
    const cardContainer = document.createElement('div');
    cardContainer.className = "snap-center flex-shrink-0 w-72 h-96 perspective-[1000px] cursor-pointer group/card transition-transform duration-300 hover:-translate-y-2";

    const title = escapeHtml(item.title || "Без названия");
    const rawCategory = (item.category || "Общее").toLowerCase();
    const categoryDisplay = categoryMap[rawCategory] || item.category || "Общее";
    const descPreview = stripMarkdown(item.desc || "");

    cardContainer.innerHTML = `
        <div class="card-inner relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] origin-center shadow-card group-hover/card:shadow-2xl rounded-2xl">
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
            <div class="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-white rounded-2xl p-6 flex flex-col z-20 border-2 border-bordeaux-800 overflow-hidden">
                 <div class="h-[55%] w-full overflow-hidden text-sm text-gray-700 leading-relaxed mb-4 text-left">
                    ${escapeHtml(descPreview)}
                 </div>
                 <div class="mt-auto w-full flex justify-center pb-2">
                    <button class="view-full-btn px-6 py-2.5 bg-bordeaux-800 hover:bg-bordeaux-900 text-white rounded-full font-bold text-xs uppercase tracking-wide transition-colors shadow-md flex items-center gap-2">
                        <span>Подробнее</span>
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </button>
                </div>
            </div>
        </div>
    `;

    const inner = cardContainer.querySelector('.card-inner');
    const viewBtn = cardContainer.querySelector('.view-full-btn');

    cardContainer.addEventListener('click', function() {
        inner.classList.toggle('[transform:rotateY(180deg)]');
    });

    viewBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        openModal(item);
    });

    return cardContainer;
}

// --- LIST MODAL FUNCTIONS (NEW) ---

function openListModal() {
    const data = getFilteredData();
    modalListItems.innerHTML = '';

    // Рендер элементов списка
    data.forEach(item => {
        const title = escapeHtml(item.title || "Без названия");
        const rawCategory = (item.category || "Общее").toLowerCase();
        const categoryDisplay = categoryMap[rawCategory] || item.category || "Общее";

        const div = document.createElement('div');
        div.className = "p-4 border-b border-gray-100 last:border-0 hover:bg-bordeaux-50 cursor-pointer rounded-lg flex items-center justify-between group transition-colors duration-200";
        div.innerHTML = `
            <div class="pr-4">
                <h4 class="text-gray-900 font-bold group-hover:text-bordeaux-800 transition-colors">${title}</h4>
            </div>
            <span class="flex-shrink-0 inline-block px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded border border-gray-200 group-hover:bg-white group-hover:border-bordeaux-200 group-hover:text-bordeaux-700">
                ${categoryDisplay}
            </span>
        `;

        div.addEventListener('click', () => {
            // "Тактика подмены": Закрываем список, открываем детали, ставим флаг возврата
            returnToList = true;
            closeListModal(true); // true = force immediate close (no animation delay if needed, but we keep it simple)
            openModal(item);
        });

        modalListItems.appendChild(div);
    });

    modalListBackdrop.classList.remove('hidden');
    void modalListBackdrop.offsetWidth;
    modalListBackdrop.classList.remove('opacity-0');
    modalListContent.classList.remove('scale-95', 'opacity-0');
    modalListContent.classList.add('scale-100', 'opacity-100');
    document.body.style.overflow = 'hidden';
}

function closeListModal(immediate = false) {
    modalListBackdrop.classList.add('opacity-0');
    modalListContent.classList.remove('scale-100', 'opacity-100');
    modalListContent.classList.add('scale-95', 'opacity-0');

    // Если "мгновенно" (для свопа), можно уменьшить тайм-аут, но 300мс выглядит плавно
    setTimeout(() => {
        modalListBackdrop.classList.add('hidden');
        if (!returnToList) {
            document.body.style.overflow = '';
        }
    }, 300);
}

// --- DETAILS MODAL FUNCTIONS (UPDATED) ---
function openModal(item) {
    modalTitle.textContent = item.title || 'Без названия';
    modalAuthor.textContent = item.author || 'Неизвестен';

    const authorName = item.author || 'A';
    modalAuthorInitial.textContent = authorName.charAt(0).toUpperCase();

    const rawCategory = (item.category || "Общее").toLowerCase();
    modalCategoryBadge.textContent = categoryMap[rawCategory] || item.category || "Общее";

    modalDesc.innerHTML = renderMarkdown(item.desc || "");

    modalBackdrop.classList.remove('hidden');
    void modalBackdrop.offsetWidth;

    modalBackdrop.classList.remove('opacity-0');
    modalContent.classList.remove('scale-95', 'opacity-0');
    modalContent.classList.add('scale-100', 'opacity-100');

    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modalBackdrop.classList.add('opacity-0');
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        modalBackdrop.classList.add('hidden');

        // ЛОГИКА ВОЗВРАТА В СПИСОК
        if (returnToList) {
            returnToList = false;
            openListModal();
        } else {
            document.body.style.overflow = '';
        }
    }, 300);
}

// Global Event Listeners
modalBackdrop.addEventListener('click', function(e) {
    if (e.target === modalBackdrop) closeModal();
});

modalListBackdrop.addEventListener('click', function(e) {
    if (e.target === modalListBackdrop) closeListModal();
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (!modalBackdrop.classList.contains('hidden')) closeModal();
        if (!modalListBackdrop.classList.contains('hidden')) closeListModal();
    }
});

initApp();