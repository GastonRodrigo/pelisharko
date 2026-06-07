/* ===================================================
   PeliSharko 🦈 — App Logic
   TMDB API + Search + Watchlist
   =================================================== */

// ─── Config ──────────────────────────────────────────
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';
const POSTER_SIZE = '/w500';
const BACKDROP_SIZE = '/w1280';
const LANG = 'es-ES';
const WATCHLIST_KEY = 'pelisharko_watchlist';
const APIKEY_KEY = 'pelisharko_apikey';

let API_KEY = localStorage.getItem(APIKEY_KEY) || '';

// ─── DOM References ──────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  navbar: $('#navbar'),
  searchInput: $('#search-input'),
  searchClear: $('#search-clear'),
  searchResultsSection: $('#search-results-section'),
  searchResultsGrid: $('#search-results-grid'),
  searchCount: $('#search-count'),
  trendingSection: $('#trending-section'),
  trendingGrid: $('#trending-grid'),
  popularSection: $('#popular-section'),
  popularGrid: $('#popular-grid'),
  topRatedSection: $('#top-rated-section'),
  topRatedGrid: $('#top-rated-grid'),
  viewSearch: $('#view-search'),
  viewWatchlist: $('#view-watchlist'),
  watchlistGrid: $('#watchlist-grid'),
  watchlistEmpty: $('#watchlist-empty'),
  watchlistCount: $('#watchlist-count'),
  watchlistBadge: $('#watchlist-badge'),
  tabSearch: $('#tab-search'),
  tabWatchlist: $('#tab-watchlist'),
  modal: $('#movie-modal'),
  modalContent: $('#modal-content'),
  modalClose: $('#modal-close'),
  modalBackdropImg: $('#modal-backdrop-img'),
  modalPosterImg: $('#modal-poster-img'),
  modalTitle: $('#modal-title'),
  modalOriginalTitle: $('#modal-original-title'),
  modalMeta: $('#modal-meta'),
  modalGenres: $('#modal-genres'),
  modalOverview: $('#modal-overview'),
  modalActions: $('#modal-actions'),
  toastContainer: $('#toast-container'),
  apiSetup: $('#api-setup-section'),
  apiKeyInput: $('#api-key-input'),
  apiKeySave: $('#api-key-save'),
};

// ─── State ───────────────────────────────────────────
let watchlist = loadWatchlist();
let currentView = 'search';
let searchTimeout = null;

// ─── TMDB API ────────────────────────────────────────
async function tmdbFetch(endpoint, params = {}) {
  if (!API_KEY) return null;
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('language', LANG);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('TMDB Error:', err);
    showToast('Error al conectar con TMDB', 'error');
    return null;
  }
}

async function searchMovies(query, page = 1) {
  return tmdbFetch('/search/movie', { query, page, include_adult: 'false' });
}

async function getTrending() {
  return tmdbFetch('/trending/movie/week');
}

async function getPopular() {
  return tmdbFetch('/movie/popular');
}

async function getTopRated() {
  return tmdbFetch('/movie/top_rated');
}

async function getMovieDetails(movieId) {
  return tmdbFetch(`/movie/${movieId}`, { append_to_response: 'credits' });
}

// ─── Watchlist (LocalStorage) ────────────────────────
function loadWatchlist() {
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY)) || [];
  } catch {
    return [];
  }
}

function saveWatchlist() {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  updateWatchlistBadge();
}

function isInWatchlist(movieId) {
  return watchlist.some((m) => m.id === movieId);
}

function addToWatchlist(movie) {
  if (isInWatchlist(movie.id)) return;
  const slim = {
    id: movie.id,
    title: movie.title,
    original_title: movie.original_title,
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    release_date: movie.release_date,
    vote_average: movie.vote_average,
    overview: movie.overview,
    genre_ids: movie.genre_ids || (movie.genres ? movie.genres.map(g => g.id) : []),
    added_at: Date.now(),
  };
  watchlist.unshift(slim);
  saveWatchlist();
  showToast(`"${movie.title}" agregada a tu lista`, 'success');
}

function removeFromWatchlist(movieId) {
  const movie = watchlist.find((m) => m.id === movieId);
  watchlist = watchlist.filter((m) => m.id !== movieId);
  saveWatchlist();
  if (movie) showToast(`"${movie.title}" eliminada de tu lista`, 'error');
}

function updateWatchlistBadge() {
  const count = watchlist.length;
  dom.watchlistBadge.textContent = count;
  dom.watchlistBadge.style.display = count > 0 ? 'flex' : 'none';
}

// ─── Rendering ───────────────────────────────────────
function getPosterUrl(path) {
  return path ? `${IMG_BASE}${POSTER_SIZE}${path}` : null;
}

function getBackdropUrl(path) {
  return path ? `${IMG_BASE}${BACKDROP_SIZE}${path}` : null;
}

function getRatingClass(rating) {
  if (rating >= 7) return 'high';
  if (rating >= 5) return 'medium';
  return 'low';
}

function getYear(dateStr) {
  return dateStr ? dateStr.split('-')[0] : '—';
}

function createMovieCard(movie, context = 'search') {
  const card = document.createElement('div');
  card.className = 'movie-card';
  card.dataset.movieId = movie.id;

  const posterUrl = getPosterUrl(movie.poster_path);
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : null;
  const year = getYear(movie.release_date);
  const saved = isInWatchlist(movie.id);

  let posterHTML;
  if (posterUrl) {
    posterHTML = `<img class="movie-card__poster" src="${posterUrl}" alt="${escapeHtml(movie.title)}" loading="lazy">`;
  } else {
    posterHTML = `
      <div class="movie-card__no-poster">
        <div class="movie-card__no-poster-icon">🎬</div>
        <span>Sin poster</span>
      </div>`;
  }

  let ratingHTML = '';
  if (rating && parseFloat(rating) > 0) {
    ratingHTML = `<span class="movie-card__rating movie-card__rating--${getRatingClass(movie.vote_average)}">⭐ ${rating}</span>`;
  }

  let savedHTML = saved ? `<span class="movie-card__saved">📌</span>` : '';

  let overlayBtns = '';
  if (context === 'watchlist') {
    overlayBtns = `
      <button class="movie-card__overlay-btn movie-card__overlay-btn--info" data-action="detail" data-movie-id="${movie.id}">👁️ Detalle</button>
      <button class="movie-card__overlay-btn movie-card__overlay-btn--danger" data-action="remove" data-movie-id="${movie.id}">🗑️ Quitar</button>`;
  } else {
    overlayBtns = `
      <button class="movie-card__overlay-btn movie-card__overlay-btn--info" data-action="detail" data-movie-id="${movie.id}">👁️ Detalle</button>
      <button class="movie-card__overlay-btn movie-card__overlay-btn--primary" data-action="${saved ? 'remove' : 'add'}" data-movie-id="${movie.id}">
        ${saved ? '✓ Guardada' : '💾 Guardar'}
      </button>`;
  }

  card.innerHTML = `
    <div class="movie-card__poster-wrapper">
      ${posterHTML}
      ${ratingHTML}
      ${savedHTML}
      <div class="movie-card__overlay">
        <div class="movie-card__overlay-actions">
          ${overlayBtns}
        </div>
      </div>
    </div>
    <div class="movie-card__info">
      <div class="movie-card__title">${escapeHtml(movie.title)}</div>
      <div class="movie-card__year">${year}</div>
    </div>`;

  // Event delegation for buttons
  card.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      e.stopPropagation();
      handleCardAction(btn.dataset.action, movie);
      return;
    }
    // Click on card = show detail
    openMovieModal(movie);
  });

  return card;
}

function handleCardAction(action, movie) {
  switch (action) {
    case 'detail':
      openMovieModal(movie);
      break;
    case 'add':
      addToWatchlist(movie);
      refreshCurrentView();
      break;
    case 'remove':
      removeFromWatchlist(movie.id);
      refreshCurrentView();
      break;
  }
}

function renderMovieGrid(container, movies, context = 'search') {
  container.innerHTML = '';
  movies.forEach((movie) => {
    container.appendChild(createMovieCard(movie, context));
  });
}

function renderSkeletons(container, count = 10) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const skel = document.createElement('div');
    skel.className = 'skeleton-card';
    skel.innerHTML = `
      <div class="skeleton-card__poster"></div>
      <div class="skeleton-card__info">
        <div class="skeleton-card__line"></div>
        <div class="skeleton-card__line skeleton-card__line--short"></div>
      </div>`;
    container.appendChild(skel);
  }
}

// ─── Modal ───────────────────────────────────────────
async function openMovieModal(movie) {
  // Show modal immediately with basic info
  dom.modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  const posterUrl = getPosterUrl(movie.poster_path);
  const backdropUrl = getBackdropUrl(movie.backdrop_path);

  dom.modalBackdropImg.src = backdropUrl || '';
  dom.modalBackdropImg.style.display = backdropUrl ? 'block' : 'none';
  dom.modalPosterImg.src = posterUrl || '';
  dom.modalTitle.textContent = movie.title;
  dom.modalOriginalTitle.textContent = movie.original_title !== movie.title ? movie.original_title : '';
  dom.modalOverview.textContent = movie.overview || 'Sin sinopsis disponible.';

  // Basic meta
  const year = getYear(movie.release_date);
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '—';
  dom.modalMeta.innerHTML = `
    <span class="modal__meta-item"><span class="modal__meta-item-icon">📅</span> ${year}</span>
    <span class="modal__meta-item"><span class="modal__meta-item-icon">⭐</span> <span class="modal__rating-value">${rating}</span>/10</span>`;

  // Genres placeholder
  dom.modalGenres.innerHTML = '';

  // Actions
  renderModalActions(movie);

  // Fetch full details from API
  if (API_KEY) {
    const details = await getMovieDetails(movie.id);
    if (details) {
      // Update with full data
      dom.modalOverview.textContent = details.overview || movie.overview || 'Sin sinopsis disponible.';

      if (details.original_title && details.original_title !== details.title) {
        dom.modalOriginalTitle.textContent = details.original_title;
      }

      // Runtime
      const runtime = details.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : '';

      dom.modalMeta.innerHTML = `
        <span class="modal__meta-item"><span class="modal__meta-item-icon">📅</span> ${year}</span>
        <span class="modal__meta-item"><span class="modal__meta-item-icon">⭐</span> <span class="modal__rating-value">${details.vote_average ? details.vote_average.toFixed(1) : '—'}</span>/10</span>
        ${runtime ? `<span class="modal__meta-item"><span class="modal__meta-item-icon">⏱️</span> ${runtime}</span>` : ''}
        ${details.vote_count ? `<span class="modal__meta-item"><span class="modal__meta-item-icon">👥</span> ${details.vote_count.toLocaleString()} votos</span>` : ''}`;

      // Genres
      if (details.genres && details.genres.length) {
        dom.modalGenres.innerHTML = details.genres
          .map((g) => `<span class="modal__genre-tag">${g.name}</span>`)
          .join('');
      }
    }
  }
}

function renderModalActions(movie) {
  const saved = isInWatchlist(movie.id);
  dom.modalActions.innerHTML = '';

  if (saved) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn--danger';
    removeBtn.innerHTML = '🗑️ Quitar de mi lista';
    removeBtn.addEventListener('click', () => {
      removeFromWatchlist(movie.id);
      closeModal();
      refreshCurrentView();
    });
    dom.modalActions.appendChild(removeBtn);
  } else {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn--primary';
    addBtn.innerHTML = '💾 Agregar a mi lista';
    addBtn.addEventListener('click', () => {
      addToWatchlist(movie);
      renderModalActions(movie);
      refreshCurrentView();
    });
    dom.modalActions.appendChild(addBtn);
  }
}

function closeModal() {
  dom.modal.classList.remove('active');
  document.body.style.overflow = '';
}

// ─── Toast Notifications ─────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `
    <span class="toast__icon">${icons[type] || icons.info}</span>
    <span>${escapeHtml(message)}</span>`;

  dom.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ─── Search ──────────────────────────────────────────
function handleSearchInput() {
  const query = dom.searchInput.value.trim();

  // Show/hide clear button
  dom.searchClear.classList.toggle('visible', query.length > 0);

  // Debounce
  clearTimeout(searchTimeout);

  if (!query) {
    dom.searchResultsSection.style.display = 'none';
    dom.trendingSection.style.display = '';
    dom.popularSection.style.display = '';
    dom.topRatedSection.style.display = '';
    return;
  }

  searchTimeout = setTimeout(async () => {
    dom.searchResultsSection.style.display = '';
    dom.trendingSection.style.display = 'none';
    dom.popularSection.style.display = 'none';
    dom.topRatedSection.style.display = 'none';

    renderSkeletons(dom.searchResultsGrid, 10);

    const data = await searchMovies(query);
    if (data && data.results) {
      const results = data.results.filter((m) => m.poster_path || m.overview);
      dom.searchCount.textContent = `(${results.length} resultados)`;
      renderMovieGrid(dom.searchResultsGrid, results);

      if (results.length === 0) {
        dom.searchResultsGrid.innerHTML = `
          <div class="empty-state" style="grid-column: 1/-1;">
            <div class="empty-state__icon">🔍</div>
            <h3 class="empty-state__title">Sin resultados</h3>
            <p class="empty-state__text">No encontramos películas con "${escapeHtml(query)}". Probá con otro título.</p>
          </div>`;
      }
    }
  }, 350);
}

function clearSearch() {
  dom.searchInput.value = '';
  dom.searchClear.classList.remove('visible');
  dom.searchResultsSection.style.display = 'none';
  dom.trendingSection.style.display = '';
  dom.popularSection.style.display = '';
  dom.topRatedSection.style.display = '';
  dom.searchInput.focus();
}

// ─── Navigation ──────────────────────────────────────
function switchTab(tab) {
  currentView = tab;

  $$('.navbar__tab').forEach((t) => t.classList.remove('active'));
  $(`[data-tab="${tab}"]`).classList.add('active');

  dom.viewSearch.classList.toggle('active', tab === 'search');
  dom.viewWatchlist.classList.toggle('active', tab === 'watchlist');

  if (tab === 'watchlist') {
    renderWatchlist();
  }
}

function renderWatchlist() {
  if (watchlist.length === 0) {
    dom.watchlistGrid.style.display = 'none';
    dom.watchlistEmpty.style.display = '';
    dom.watchlistCount.textContent = '';
  } else {
    dom.watchlistGrid.style.display = '';
    dom.watchlistEmpty.style.display = 'none';
    dom.watchlistCount.textContent = `(${watchlist.length})`;
    renderMovieGrid(dom.watchlistGrid, watchlist, 'watchlist');
  }
}

function refreshCurrentView() {
  updateWatchlistBadge();
  if (currentView === 'watchlist') {
    renderWatchlist();
  } else {
    // Re-render search results or trending to update saved states
    const query = dom.searchInput.value.trim();
    if (query) {
      // Re-trigger search to refresh cards
      handleSearchInput();
    } else {
      // Refresh all visible grids
      reRenderVisibleGrids();
    }
  }
}

async function reRenderVisibleGrids() {
  // Re-fetch to update saved indicators
  const [trending, popular, topRated] = await Promise.all([
    getTrending(),
    getPopular(),
    getTopRated(),
  ]);

  if (trending?.results) renderMovieGrid(dom.trendingGrid, trending.results);
  if (popular?.results) renderMovieGrid(dom.popularGrid, popular.results);
  if (topRated?.results) renderMovieGrid(dom.topRatedGrid, topRated.results);
}

// ─── API Key Setup ───────────────────────────────────
function showApiSetup() {
  dom.apiSetup.style.display = '';
  dom.trendingSection.style.display = 'none';
  dom.popularSection.style.display = 'none';
  dom.topRatedSection.style.display = 'none';
}

function hideApiSetup() {
  dom.apiSetup.style.display = 'none';
  dom.trendingSection.style.display = '';
  dom.popularSection.style.display = '';
  dom.topRatedSection.style.display = '';
}

async function saveApiKey() {
  const key = dom.apiKeyInput.value.trim();
  if (!key) {
    showToast('Ingresá tu API Key', 'error');
    return;
  }

  // Validate key by testing it
  API_KEY = key;
  const test = await getTrending();
  if (test && test.results) {
    localStorage.setItem(APIKEY_KEY, key);
    showToast('API Key guardada correctamente', 'success');
    hideApiSetup();
    initContent();
  } else {
    API_KEY = '';
    showToast('API Key inválida. Verificala e intentá de nuevo.', 'error');
  }
}

// ─── Utilities ───────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ─── Init ────────────────────────────────────────────
async function initContent() {
  // Show skeletons
  renderSkeletons(dom.trendingGrid, 10);
  renderSkeletons(dom.popularGrid, 10);
  renderSkeletons(dom.topRatedGrid, 10);

  const [trending, popular, topRated] = await Promise.all([
    getTrending(),
    getPopular(),
    getTopRated(),
  ]);

  if (trending?.results) {
    renderMovieGrid(dom.trendingGrid, trending.results);
  }
  if (popular?.results) {
    renderMovieGrid(dom.popularGrid, popular.results);
  }
  if (topRated?.results) {
    renderMovieGrid(dom.topRatedGrid, topRated.results);
  }
}

function init() {
  // Watchlist badge
  updateWatchlistBadge();

  // Tab navigation
  dom.tabSearch.addEventListener('click', () => switchTab('search'));
  dom.tabWatchlist.addEventListener('click', () => switchTab('watchlist'));

  // Search
  dom.searchInput.addEventListener('input', handleSearchInput);
  dom.searchClear.addEventListener('click', clearSearch);

  // Modal
  dom.modalClose.addEventListener('click', closeModal);
  dom.modal.addEventListener('click', (e) => {
    if (e.target === dom.modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // API Key setup
  dom.apiKeySave.addEventListener('click', saveApiKey);
  dom.apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveApiKey();
  });

  // Navbar scroll effect
  window.addEventListener('scroll', () => {
    dom.navbar.classList.toggle('scrolled', window.scrollY > 20);
  });

  // Check if API key exists
  if (!API_KEY) {
    showApiSetup();
  } else {
    initContent();
  }
}

// Launch 🚀
document.addEventListener('DOMContentLoaded', init);
