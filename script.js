// --- APP LOGIC ---

// CONFIG
const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQGVQ28mEJ6gBvtT_O7N7sXxw61Kmw9AIbGGyhpJAnHRqh9xZ9dWUbk6w3ly_gI2782pv86GiBnLj3/pub?gid=0&single=true&output=csv";

// STATE
let methodologies = [];
let isLoaded = false;
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

// Modal Elements
const modalBackdrop = document.getElementById('modal-backdrop');
const modalContent = document.getElementById('modal-content');
const modalTitle = document.getElementById('modal-title');
const modalAuthor = document.getElementById('modal-author');
const modalAuthorInitial = document.getElementById('modal-author-initial');
const modalDesc = document.getElementById('modal-desc');
const modalCategoryBadge = document.getElementById('modal-category-badge');

// --- MARKDOWN HELPERS ---

/**
 * Превращает Markdown в безопасный HTML
 * Использует Marked.js для парсинга и DOMPurify для защиты
 */
function renderMarkdown(text) {
    if (!text) return "";
    try {
        // Парсим Markdown
        const rawHtml = marked.parse(text);
        // Очищаем от вредоносного кода (XSS)
        return DOMPurify.sanitize(rawHtml);
    } catch (e) {
        console.error("Markdown parsing error:", e);
        return escapeHtml(text); // Фолбэк на простой текст
    }
}

/**
 * Очищает текст от символов Markdown для превью
 * Удаляет #, *, _ и прочие символы форматирования
 */
function stripMarkdown(text) {
    if (!text) return "";
    // Простой реплейс для основных символов Markdown
    // Убирает заголовки, жирность, курсив, списки, ссылки
    return text
        .replace(/[#*_`~>\[\]]/g, '') // Убираем спецсимволы
        .replace(/\(.*?\)/g, '')       // Убираем ссылки (url)
        .replace(/^\s*-\s+/gm, '');    // Убираем маркеры списков
}

// --- INIT ---
async function initApp() {
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        if (!response.ok) throw new Error("Network response was not ok");
        const dataText = await response.text();
        methodologies = parseCSV(dataText);
        isLoaded = true;

        // Hide loader with animation
        loaderEl.style.opacity = '0';
        setTimeout(() => loaderEl.classList.add('hidden'), 300);

        filterTypeSelect.value = '';
        filterFormatSelect.value = '';
        filterCategorySelect.value = '';

        checkFiltersAndRender();
    } catch (error) {
        console.error("Error fetching data:", error);
        loaderEl.classList.add('hidden');
        document.getElementById('error-message').classList.remove('hidden');
    }
}

// Improved CSV Parser (handles quotes better)
function parseCSV(str) {
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

    // Filter out empty rows and ensure header mapping
    const headers = arr[0].map(h => h.trim());
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

// Scroll functionality
const SCROLL_AMOUNT = 340;
btnLeft.addEventListener('click', () => cardsSliderEl.scrollBy({ left: -SCROLL_AMOUNT, behavior: 'smooth' }));
btnRight.addEventListener('click', () => cardsSliderEl.scrollBy({ left: SCROLL_AMOUNT, behavior: 'smooth' }));

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

    // Add delay for animation effect
    filteredData.forEach((item, index) => {
        const cardElement = createCardElement(item);
        cardElement.style.animationDelay = `${index * 50}ms`;
        cardElement.classList.add('animate-fade-in');
        cardsSliderEl.appendChild(cardElement);
    });
}

// --- CARD CREATION (Click-to-Reveal Style) ---
function createCardElement(item) {
    const cardContainer = document.createElement('div');

    // UPDATED STYLES:
    // - w-72 h-96: Fixed dimensions
    // - relative: For absolute positioning of faces
    // - hover:-translate-y-2: Smooth lift effect for the CARD ITSELF
    cardContainer.className = "snap-center flex-shrink-0 w-72 h-96 relative rounded-2xl shadow-card hover:shadow-2xl transition-all duration-300 ease-out hover:-translate-y-2 cursor-pointer";

    const title = escapeHtml(item.title || "Без названия");
    const rawCategory = (item.category || "Общее").toLowerCase();
    const categoryDisplay = categoryMap[rawCategory] || item.category || "Общее";

    // Use stripped version for preview to avoid ugly markdown symbols
    const descPreview = stripMarkdown(item.desc || "");

    // Structure:
    // 1. Front Side (Bordeaux, Title, Badge)
    // 2. Back Side (White, Desc, Button) - Initially Hidden
    cardContainer.innerHTML = `
        <!-- FRONT SIDE -->
        <div class="card-front absolute inset-0 bg-bordeaux-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center z-10">
            <!-- Decorative circle (subtle) -->
            <div class="absolute -top-16 -right-16 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>

            <!-- Category Badge -->
            <div class="w-full flex justify-center mb-6 relative z-10">
                 <span class="inline-block px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm truncate max-w-full">
                    ${categoryDisplay}
                </span>
            </div>

            <!-- Title -->
            <div class="flex-grow flex items-center justify-center relative z-10">
                <h3 class="text-2xl font-extrabold text-white text-center leading-tight drop-shadow-lg line-clamp-6">
                    ${title}
                </h3>
            </div>

            <!-- Small hint at bottom -->
            <div class="mt-4 text-white/40 text-[10px] uppercase tracking-widest">
                Нажмите
            </div>
        </div>

        <!-- BACK SIDE (Initially Hidden) -->
        <div class="card-back absolute inset-0 bg-white rounded-2xl p-6 flex flex-col hidden z-20 border-2 border-bordeaux-800">
             <!-- Description Container (Top Half, Strict overflow) -->
             <div class="h-[55%] w-full overflow-hidden text-sm text-gray-700 leading-relaxed mb-4 text-left">
                ${escapeHtml(descPreview)}
             </div>

             <!-- Button Container (Bottom Center) -->
             <div class="mt-auto w-full flex justify-center pb-2">
                <button class="view-full-btn px-6 py-2.5 bg-bordeaux-800 hover:bg-bordeaux-900 text-white rounded-full font-bold text-xs uppercase tracking-wide transition-colors shadow-md flex items-center gap-2">
                    <span>Подробнее</span>
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                </button>
            </div>
        </div>
    `;

    // Elements
    const frontSide = cardContainer.querySelector('.card-front');
    const backSide = cardContainer.querySelector('.card-back');
    const viewBtn = cardContainer.querySelector('.view-full-btn');

    // Click handler for the whole card: Toggle Faces
    cardContainer.addEventListener('click', function() {
        if (frontSide.classList.contains('hidden')) {
            // Show Front
            frontSide.classList.remove('hidden');
            backSide.classList.add('hidden');
        } else {
            // Show Back
            frontSide.classList.add('hidden');
            backSide.classList.remove('hidden');
        }
    });

    // Button handler: Open Modal (Stop Propagation to prevent flip back)
    viewBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        openModal(item);
    });

    return cardContainer;
}

// --- MODAL FUNCTIONS ---
function openModal(item) {
    modalTitle.textContent = item.title || 'Без названия';
    modalAuthor.textContent = item.author || 'Неизвестен';

    const authorName = item.author || 'A';
    modalAuthorInitial.textContent = authorName.charAt(0).toUpperCase();

    // Category mapping for modal
    const rawCategory = (item.category || "Общее").toLowerCase();
    modalCategoryBadge.textContent = categoryMap[rawCategory] || item.category || "Общее";

    // ИСПОЛЬЗУЕМ MARKDOWN RENDERER
    // Было: modalDesc.innerHTML = escapeHtml(item.desc || "").replace(/\n/g, '<br>');
    // Стало:
    modalDesc.innerHTML = renderMarkdown(item.desc || "");

    // Show modal logic
    modalBackdrop.classList.remove('hidden');
    // Force reflow
    void modalBackdrop.offsetWidth;

    modalBackdrop.classList.remove('opacity-0');
    modalContent.classList.remove('scale-95', 'opacity-0');
    modalContent.classList.add('scale-100', 'opacity-100');

    document.body.style.overflow = 'hidden';
}

function closeModal() {
    // Hide animation
    modalBackdrop.classList.add('opacity-0');
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        modalBackdrop.classList.add('hidden');
        document.body.style.overflow = '';
    }, 300);
}

// Close on backdrop click
modalBackdrop.addEventListener('click', function(e) {
    if (e.target === modalBackdrop) closeModal();
});

// Close on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !modalBackdrop.classList.contains('hidden')) closeModal();
});

// Start the app
initApp();