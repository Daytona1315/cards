// CONFIG
const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSQGVQ28mEJ6gBvtT_O7N7sXxw61Kmw9AIbGGyhpJAnHRqh9xZ9dWUbk6w3ly_gI2782pv86GiBnLj3/pub?gid=0&single=true&output=csv";

// STATE
let methodologies = [];
let isLoaded = false;
const filters = { type: '', format: '', size: '', category: '' };

// DOM ELEMENTS
const filterTypeSelect = document.getElementById('filter-type');
const filterFormatSelect = document.getElementById('filter-format');
const filterSizeSelect = document.getElementById('filter-size');
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
        filterSizeSelect.value = '';
        filterCategorySelect.value = '';
        checkFiltersAndRender();
    } catch (error) {
        console.error("Error:", error);
        loaderEl.classList.add('hidden');
        document.getElementById('error-message').classList.remove('hidden');
    }
}

function parseCSV(text) {
    const rows = text.split('\n').map(row => row.trim()).filter(row => row.length > 0);
    const headers = rows[0].split(',').map(h => h.trim());
    const result = [];
    for (let i = 1; i < rows.length; i++) {
        const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        const values = rows[i].split(regex).map(val => val.replace(/^"|"$/g, '').trim());
        if (values.length === headers.length) {
            const obj = {};
            headers.forEach((header, index) => obj[header] = values[index]);
            result.push(obj);
        }
    }
    return result;
}

// --- FILTERING ---
function handleFilterChange(key, event) {
    filters[key] = event.target.value;
    checkFiltersAndRender();
}

filterTypeSelect.addEventListener('change', (e) => handleFilterChange('type', e));
filterFormatSelect.addEventListener('change', (e) => handleFilterChange('format', e));
filterSizeSelect.addEventListener('change', (e) => handleFilterChange('size', e));
filterCategorySelect.addEventListener('change', (e) => handleFilterChange('category', e));

btnLeft.addEventListener('click', () => cardsSliderEl.scrollBy({ left: -340, behavior: 'smooth' }));
btnRight.addEventListener('click', () => cardsSliderEl.scrollBy({ left: 340, behavior: 'smooth' }));

function checkFiltersAndRender() {
    if (!isLoaded) return;
    const isAtLeastOneSelected = filters.type !== '' || filters.format !== '' || filters.size !== '' || filters.category !== '';

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
        const iSize = (item.size || '').toLowerCase();
        const iCategory = (item.category || '').toLowerCase();
        const matchType = filters.type === '' ? true : iType.includes(filters.type);
        const matchFormat = filters.format === '' ? true : iFormat.includes(filters.format);
        const matchSize = filters.size === '' ? true : iSize.includes(filters.size);
        const matchCategory = filters.category === '' ? true : iCategory.includes(filters.category);
        return matchType && matchFormat && matchSize;
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
    tempDiv.className = "snap-center flex-shrink-0 w-80 h-96";

    const itemJSON = encodeURIComponent(JSON.stringify(item));

    tempDiv.innerHTML = `
`;

    const cardElement = tempDiv;
    const inner = cardElement.querySelector('.card-inner');

    // Flip logic
    cardElement.addEventListener('click', function() {
        inner.classList.toggle('is-flipped');
    });

    // Modal logic (STOP propagation to prevent flip)
    const viewBtn = cardElement.querySelector('.view-full-btn');
    viewBtn.addEventListener('click', function(e) {
        e.stopPropagation(); // Останавливаем всплытие, чтобы карта не перевернулась
        openModal(item);
    });

    return cardElement;
}

// --- MODAL FUNCTIONS ---
function openModal(item) {
    modalTitle.textContent = item.title;
    modalAuthor.textContent = item.author || 'Неизвестен';
    modalAuthorInitial.textContent = (item.author || 'A').charAt(0);
    modalDesc.textContent = item.desc; // Text content preserves newlines via CSS whitespace-pre-wrap

    modalBackdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Блокируем скролл основной страницы
}

function closeModal() {
    modalBackdrop.classList.add('hidden');
    document.body.style.overflow = ''; // Разблокируем скролл
}

// Close on backdrop click
modalBackdrop.addEventListener('click', function(e) {
    if (e.target === modalBackdrop) {
        closeModal();
    }
});

// Close on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !modalBackdrop.classList.contains('hidden')) {
        closeModal();
    }
});

initApp();