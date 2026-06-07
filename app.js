/* ===================================================
   PeliSharko 🦈 — App Logic
   TMDB API + Search + Filters + Watchlist
   =================================================== */

// ─── Config ──────────────────────────────────────────
const API_KEY = 'c25676d0dc9749f1406ece321a58d14a';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';
const POSTER_SIZE = '/w500';
const BACKDROP_SIZE = '/w1280';
const PROFILE_SIZE = '/w185';
const LANG = 'es-ES';
const WATCHLIST_KEY = 'pelisharko_watchlist';

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
  // Filters
  filtersToggle: $('#filters-toggle'),
  filtersPanel: $('#filters-panel'),
  filterGenre: $('#filter-genre'),
  filterCountry: $('#filter-country'),
  filterYear: $('#filter-year'),
  filterSort: $('#filter-sort'),
  filterRating: $('#filter-rating'),
  filterDirector: $('#filter-director'),
  directorDropdown: $('#director-dropdown'),
  directorSelected: $('#director-selected'),
  directorSelectedName: $('#director-selected-name'),
  directorRemove: $('#director-remove'),
  filterApply: $('#filter-apply'),
  filterClear: $('#filter-clear'),
  filtersActiveTags: $('#filters-active-tags'),
  // Discover
  discoverSection: $('#discover-section'),
  discoverGrid: $('#discover-grid'),
  discoverCount: $('#discover-count'),
  discoverPagination: $('#discover-pagination'),
  discoverPrev: $('#discover-prev'),
  discoverNext: $('#discover-next'),
  discoverPageInfo: $('#discover-page-info'),
};

// ─── State ───────────────────────────────────────────
let watchlist = loadWatchlist();
let currentView = 'search';
let searchTimeout = null;
let directorSearchTimeout = null;
let genresList = [];

// Filter state
let filterState = {
  genre: '',
  country: '',
  year: '',
  sort: 'popularity.desc',
  rating: '',
  directorId: '',
  directorName: '',
};

let discoverState = {
  page: 1,
  totalPages: 0,
  totalResults: 0,
  isActive: false,
};

// ─── TMDB API ────────────────────────────────────────
async function tmdbFetch(endpoint, params = {}) {
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('language', LANG);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) {
      url.searchParams.set(k, v);
    }
  });

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

async function getGenres() {
  return tmdbFetch('/genre/movie/list');
}

async function searchPerson(query) {
  return tmdbFetch('/search/person', { query, include_adult: 'false' });
}

async function discoverMovies(filters, page = 1) {
  const params = {
    page,
    sort_by: filters.sort || 'popularity.desc',
    include_adult: 'false',
    'vote_count.gte': '50', // Avoid obscure movies
  };

  if (filters.genre) params.with_genres = filters.genre;
  if (filters.country) params.with_origin_country = filters.country;
  if (filters.year) params.primary_release_year = filters.year;
  if (filters.rating) params['vote_average.gte'] = filters.rating;
  if (filters.directorId) params.with_crew = filters.directorId;

  return tmdbFetch('/discover/movie', params);
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
    genre_ids: movie.genre_ids || (movie.genres ? movie.genres.map((g) => g.id) : []),
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

function getProfileUrl(path) {
  return path ? `${IMG_BASE}${PROFILE_SIZE}${path}` : null;
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

  card.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      e.stopPropagation();
      handleCardAction(btn.dataset.action, movie);
      return;
    }
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
  dom.modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  const posterUrl = getPosterUrl(movie.poster_path);
  const backdropUrl = getBackdropUrl(movie.backdrop_path);

  dom.modalBackdropImg.src = backdropUrl || '';
  dom.modalBackdropImg.style.display = backdropUrl ? 'block' : 'none';
  dom.modalPosterImg.src = posterUrl || '';
  dom.modalTitle.textContent = movie.title;
  dom.modalOriginalTitle.textContent =
    movie.original_title !== movie.title ? movie.original_title : '';
  dom.modalOverview.textContent = movie.overview || 'Sin sinopsis disponible.';

  const year = getYear(movie.release_date);
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '—';
  dom.modalMeta.innerHTML = `
    <span class="modal__meta-item"><span class="modal__meta-item-icon">📅</span> ${year}</span>
    <span class="modal__meta-item"><span class="modal__meta-item-icon">⭐</span> <span class="modal__rating-value">${rating}</span>/10</span>`;

  dom.modalGenres.innerHTML = '';
  renderModalActions(movie);

  // Fetch full details
  const details = await getMovieDetails(movie.id);
  if (details) {
    dom.modalOverview.textContent =
      details.overview || movie.overview || 'Sin sinopsis disponible.';

    if (details.original_title && details.original_title !== details.title) {
      dom.modalOriginalTitle.textContent = details.original_title;
    }

    const runtime = details.runtime
      ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m`
      : '';

    // Find director from credits
    let directorName = '';
    if (details.credits && details.credits.crew) {
      const director = details.credits.crew.find((c) => c.job === 'Director');
      if (director) directorName = director.name;
    }

    dom.modalMeta.innerHTML = `
      <span class="modal__meta-item"><span class="modal__meta-item-icon">📅</span> ${year}</span>
      <span class="modal__meta-item"><span class="modal__meta-item-icon">⭐</span> <span class="modal__rating-value">${details.vote_average ? details.vote_average.toFixed(1) : '—'}</span>/10</span>
      ${runtime ? `<span class="modal__meta-item"><span class="modal__meta-item-icon">⏱️</span> ${runtime}</span>` : ''}
      ${details.vote_count ? `<span class="modal__meta-item"><span class="modal__meta-item-icon">👥</span> ${details.vote_count.toLocaleString()} votos</span>` : ''}
      ${directorName ? `<span class="modal__meta-item"><span class="modal__meta-item-icon">🎬</span> ${escapeHtml(directorName)}</span>` : ''}`;

    if (details.genres && details.genres.length) {
      dom.modalGenres.innerHTML = details.genres
        .map((g) => `<span class="modal__genre-tag">${g.name}</span>`)
        .join('');
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
  dom.searchClear.classList.toggle('visible', query.length > 0);
  clearTimeout(searchTimeout);

  if (!query) {
    dom.searchResultsSection.style.display = 'none';
    // Show trending/popular/top if not in discover mode
    if (!discoverState.isActive) {
      showDefaultSections();
    }
    return;
  }

  // Hide discover results when searching
  discoverState.isActive = false;
  dom.discoverSection.style.display = 'none';

  searchTimeout = setTimeout(async () => {
    dom.searchResultsSection.style.display = '';
    hideDefaultSections();

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
  if (!discoverState.isActive) {
    showDefaultSections();
  }
  dom.searchInput.focus();
}

function showDefaultSections() {
  dom.trendingSection.style.display = '';
  dom.popularSection.style.display = '';
  dom.topRatedSection.style.display = '';
}

function hideDefaultSections() {
  dom.trendingSection.style.display = 'none';
  dom.popularSection.style.display = 'none';
  dom.topRatedSection.style.display = 'none';
}

// ─── Filters ─────────────────────────────────────────
function toggleFilters() {
  const isOpen = dom.filtersPanel.classList.toggle('open');
  dom.filtersToggle.classList.toggle('active', isOpen);
}

async function initGenres() {
  const data = await getGenres();
  if (data && data.genres) {
    genresList = data.genres;
    genresList.forEach((genre) => {
      const opt = document.createElement('option');
      opt.value = genre.id;
      opt.textContent = genre.name;
      dom.filterGenre.appendChild(opt);
    });
  }
}

function initYears() {
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= 1920; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    dom.filterYear.appendChild(opt);
  }
}

// Director autocomplete
function handleDirectorSearch() {
  const query = dom.filterDirector.value.trim();
  clearTimeout(directorSearchTimeout);

  if (!query || query.length < 2) {
    dom.directorDropdown.classList.remove('open');
    return;
  }

  directorSearchTimeout = setTimeout(async () => {
    const data = await searchPerson(query);
    if (data && data.results) {
      // Filter to people known for directing
      const directors = data.results
        .filter((p) => p.known_for_department === 'Directing')
        .slice(0, 8);

      if (directors.length === 0) {
        dom.directorDropdown.innerHTML =
          '<div class="filters__director-option" style="cursor:default;opacity:0.5;">No se encontraron directores</div>';
      } else {
        dom.directorDropdown.innerHTML = directors
          .map((p) => {
            const imgUrl = getProfileUrl(p.profile_path);
            const imgHTML = imgUrl
              ? `<img src="${imgUrl}" alt="">`
              : '<span style="width:28px;height:28px;border-radius:50%;background:var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:0.8rem;">🎬</span>';
            return `<div class="filters__director-option" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
              ${imgHTML}
              <span>${escapeHtml(p.name)}</span>
            </div>`;
          })
          .join('');
      }
      dom.directorDropdown.classList.add('open');
    }
  }, 400);
}

function selectDirector(id, name) {
  filterState.directorId = id;
  filterState.directorName = name;
  dom.filterDirector.value = '';
  dom.directorDropdown.classList.remove('open');
  dom.directorSelectedName.textContent = name;
  dom.directorSelected.classList.add('visible');
}

function clearDirector() {
  filterState.directorId = '';
  filterState.directorName = '';
  dom.filterDirector.value = '';
  dom.directorSelected.classList.remove('visible');
}

function readFilterState() {
  filterState.genre = dom.filterGenre.value;
  filterState.country = dom.filterCountry.value;
  filterState.year = dom.filterYear.value;
  filterState.sort = dom.filterSort.value;
  filterState.rating = dom.filterRating.value;
  // directorId is set via autocomplete
}

function hasActiveFilters() {
  return (
    filterState.genre ||
    filterState.country ||
    filterState.year ||
    filterState.rating ||
    filterState.directorId ||
    filterState.sort !== 'popularity.desc'
  );
}

function renderActiveFilterTags() {
  const tags = [];
  if (filterState.genre) {
    const genreName = genresList.find((g) => g.id == filterState.genre)?.name || filterState.genre;
    tags.push(`🎭 ${genreName}`);
  }
  if (filterState.country) {
    const countryOpt = dom.filterCountry.querySelector(`option[value="${filterState.country}"]`);
    tags.push(`🌍 ${countryOpt ? countryOpt.textContent.trim() : filterState.country}`);
  }
  if (filterState.year) {
    tags.push(`📅 ${filterState.year}`);
  }
  if (filterState.rating) {
    tags.push(`⭐ ${filterState.rating}+`);
  }
  if (filterState.directorName) {
    tags.push(`🎬 ${filterState.directorName}`);
  }
  const sortLabels = {
    'popularity.desc': null,
    'vote_average.desc': '📊 Mejor valoradas',
    'primary_release_date.desc': '📊 Más recientes',
    'revenue.desc': '📊 Mayor recaudación',
    'original_title.asc': '📊 Título A-Z',
  };
  if (sortLabels[filterState.sort]) {
    tags.push(sortLabels[filterState.sort]);
  }

  dom.filtersActiveTags.innerHTML = tags
    .map((t) => `<span class="filters__active-tag">${t}</span>`)
    .join('');
}

async function applyFilters() {
  readFilterState();

  if (!hasActiveFilters()) {
    showToast('Seleccioná al menos un filtro', 'info');
    return;
  }

  // Clear search
  dom.searchInput.value = '';
  dom.searchClear.classList.remove('visible');
  dom.searchResultsSection.style.display = 'none';

  // Hide default sections
  hideDefaultSections();

  // Show discover
  discoverState.isActive = true;
  discoverState.page = 1;
  dom.discoverSection.style.display = '';

  renderActiveFilterTags();
  await loadDiscoverPage();
}

async function loadDiscoverPage() {
  renderSkeletons(dom.discoverGrid, 20);

  const data = await discoverMovies(filterState, discoverState.page);
  if (data && data.results) {
    discoverState.totalPages = Math.min(data.total_pages, 500); // TMDB caps at 500
    discoverState.totalResults = data.total_results;

    dom.discoverCount.textContent = `(${data.total_results.toLocaleString()} películas)`;

    const movies = data.results.filter((m) => m.poster_path);
    renderMovieGrid(dom.discoverGrid, movies);

    if (movies.length === 0) {
      dom.discoverGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state__icon">🎯</div>
          <h3 class="empty-state__title">Sin resultados</h3>
          <p class="empty-state__text">No encontramos películas con esos filtros. Probá combinaciones diferentes.</p>
        </div>`;
    }

    // Pagination
    if (discoverState.totalPages > 1) {
      dom.discoverPagination.style.display = 'flex';
      dom.discoverPrev.disabled = discoverState.page <= 1;
      dom.discoverNext.disabled = discoverState.page >= discoverState.totalPages;
      dom.discoverPageInfo.textContent = `Página ${discoverState.page} de ${discoverState.totalPages}`;
    } else {
      dom.discoverPagination.style.display = 'none';
    }
  }

  // Scroll to top of discover section
  dom.discoverSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearFilters() {
  dom.filterGenre.value = '';
  dom.filterCountry.value = '';
  dom.filterYear.value = '';
  dom.filterSort.value = 'popularity.desc';
  dom.filterRating.value = '';
  clearDirector();

  filterState = {
    genre: '',
    country: '',
    year: '',
    sort: 'popularity.desc',
    rating: '',
    directorId: '',
    directorName: '',
  };

  dom.filtersActiveTags.innerHTML = '';
  discoverState.isActive = false;
  dom.discoverSection.style.display = 'none';
  showDefaultSections();
  showToast('Filtros limpiados', 'info');
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
    const query = dom.searchInput.value.trim();
    if (query) {
      handleSearchInput();
    } else if (discoverState.isActive) {
      loadDiscoverPage();
    } else {
      reRenderVisibleGrids();
    }
  }
}

async function reRenderVisibleGrids() {
  const [trending, popular, topRated] = await Promise.all([
    getTrending(),
    getPopular(),
    getTopRated(),
  ]);

  if (trending?.results) renderMovieGrid(dom.trendingGrid, trending.results);
  if (popular?.results) renderMovieGrid(dom.popularGrid, popular.results);
  if (topRated?.results) renderMovieGrid(dom.topRatedGrid, topRated.results);
}

// ─── Utilities ───────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── Init ────────────────────────────────────────────
async function initContent() {
  renderSkeletons(dom.trendingGrid, 10);
  renderSkeletons(dom.popularGrid, 10);
  renderSkeletons(dom.topRatedGrid, 10);

  const [trending, popular, topRated] = await Promise.all([
    getTrending(),
    getPopular(),
    getTopRated(),
  ]);

  if (trending?.results) renderMovieGrid(dom.trendingGrid, trending.results);
  if (popular?.results) renderMovieGrid(dom.popularGrid, popular.results);
  if (topRated?.results) renderMovieGrid(dom.topRatedGrid, topRated.results);
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

  // Navbar scroll effect
  window.addEventListener('scroll', () => {
    dom.navbar.classList.toggle('scrolled', window.scrollY > 20);
  });

  // Filters
  dom.filtersToggle.addEventListener('click', toggleFilters);
  dom.filterApply.addEventListener('click', applyFilters);
  dom.filterClear.addEventListener('click', clearFilters);

  // Director autocomplete
  dom.filterDirector.addEventListener('input', handleDirectorSearch);
  dom.directorDropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.filters__director-option');
    if (opt && opt.dataset.id) {
      selectDirector(opt.dataset.id, opt.dataset.name);
    }
  });
  dom.directorRemove.addEventListener('click', clearDirector);

  // Close director dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.filters__director-wrapper')) {
      dom.directorDropdown.classList.remove('open');
    }
  });

  // Discover pagination
  dom.discoverPrev.addEventListener('click', () => {
    if (discoverState.page > 1) {
      discoverState.page--;
      loadDiscoverPage();
    }
  });
  dom.discoverNext.addEventListener('click', () => {
    if (discoverState.page < discoverState.totalPages) {
      discoverState.page++;
      loadDiscoverPage();
    }
  });

  // Init filters
  initGenres();
  initYears();

  // Load content
  initContent();
}

// Launch 🚀
document.addEventListener('DOMContentLoaded', init);
