// CONFIG
const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQGVQ28mEJ6gBvtT_O7N7sXxw61Kmw9AIbGGyhpJAnHRqh9xZ9dWUbk6w3ly_gI2782pv86GiBnLj3/pub?gid=0&single=true&output=csv";

// STATE
let methodologies = [];
let isLoaded = false;
const filters = { type: '', format: '', category: '' };

// ИЗМЕНЕНО: Словарь для перевода категорий
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

// Modal Elements
const modalBackdrop = document.getElementById('modal-backdrop');
const modalTitle = document.getElementById('modal-title');
const modalAuthor = document.getElementById('modal-author');
const modalAuthorInitial = document.getElementById('modal-author-initial');
const modalDesc = document.getElementById('modal-desc');

// --- APP START ---
async function initApp() {
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        if (!response.ok) throw new Error("Network response was not ok");
        const dataText = await response.text();
        methodologies = parseCSV(dataText);
        isLoaded = true;
        loaderEl.classList.add('hidden');

        filterTypeSelect.value = '';
        filterFormatSelect.value = '';
        filterCategorySelect.value = '';

        checkFiltersAndRender();
    } catch (error) {
        console.error("Error:", error);
        loaderEl.classList.add('hidden');
        document.getElementById('error-message').classList.remove('hidden');
    }
}

function parseCSV(text) {
    const arr = [];
    let quote = false;
    let col = 0, row = 0;

    for (let c = 0; c < text.length; c++) {
        let cc = text[c], nc = text[c+1];
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

    if(arr.length === 0) return [];
    const headers = arr[0].map(h => h.trim());
    return arr.slice(1).filter(r => r.length === headers.length).map(row => {
        return headers.reduce((obj, header, i) => {
            obj[header] = row[i];
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

btnLeft.addEventListener('click', () => cardsSliderEl.scrollBy({ left: -340, behavior: 'smooth' }));
btnRight.addEventListener('click', () => cardsSliderEl.scrollBy({ left: 340, behavior: 'smooth' }));

function checkFiltersAndRender() {
    if (!isLoaded) return;
    const isAtLeastOneSelected = filters.type !== '' || filters.format !== '' || filters.category !== '';

    if (!isAtLeastOneSelected) {
        lockedDeckEl.classList.remove('hidden');
        sliderWrapperEl.classList.add('hidden');
        noResultsEl.classList.add('hidden');
    } else {
        lockedDeckEl.classList.add('hidden');
        filterAndRenderCards();
    }
}

function filterAndRenderCards() {
    let filteredData = methodologies.filter(item => {
        const iType = (item.type || '').toLowerCase();
        const iFormat = (item.format || '').toLowerCase();
        const iCategory = (item.category || '').toLowerCase();

        const matchType = filters.type === '' ? true : iType.includes(filters.type);
        const matchFormat = filters.format === '' ? true : iFormat.includes(filters.format);
        const matchCategory = filters.category === '' ? true : iCategory.includes(filters.category);

        return matchType && matchFormat && matchCategory;
    });

    cardsSliderEl.innerHTML = '';
    if (filteredData.length === 0) {
        sliderWrapperEl.classList.add('hidden');
        noResultsEl.classList.remove('hidden');
        return;
    }
    noResultsEl.classList.add('hidden');
    sliderWrapperEl.classList.remove('hidden');

    filteredData.forEach(item => {
        const cardElement = createCardElement(item);
        cardsSliderEl.appendChild(cardElement);
    });
}

// --- CARD CREATION ---
function createCardElement(item) {
    const tempDiv = document.createElement('div');
    tempDiv.className = "snap-center flex-shrink-0 w-80 h-96 perspective-1000";

    const title = escapeHtml(item.title || "Без названия");
    const rawCategory = (item.category || "Общее").toLowerCase();

    // ИЗМЕНЕНО: Получаем русское название из мапы или оставляем как есть
    const categoryDisplay = categoryMap[rawCategory] || item.category || "Общее";
    const desc = escapeHtml(item.desc || "");

    // ИЗМЕНЕНО: Новая верстка карточки
    // - categoryDisplay сверху
    // - text-white, text-2xl, font-extrabold для заголовка
    // - фон уже задан в CSS (.card-front)
    tempDiv.innerHTML = `
        <div class="card-inner">
            <div class="card-front p-6 text-center relative">
                <div class="absolute top-6 left-0 w-full flex justify-center px-4">
                     <span class="inline-block px-3 py-1 bg-white bg-opacity-10 backdrop-blur-sm border border-white border-opacity-20 text-white text-xs rounded-full font-medium shadow-sm truncate max-w-full">
                        ${categoryDisplay}
                    </span>
                </div>

                <h3 class="text-2xl font-extrabold text-white mb-2 line-clamp-6 mt-8 drop-shadow-md">
                    ${title}
                </h3>

                <div class="mt-auto text-bordeaux-100 text-xs animate-pulse opacity-80">
                    Нажмите, чтобы перевернуть
                </div>
            </div>

            <div class="card-back">
                <div class="flex-grow overflow-hidden relative">
                    <div class="absolute inset-0 bg-gradient-to-b from-transparent to-bordeaux-800 pointer-events-none"></div>
                    <p class="text-sm leading-relaxed opacity-90 line-clamp-6">${desc}</p>
                </div>
                <button class="view-full-btn mt-4 w-full py-2 bg-white text-bordeaux-900 rounded-lg font-bold hover:bg-bordeaux-50 transition shadow-sm">
                    Подробнее
                </button>
            </div>
        </div>
    `;

    const cardElement = tempDiv;
    const inner = cardElement.querySelector('.card-inner');

    cardElement.addEventListener('click', function() {
        inner.classList.toggle('is-flipped');
    });

    const viewBtn = cardElement.querySelector('.view-full-btn');
    if(viewBtn) {
        viewBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            openModal(item);
        });
    }

    return cardElement;
}

// --- MODAL FUNCTIONS ---
function openModal(item) {
    modalTitle.textContent = item.title || 'Без названия';
    modalAuthor.textContent = item.author || 'Неизвестен';
    const authorName = item.author || 'A';
    modalAuthorInitial.textContent = authorName.charAt(0).toUpperCase();
    modalDesc.textContent = item.desc || '';

    modalBackdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modalBackdrop.classList.add('hidden');
    document.body.style.overflow = '';
}

modalBackdrop.addEventListener('click', function(e) {
    if (e.target === modalBackdrop) closeModal();
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !modalBackdrop.classList.contains('hidden')) closeModal();
});

initApp();