// CONFIG
const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQGVQ28mEJ6gBvtT_O7N7sXxw61Kmw9AIbGGyhpJAnHRqh9xZ9dWUbk6w3ly_gI2782pv86GiBnLj3/pub?gid=0&single=true&output=csv";

// STATE
let methodologies = [];
let isLoaded = false;
// Убрали 'size' из состояния
const filters = { type: '', format: '', category: '' };

// DOM ELEMENTS
const filterTypeSelect = document.getElementById('filter-type');
const filterFormatSelect = document.getElementById('filter-format');
const filterCategorySelect = document.getElementById('filter-category');
// filterSizeSelect удален

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

        // Сброс фильтров
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

// Надежный парсер CSV (RFC 4180 совместимый)
// Обрабатывает запятые и переносы строк внутри кавычек
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

// Защита от XSS (вставка вредоносного кода через Google Таблицу)
function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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
    // Убрали filters.size из проверки
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
        // iSize удален
        const iCategory = (item.category || '').toLowerCase();

        const matchType = filters.type === '' ? true : iType.includes(filters.type);
        const matchFormat = filters.format === '' ? true : iFormat.includes(filters.format);
        // matchSize удален
        const matchCategory = filters.category === '' ? true : iCategory.includes(filters.category);

        // ВАЖНОЕ ИСПРАВЛЕНИЕ: добавили matchCategory в return
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
    tempDiv.className = "snap-center flex-shrink-0 w-80 h-96 perspective-1000"; // Добавили perspective

    // Безопасное получение данных
    const title = escapeHtml(item.title || "Без названия");
    const category = escapeHtml(item.category || "Общее");
    const desc = escapeHtml(item.desc || "");

    // ИСПРАВЛЕНИЕ: Добавлена HTML структура карточки
    tempDiv.innerHTML = `
        <div class="card-inner">
            <div class="card-front p-6 text-center">
                <h3 class="text-xl font-bold text-bordeaux-900 mb-2 line-clamp-6">${title}</h3>
                <span class="inline-block px-3 py-1 bg-bordeaux-100 text-bordeaux-800 text-xs rounded-full font-medium mt-2">${category}</span>
                <div class="mt-auto text-bordeaux-400 text-xs animate-pulse">
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

    // Flip logic
    cardElement.addEventListener('click', function() {
        inner.classList.toggle('is-flipped');
    });

    // Modal logic (STOP propagation to prevent flip)
    const viewBtn = cardElement.querySelector('.view-full-btn');
    if(viewBtn) {
        viewBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Останавливаем всплытие
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