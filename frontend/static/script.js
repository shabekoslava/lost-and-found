// Состояние авторизации (определяется строго сессией Django)
let isLoggedIn = false;
let currentUserEmail = null;
let currentUserName = 'Пользователь';

// Адрес API
const API_URL = '/api/items/';
const postStatusLabels = {
  lost: 'Потеряно',
  found: 'Найдено',
  returned: 'Неактивно',
  recovered: 'Неактивно'
};
const postCompletionStatuses = {
  lost: 'recovered',
  found: 'returned'
};

// Справочники (динамически загружаемые пары {id, name})
let buildings = [];
let categories = [];
let buildingMap = {};
let categoryMap = {};

// Получение CSRF-токена Django
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Дата в часовом поясе Django
function getTodayLocalDate() {
  const calendar = new Intl.DateTimeFormat('en', {
    timeZone: postDateEventInput.dataset.timeZone || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = Object.fromEntries(calendar.formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Защита от XSS
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ЗАГРУЗКА СПРАВОЧНИКОВ (#django-context -> API -> Fallback)
async function loadDirectories() {
  buildings = [];
  categories = [];

  // 1. Приоритет А: Чтение из #django-context (чтобы не делать лишних 404-запросов, если передано шаблоном)
  const djangoContextEl = document.getElementById('django-context');
  if (djangoContextEl) {
    try {
      const ctx = JSON.parse(djangoContextEl.textContent);
      if (Array.isArray(ctx.buildings) && ctx.buildings.length > 0) {
        buildings = ctx.buildings;
      }
      if (Array.isArray(ctx.categories) && ctx.categories.length > 0) {
        categories = ctx.categories;
      }
    } catch (_) {}
  }

  // 2. Приоритет Б: Дозагрузка из API (/api/buildings/, /api/categories/), если чего-то нет в контексте
  try {
    const requests = [];
    if (buildings.length === 0) {
      requests.push(
        fetch('/api/buildings/', { headers: { 'Accept': 'application/json' } })
          .then(res => (res.ok ? res.json() : []))
          .then(data => {
            buildings = Array.isArray(data) ? data : (data.results || []);
          })
          .catch(() => {})
      );
    }
    if (categories.length === 0) {
      requests.push(
        fetch('/api/categories/', { headers: { 'Accept': 'application/json' } })
          .then(res => (res.ok ? res.json() : []))
          .then(data => {
            categories = Array.isArray(data) ? data : (data.results || []);
          })
          .catch(() => {})
      );
    }
    if (requests.length > 0) {
      await Promise.allSettled(requests);
    }
  } catch (_) {}

  // Заполняем карты ID -> Name
  buildingMap = {};
  buildings.forEach(b => {
    buildingMap[b.id] = b.name;
  });

  categoryMap = {};
  categories.forEach(c => {
    categoryMap[c.id] = c.name;
  });

  populateDirectoryUI();
}

function populateDirectoryUI() {
  // Селект корпуса в форме создания
  const buildingSelect = document.getElementById('postBuildingSelect');
  if (buildingSelect) {
    let html = '<option value="">Не указан</option>';
    if (buildings.length === 0) {
      html += '<option value="" disabled>(Справочник мест не загружен)</option>';
    } else {
      buildings.forEach(b => {
        html += `<option value="${b.id}">${escapeHtml(b.name)}</option>`;
      });
    }
    buildingSelect.innerHTML = html;
  }

  // Селект категорий в форме создания
  const categorySelect = document.getElementById('postCategorySelect');
  if (categorySelect) {
    let html = '';
    if (categories.length === 0) {
      html = '<option value="" disabled selected>(Справочник категорий не загружен)</option>';
    } else {
      categories.forEach((c, idx) => {
        html += `<option value="${c.id}" ${idx === 0 ? 'selected' : ''}>${escapeHtml(c.name)}</option>`;
      });
    }
    categorySelect.innerHTML = html;
  }

  // Фильтр корпусов в выпадающем меню
  const buildingFilterMenu = document.getElementById('buildingFilterMenu');
  if (buildingFilterMenu) {
    if (buildings.length === 0) {
      buildingFilterMenu.innerHTML = '<div style="padding: 8px 10px; color: var(--color-text-muted); font-size: 13px;">Справочник мест не загружен</div>';
    } else {
      buildingFilterMenu.innerHTML = buildings.map(b => `
        <label class="dropdown-item">
          <input type="checkbox" value="${b.id}" data-filter="building" ${state.building.includes(String(b.id)) ? 'checked' : ''}>
          <span>${escapeHtml(b.name)}</span>
        </label>
      `).join('');

      buildingFilterMenu.querySelectorAll('[data-filter="building"]').forEach(cb => {
        cb.addEventListener('change', () => {
          const value = cb.value;
          if (cb.checked) {
            if (!state.building.includes(value)) state.building.push(value);
          } else {
            state.building = state.building.filter(v => v !== value);
          }
          updateLabels();
          loadPostsFromServer();
        });
      });
    }
  }
}

// АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ (Штатные маршруты Django: /accounts/login/ и /register/)
const loginModal = document.getElementById('loginModal');
const openLoginBtn = document.getElementById('openLoginBtn');
const closeLoginBtn = document.getElementById('closeLoginBtn');

const tabLoginBtn = document.getElementById('tabLoginBtn');
const tabRegisterBtn = document.getElementById('tabRegisterBtn');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const authError = document.getElementById('authError');
const authSubmitBtn = document.getElementById('authSubmitBtn');

const regUsernameInput = document.getElementById('regUsernameInput');
const regEmailInput = document.getElementById('regEmailInput');
const regPassword1Input = document.getElementById('regPassword1Input');
const regPassword2Input = document.getElementById('regPassword2Input');
const regAuthError = document.getElementById('regAuthError');
const regSubmitBtn = document.getElementById('regSubmitBtn');

const headerGuest = document.getElementById('headerGuest');
const headerUserBlock = document.getElementById('headerUserBlock');
const logoutBtn = document.getElementById('logoutBtn');
const profileEmailDisplay = document.getElementById('profileEmailDisplay');

let authMode = 'login';

function showLoginModal() {
  if (loginModal) {
    loginModal.classList.remove('hidden');
    switchAuthMode('login');
  }
}

if (openLoginBtn) openLoginBtn.addEventListener('click', showLoginModal);
if (closeLoginBtn) closeLoginBtn.addEventListener('click', () => loginModal.classList.add('hidden'));

function switchAuthMode(mode) {
  authMode = mode;
  if (authError) {
    authError.classList.add('hidden');
    authError.style.color = '';
  }
  if (regAuthError) {
    regAuthError.classList.add('hidden');
    regAuthError.style.color = '';
  }

  if (mode === 'login') {
    if (tabLoginBtn) tabLoginBtn.classList.add('active');
    if (tabRegisterBtn) tabRegisterBtn.classList.remove('active');
    if (loginForm) loginForm.classList.remove('hidden');
    if (registerForm) registerForm.classList.add('hidden');
  } else {
    if (tabLoginBtn) tabLoginBtn.classList.remove('active');
    if (tabRegisterBtn) tabRegisterBtn.classList.add('active');
    if (loginForm) loginForm.classList.add('hidden');
    if (registerForm) registerForm.classList.remove('hidden');
  }
}

if (tabLoginBtn) tabLoginBtn.addEventListener('click', () => switchAuthMode('login'));
if (tabRegisterBtn) tabRegisterBtn.addEventListener('click', () => switchAuthMode('register'));

// Вход через штатный маршрут Django /accounts/login/
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (authSubmitBtn.disabled) return;
    if (authError) {
      authError.classList.add('hidden');
      authError.style.color = '';
    }

    const username = emailInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      if (authError) {
        authError.textContent = 'Введите имя пользователя и пароль';
        authError.classList.remove('hidden');
      }
      return;
    }

    try {
      authSubmitBtn.textContent = 'Вход...';
      authSubmitBtn.disabled = true;

      const csrfToken = getCookie('csrftoken');
      const nextUrl = window.location.pathname || '/';
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);
      params.append('csrfmiddlewaretoken', csrfToken || '');
      params.append('next', nextUrl);

      const response = await fetch('/accounts/login/', {
        method: 'POST',
        body: params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRFToken': csrfToken || ''
        },
        credentials: 'same-origin'
      });

      if (!response.ok) throw new Error(response.status);
      if (response.redirected) {
        window.location.href = response.url;
        return;
      }

      authError.textContent = 'Неверное имя пользователя или пароль.';
      authError.classList.remove('hidden');
    } catch {
      authError.textContent = 'Не удалось войти. Попробуйте ещё раз чуть позже.';
      authError.classList.remove('hidden');
    } finally {
      authSubmitBtn.textContent = 'Войти';
      authSubmitBtn.disabled = false;
    }
  });
}

// Регистрация через штатный маршрут Django /register/
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (regSubmitBtn.disabled) return;
    if (regAuthError) regAuthError.classList.add('hidden');

    const username = regUsernameInput.value.trim();
    const email = regEmailInput.value.trim();
    const p1 = regPassword1Input.value;
    const p2 = regPassword2Input.value;

    if (!username || !email || !p1 || !p2) {
      regAuthError.textContent = 'Заполните все обязательные поля';
      regAuthError.classList.remove('hidden');
      return;
    }

    if (p1 !== p2) {
      regAuthError.textContent = 'Пароли не совпадают';
      regAuthError.classList.remove('hidden');
      return;
    }

    try {
      regSubmitBtn.textContent = 'Регистрация...';
      regSubmitBtn.disabled = true;

      const csrfToken = getCookie('csrftoken');
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('email', email);
      params.append('password1', p1);
      params.append('password2', p2);
      params.append('csrfmiddlewaretoken', csrfToken || '');

      const response = await fetch('/register/', {
        method: 'POST',
        body: params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRFToken': csrfToken || ''
        },
        credentials: 'same-origin'
      });

      if (!response.ok) throw new Error(response.status);
      if (response.redirected && new URL(response.url).pathname === '/accounts/login/') {
        switchAuthMode('login');
        emailInput.value = username;
        passwordInput.value = '';
        authError.textContent = 'Регистрация успешна! Теперь выполните вход.';
        authError.style.color = 'var(--tpu-green)';
        authError.classList.remove('hidden');
        return;
      }

      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const errors = Array.from(doc.querySelectorAll('.errorlist li')).map(el => el.textContent.trim());
      regAuthError.textContent = errors.length ? errors.join(' ') : 'Ошибка регистрации. Проверьте введённые данные.';
      regAuthError.classList.remove('hidden');
    } catch {
      regAuthError.textContent = 'Не удалось завершить регистрацию. Попробуйте ещё раз чуть позже.';
      regAuthError.classList.remove('hidden');
    } finally {
      regSubmitBtn.textContent = 'Зарегистрироваться';
      regSubmitBtn.disabled = false;
    }
  });
}

// Выход из системы через штатный Django /accounts/logout/
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      const csrfToken = getCookie('csrftoken');
      const params = new URLSearchParams();
      params.append('csrfmiddlewaretoken', csrfToken || '');

      await fetch('/accounts/logout/', {
        method: 'POST',
        body: params,
        headers: {
          'X-CSRFToken': csrfToken || '',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        credentials: 'same-origin'
      });
    } catch (_) {}

    isLoggedIn = false;
    currentUserEmail = null;
    currentUserName = 'Пользователь';
    localStorage.removeItem('currentUserEmail');
    window.location.reload();
  });
}

// ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК И МОБИЛЬНОЕ МЕНЮ
const menuItems = document.querySelectorAll('.menu-item[data-target]');
const tabs = document.querySelectorAll('.tab-content');
let pendingTarget = null;

const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebarNav = document.getElementById('sidebarNav');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const mobileDrawerMedia = window.matchMedia('(max-width: 800px)');
let savedDrawerScrollY = 0;

function openMobileMenu() {
  if (!sidebarNav || !mobileDrawerMedia.matches) return;
  if (sidebarNav.classList.contains('open')) return;
  savedDrawerScrollY = window.scrollY || window.pageYOffset || 0;
  sidebarNav.classList.add('open');
  if (sidebarBackdrop) sidebarBackdrop.classList.remove('hidden');
  document.documentElement.classList.add('drawer-open');
  document.body.classList.add('drawer-open');
  document.body.style.top = `-${savedDrawerScrollY}px`;
  if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', 'true');
}

function closeMobileMenu() {
  const wasOpen = document.body.classList.contains('drawer-open');
  if (sidebarNav) sidebarNav.classList.remove('open');
  if (sidebarBackdrop) sidebarBackdrop.classList.add('hidden');
  document.documentElement.classList.remove('drawer-open');
  document.body.classList.remove('drawer-open');
  document.body.style.top = '';
  if (wasOpen) {
    window.scrollTo(0, savedDrawerScrollY);
  }
  if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', 'false');
}

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', () => {
    if (sidebarNav && sidebarNav.classList.contains('open')) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });
}

if (closeSidebarBtn) {
  closeSidebarBtn.addEventListener('click', closeMobileMenu);
}

if (sidebarBackdrop) {
  sidebarBackdrop.addEventListener('click', closeMobileMenu);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sidebarNav && sidebarNav.classList.contains('open')) {
    closeMobileMenu();
  }
});

const handleViewportChange = () => {
  if (!mobileDrawerMedia.matches) {
    closeMobileMenu();
  }
};
if (mobileDrawerMedia.addEventListener) {
  mobileDrawerMedia.addEventListener('change', handleViewportChange);
}
window.addEventListener('resize', handleViewportChange);

function switchTab(targetName) {
  menuItems.forEach(m => m.classList.remove('active'));
  tabs.forEach(t => t.classList.remove('active'));

  const menuItem = document.querySelector(`.menu-item[data-target="${targetName}"]`);
  if (menuItem) menuItem.classList.add('active');

  const targetTab = document.getElementById('tab-' + targetName);
  if (targetTab) targetTab.classList.add('active');

  if (targetName === 'lost') loadMyPostsFromServer();
}

menuItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const target = item.dataset.target;
    closeMobileMenu();
    if (!isLoggedIn && target !== 'feed' && target !== 'messages') {
      pendingTarget = target;
      showLoginModal();
      return;
    }
    switchTab(target);
  });
});

// ПРОФИЛЬ (РЕДАКТИРОВАНИЕ)
const headerUserName = document.getElementById('headerUserName');
const profileNameDisplay = document.getElementById('profileNameDisplay');
const profileNicknameDisplay = document.getElementById('profileNicknameDisplay');
const profileSchoolDisplay = document.getElementById('profileSchoolDisplay');
const profileGroupDisplay = document.getElementById('profileGroupDisplay');
const profileBioDisplay = document.getElementById('profileBioDisplay');

const headerAvatar = document.getElementById('headerAvatar');
const profileAvatar = document.getElementById('profileAvatar');
const editAvatarPreview = document.getElementById('editAvatarPreview');

const editProfileModal = document.getElementById('editProfileModal');
const openEditProfileBtn = document.getElementById('openEditProfileBtn');
const closeEditProfileBtn = document.getElementById('closeEditProfileBtn');
const saveProfileBtn = document.getElementById('saveProfileBtn');

const editFirstName = document.getElementById('editFirstName');
const editLastName = document.getElementById('editLastName');
const editNickname = document.getElementById('editNickname');
const editSchool = document.getElementById('editSchool');
const editGroup = document.getElementById('editGroup');
const editBio = document.getElementById('editBio');

const avatarUpload = document.getElementById('avatarUpload');
const removeAvatarBtn = document.getElementById('removeAvatarBtn');
const useLegacyAvatarBtn = document.getElementById('useLegacyAvatarBtn');
const profileSaveError = document.getElementById('profileSaveError');
const profileFields = {
  first_name: editFirstName,
  last_name: editLastName,
  nickname: editNickname,
  faculty: editSchool,
  group: editGroup,
  bio: editBio
};
let currentProfile = {};
let removeCurrentAvatar = false;
let selectedLegacyAvatar = null;

function avatarInitial(name) {
  const [initial] = name?.trim() || 'А';
  return initial.toUpperCase();
}

function setProfileAvatar(element, url) {
  if (!element) return;
  element.style.backgroundImage = url ? `url(${JSON.stringify(url)})` : 'none';
  element.textContent = url ? '' : avatarInitial(currentUserName);
}

function getAccountLegacyAvatar() {
  if (localStorage.getItem('userAvatarOwner') !== currentUserName) return null;
  const avatar = localStorage.getItem('userAvatar');
  return avatar?.startsWith('data:image/') ? avatar : null;
}

openEditProfileBtn?.addEventListener('click', () => {
  for (const [name, input] of Object.entries(profileFields)) {
    input.value = currentProfile[name] || '';
  }
  avatarUpload.value = '';
  removeCurrentAvatar = false;
  selectedLegacyAvatar = null;
  profileSaveError.classList.add('hidden');
  useLegacyAvatarBtn.classList.toggle('hidden', Boolean(currentProfile.avatar) || !getAccountLegacyAvatar());
  setProfileAvatar(editAvatarPreview, currentProfile.avatar);
  editProfileModal.classList.remove('hidden');
});

closeEditProfileBtn?.addEventListener('click', () => editProfileModal.classList.add('hidden'));

avatarUpload?.addEventListener('change', () => {
  const file = avatarUpload.files[0];
  if (!file) return;
  removeCurrentAvatar = false;
  selectedLegacyAvatar = null;
  const reader = new FileReader();
  reader.onload = () => {
    if (avatarUpload.files[0] === file) setProfileAvatar(editAvatarPreview, reader.result);
  };
  reader.readAsDataURL(file);
});

useLegacyAvatarBtn?.addEventListener('click', () => {
  selectedLegacyAvatar = getAccountLegacyAvatar();
  if (!selectedLegacyAvatar) return;
  avatarUpload.value = '';
  removeCurrentAvatar = false;
  setProfileAvatar(editAvatarPreview, selectedLegacyAvatar);
});

removeAvatarBtn?.addEventListener('click', () => {
  removeCurrentAvatar = true;
  selectedLegacyAvatar = null;
  avatarUpload.value = '';
  setProfileAvatar(editAvatarPreview, null);
});

saveProfileBtn?.addEventListener('click', async () => {
  profileSaveError.classList.add('hidden');
  saveProfileBtn.disabled = true;

  try {
    const payload = new FormData();
    for (const [name, input] of Object.entries(profileFields)) {
      payload.append(name, input.value.trim());
    }

    const file = avatarUpload.files[0];
    if (file) {
      payload.append('avatar', file);
    } else if (selectedLegacyAvatar) {
      const image = await (await fetch(selectedLegacyAvatar)).blob();
      payload.append('avatar', image, `avatar.${image.type.slice('image/'.length)}`);
    } else if (removeCurrentAvatar) {
      payload.append('avatar', '');
    }

    const response = await fetch('/api/profile/', {
      method: 'PATCH',
      body: payload,
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': getCookie('csrftoken') || '' }
    });
    if (!response.ok) {
      const errors = await response.json().catch(() => ({}));
      const message = Object.values(errors).flat().find(value => typeof value === 'string');
      throw new Error(message || 'Не удалось сохранить профиль. Попробуйте ещё раз.');
    }

    currentProfile = await response.json();
    if (payload.has('avatar') && localStorage.getItem('userAvatarOwner') === currentUserName) {
      localStorage.removeItem('userAvatar');
      localStorage.removeItem('userAvatarOwner');
    }
    updateProfileUI();
    editProfileModal.classList.add('hidden');
    if (payload.has('avatar')) refreshPostLists();
  } catch (error) {
    profileSaveError.textContent = error.message;
    profileSaveError.classList.remove('hidden');
  } finally {
    saveProfileBtn.disabled = false;
  }
});

function updateProfileUI() {
  const { first_name = '', last_name = '', nickname = '', faculty, group, bio, avatar } = currentProfile;
  const fullName = `${last_name} ${first_name}`.trim() || currentUserName;

  if (headerUserName) headerUserName.textContent = nickname || first_name || currentUserName;
  if (profileNameDisplay) profileNameDisplay.textContent = fullName;
  if (profileNicknameDisplay) profileNicknameDisplay.textContent = nickname ? `@${nickname.replace(/^@/, '')}` : '';
  if (profileSchoolDisplay) profileSchoolDisplay.textContent = faculty || 'Не указана';
  if (profileGroupDisplay) profileGroupDisplay.textContent = group || 'Не указана';
  if (profileBioDisplay) profileBioDisplay.textContent = bio || 'Не указано';

  setProfileAvatar(headerAvatar, avatar);
  setProfileAvatar(profileAvatar, avatar);
}

// СОЗДАНИЕ И РЕДАКТИРОВАНИЕ ОБЪЯВЛЕНИЯ
const createPostModal = document.getElementById('createPostModal');
const closeCreatePostBtn = document.getElementById('closeCreatePostBtn');
const submitPostBtn = document.getElementById('submitPostBtn');
const createPostForm = document.getElementById('createPostForm');
const postFormTitle = document.getElementById('postFormTitle');

const postTitleInput = document.getElementById('postTitleInput');
const postCategorySelect = document.getElementById('postCategorySelect');
const postLocationInput = document.getElementById('postLocationInput');
const postContactInput = document.getElementById('postContactInput');
const postDateEventInput = document.getElementById('postDateEventInput');
const postTypeSelect = document.getElementById('postTypeSelect');
const inactiveStatusOption = postTypeSelect.querySelector('[data-inactive-status]');
const postBuildingSelect = document.getElementById('postBuildingSelect');
const postTextInput = document.getElementById('postTextInput');
const postPhotoUpload = document.getElementById('postPhotoUpload');
const postPhotoPreviewWrapper = document.getElementById('postPhotoPreviewWrapper');
const postPhotoPreview = document.getElementById('postPhotoPreview');
const removePostPhotoBtn = document.getElementById('removePostPhotoBtn');

const postFormError = document.getElementById('postFormError');
const postFormSuccess = document.getElementById('postFormSuccess');

let isSubmittingPost = false;
let publicationKey = null;
let editingPost = null;
let removeStoredPhoto = false;

function clearPostFormErrors() {
  if (postFormError) {
    postFormError.classList.add('hidden');
    postFormError.textContent = '';
  }
  if (postFormSuccess) {
    postFormSuccess.classList.add('hidden');
  }
  document.querySelectorAll('#createPostModal .field-error').forEach(el => {
    el.classList.add('hidden');
    el.textContent = '';
  });
  document.querySelectorAll('#createPostModal .form-field').forEach(el => {
    el.classList.remove('has-error');
  });
}

function showFieldError(fieldName, message) {
  const errorEl = document.getElementById(`error-${fieldName}`);
  const fieldEl = document.getElementById(`field-${fieldName}`);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
  if (fieldEl) {
    fieldEl.classList.add('has-error');
  }
}

function showPostPhoto(url) {
  postPhotoPreview.style.backgroundImage = url ? `url(${JSON.stringify(url)})` : 'none';
  postPhotoPreviewWrapper.classList.toggle('hidden', !url);
}

function openPostForm(post = null) {
  if (!isLoggedIn) { showLoginModal(); return; }
  if (isSubmittingPost && editingPost?.id !== post?.id) return;

  if (!isSubmittingPost) {
    clearPostFormErrors();
    postDateEventInput.max = getTodayLocalDate();
    if (post || editingPost) {
      createPostForm.reset();
      publicationKey = null;
      removeStoredPhoto = false;
      inactiveStatusOption.hidden = !post;
      inactiveStatusOption.disabled = !post;
      if (post) {
        const completionStatus = postCompletionStatuses[post.status] ?? post.status;
        inactiveStatusOption.value = completionStatus;
        inactiveStatusOption.textContent = postStatusLabels[completionStatus];
        postTitleInput.value = post.title;
        postTextInput.value = post.description;
        postLocationInput.value = post.location;
        postContactInput.value = post.contact || '';
        postCategorySelect.value = post.category;
        postBuildingSelect.value = post.building ?? '';
        postTypeSelect.value = post.status;
        postDateEventInput.value = post.date_event;
      }
      showPostPhoto(post?.image);
    }
    editingPost = post;
    postFormTitle.textContent = post ? 'Редактировать объявление' : 'Создать объявление';
    submitPostBtn.textContent = post ? 'Сохранить' : 'Опубликовать';
  }

  createPostModal.classList.remove('hidden');
}

document.querySelectorAll('[data-open-create-post]').forEach(button => {
  button.addEventListener('click', () => openPostForm());
});

// При закрытии окна НЕ сбрасываем isSubmittingPost и блокировку кнопки
if (closeCreatePostBtn) {
  closeCreatePostBtn.addEventListener('click', () => {
    createPostModal.classList.add('hidden');
  });
}

if (postPhotoUpload) {
  postPhotoUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (postPhotoUpload.files[0] === file) showPostPhoto(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  });
}

if (removePostPhotoBtn) {
  removePostPhotoBtn.addEventListener('click', () => {
    postPhotoUpload.value = '';
    removeStoredPhoto = Boolean(editingPost?.image);
    if (!editingPost) publicationKey = null;
    showPostPhoto(null);
  });
}

async function handlePostSubmit(event) {
  event.preventDefault();
  if (isSubmittingPost) return;

  clearPostFormErrors();

  const title = postTitleInput.value.trim();
  const description = postTextInput.value.trim();
  const location = postLocationInput.value.trim();
  const today = getTodayLocalDate();
  postDateEventInput.max = today;
  const dateEvent = postDateEventInput.value || today;
  const status = postTypeSelect.value;
  const category = postCategorySelect.value;
  const building = postBuildingSelect.value;
  const file = postPhotoUpload.files[0];

  // Валидация обязательных полей
  let hasClientErrors = false;
  if (!title) {
    showFieldError('title', 'Заполните название');
    hasClientErrors = true;
  }
  if (!description) {
    showFieldError('description', 'Заполните описание');
    hasClientErrors = true;
  }
  if (!location) {
    showFieldError('location', 'Укажите конкретное место');
    hasClientErrors = true;
  }
  if (!category) {
    showFieldError('category', 'Выберите категорию');
    hasClientErrors = true;
  }
  if (dateEvent > today) {
    showFieldError('date_event', 'Дата события не может быть в будущем.');
    hasClientErrors = true;
  }
  if (hasClientErrors) return;

  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  formData.append('contact', postContactInput.value.trim());
  formData.append('location', location);
  if (!editingPost || status !== editingPost.status) formData.append('status', status);
  formData.append('category', category);

  // При редактировании пустое значение снимает привязку к корпусу.
  if (building || editingPost) {
    formData.append('building', building);
  }

  formData.append('date_event', dateEvent);

  if (file) {
    formData.append('image', file);
  } else if (removeStoredPhoto) {
    formData.append('image', '');
  }

  const itemUrl = editingPost ? `${API_URL}${editingPost.id}/` : API_URL;
  const submitLabel = editingPost ? 'Сохранить' : 'Опубликовать';
  let submittedSuccessfully = false;

  try {
    isSubmittingPost = true;
    submitPostBtn.disabled = true;
    submitPostBtn.textContent = editingPost ? 'Сохранение...' : 'Публикация...';

    const headers = { 'X-CSRFToken': getCookie('csrftoken') || '' };
    if (!editingPost) {
      publicationKey ??= crypto.randomUUID();
      headers['Idempotency-Key'] = publicationKey;
    }

    const response = await fetch(itemUrl, {
      method: editingPost ? 'PATCH' : 'POST',
      body: formData,
      credentials: 'same-origin',
      headers
    });

    if (response.ok) {
      submittedSuccessfully = true;
      if (postFormSuccess) {
        postFormSuccess.textContent = editingPost ? 'Изменения сохранены.' : 'Объявление успешно опубликовано!';
        postFormSuccess.classList.remove('hidden');
      }

      refreshPostLists();

      setTimeout(() => {
        createPostForm.reset();
        publicationKey = null;
        inactiveStatusOption.hidden = true;
        inactiveStatusOption.disabled = true;
        showPostPhoto(null);
        clearPostFormErrors();
        createPostModal.classList.add('hidden');
        editingPost = null;
        removeStoredPhoto = false;
        isSubmittingPost = false;
        submitPostBtn.disabled = false;
        submitPostBtn.textContent = 'Опубликовать';
      }, 700);

      return;
    }

    if (response.status === 400) {
      const errData = await response.json();
      let hasMappedError = false;
      for (const [field, errors] of Object.entries(errData)) {
        const msg = Array.isArray(errors) ? errors.join(' ') : String(errors);
        if (document.getElementById(`error-${field}`)) {
          showFieldError(field, msg);
          hasMappedError = true;
        }
      }
      if (!hasMappedError && postFormError) {
        postFormError.textContent = 'Проверьте введённые данные.';
        postFormError.classList.remove('hidden');
      }
      return;
    }

    if (response.status === 401 || response.status === 403) {
      if (postFormError) {
        postFormError.textContent = 'Для этого действия нужен вход в аккаунт автора.';
        postFormError.classList.remove('hidden');
      }
      return;
    }

    throw new Error(`Ошибка сервера (${response.status})`);
  } catch (error) {
    console.error('Ошибка при отправке объявления:', error);
    if (postFormError) {
      postFormError.textContent = error.message || 'Не удалось сохранить объявление. Проверьте соединение с сервером.';
      postFormError.classList.remove('hidden');
    }
  } finally {
    if (!submittedSuccessfully) {
      isSubmittingPost = false;
      submitPostBtn.disabled = false;
      submitPostBtn.textContent = submitLabel;
    }
  }
}

createPostForm?.addEventListener('submit', handlePostSubmit);
createPostForm?.addEventListener('input', () => {
  if (!editingPost) publicationKey = null;
});

function refreshPostLists() {
  loadPostsFromServer();
  loadItemStats();
  if (document.getElementById('tab-lost')?.classList.contains('active')) {
    loadMyPostsFromServer();
  }
}

const itemStatsCard = document.getElementById('itemStats');
let itemStatsRequestId = 0;

async function loadItemStats() {
  const requestId = ++itemStatsRequestId;
  let counts;
  try {
    const response = await fetch(itemStatsCard.dataset.url);
    if (response.ok) counts = await response.json();
  } catch (error) {
    console.warn('Не удалось загрузить статистику объявлений:', error);
  }

  if (requestId !== itemStatsRequestId) return;
  itemStatsCard.querySelectorAll('[data-item-status]').forEach(counter => {
    counter.textContent = counts?.[counter.dataset.itemStatus] ?? '—';
  });
}

// ЗАГРУЗКА И ОТРИСОВКА КАТАЛОГА (BYUR-38, BYUR-46, BYUR-47)
let serverPosts = [];
let currentAbortController = null;
let currentRequestId = 0;

async function loadPostsFromServer() {
  const requestId = ++currentRequestId;

  if (currentAbortController) {
    currentAbortController.abort();
  }
  currentAbortController = new AbortController();

  const container = document.getElementById('postsContainer');
  const emptyState = document.getElementById('emptyState');

  if (container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Загрузка объявлений...</p>
      </div>
    `;
  }
  if (emptyState) emptyState.style.display = 'none';

  const params = new URLSearchParams();
  state.type.forEach(s => params.append('status', s));
  state.building.forEach(b => params.append('building', b));

  const queryString = params.toString();
  const url = queryString ? `${API_URL}?${queryString}` : API_URL;

  try {
    const response = await fetch(url, {
      signal: currentAbortController.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }

    const data = await response.json();

    if (requestId !== currentRequestId) return;

    serverPosts = Array.isArray(data) ? data : (data.results || []);
    renderFeed();
  } catch (error) {
    if (error.name === 'AbortError') return;
    if (requestId !== currentRequestId) return;

    console.error('Не удалось загрузить посты:', error);

    if (container) {
      container.innerHTML = `
        <div class="card error-state">
          <p class="error-title">Ошибка при загрузке объявлений</p>
          <p class="error-desc">${escapeHtml(error.message || 'Сервер временно недоступен.')}</p>
          <button type="button" class="btn-primary btn-retry" id="retryLoadBtn">Повторить</button>
        </div>
      `;

      document.getElementById('retryLoadBtn')?.addEventListener('click', () => {
        loadPostsFromServer();
        loadItemStats();
      });
    }
  }
}

function isOwnPost(post) {
  return isLoggedIn && post.author_name === currentUserName;
}

function postAuthorAvatar(post) {
  const avatar = isOwnPost(post) ? currentProfile.avatar : post.author_avatar;
  return avatar
    ? `<img src="${escapeHtml(avatar)}" alt="" loading="lazy">`
    : escapeHtml(avatarInitial(post.author_name));
}

function contactDetails(contact) {
  let value = 'Автор не указал контакт.';
  if (contact) {
    const phone = contact.replace(/[\s()-]/g, '');
    let href = '';
    if (/^@[A-Za-z0-9_]{5,32}$/.test(contact)) {
      href = `https://t.me/${contact.slice(1)}`;
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
      href = `mailto:${encodeURIComponent(contact)}`;
    } else if (/^\+?\d{7,15}$/.test(phone)) {
      href = `tel:${phone}`;
    }
    const text = escapeHtml(contact);
    value = href ? `<a href="${escapeHtml(href)}">${text}</a>` : text;
  }
  return `<details class="post-contact"><summary class="btn-action">Связаться</summary><p>${value}</p></details>`;
}

function renderFeed() {
  const container = document.getElementById('postsContainer');
  if (!container) return;
  container.innerHTML = '';

  if (serverPosts.length === 0) {
    const hasFilters = state.type.length > 0 || state.building.length > 0;
    container.innerHTML = `
      <div class="empty-state">
        ${hasFilters ? 'По выбранным фильтрам ничего не найдено.' : 'Пока нет активных объявлений.'}
      </div>
    `;
    return;
  }

  serverPosts.forEach(post => {
    const typeText = postStatusLabels[post.status];

    const postDate = post.created_at ? new Date(post.created_at).toLocaleString('ru-RU', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    }) : '';

    const safeTitle = escapeHtml(post.title);
    const safeDesc = escapeHtml(post.description);
    const safeLocation = escapeHtml(post.location);
    const safeAuthor = escapeHtml(post.author_name || 'Аноним');

    // Приоритет имени корпуса: из ответа API (building_name) или из карты справочника
    const buildingName = post.building_name || (post.building ? (buildingMap[post.building] || `Корпус #${post.building}`) : '');
    const locationWithBuilding = buildingName ? `${escapeHtml(buildingName)}, ${safeLocation}` : safeLocation;

    const imageHtml = post.image
      ? `<div class="post-image" style="background-image: url('${encodeURI(post.image)}'); background-size: cover; background-position: center; height: 300px;"></div>`
      : '<div class="post-image">Фото вещи отсутствует</div>';

    const postHTML = `
      <article class="card post" data-id="${post.id}" data-type="${escapeHtml(post.status)}" data-building="${post.building || ''}">
        <div class="post-header">
          <div class="avatar avatar-small post-avatar" aria-hidden="true">${postAuthorAvatar(post)}</div>
          <div class="post-meta">
            <div class="post-author">${safeAuthor}</div>
            <div class="post-date">${escapeHtml(postDate)}</div>
          </div>
        </div>
        <div class="post-body">
          <h4 style="margin-bottom: 5px;">${safeTitle}</h4>
          <p><strong>${escapeHtml(typeText)} (${locationWithBuilding}):</strong> ${safeDesc}</p>
          ${imageHtml}
        </div>
        ${isOwnPost(post) ? '' : contactDetails(post.contact)}
      </article>
    `;
    container.insertAdjacentHTML('beforeend', postHTML);
  });

}

// ЗАГРУЗКА И ОТРИСОВКА «МОИ НАХОДКИ» (BYUR-38, независимо от фильтров ленты)
const myPostsContainer = document.getElementById('myPostsContainer');
const deletingPosts = new Set();
let myServerPosts = [];
let myPostsAbortController = null;
let myPostsRequestId = 0;

async function loadMyPostsFromServer() {
  const container = document.getElementById('myPostsContainer');
  if (!container) return;

  const requestId = ++myPostsRequestId;
  if (myPostsAbortController) {
    myPostsAbortController.abort();
  }
  myPostsAbortController = new AbortController();

  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Загрузка ваших объявлений...</p>
    </div>
  `;

  try {
    const response = await fetch(`${API_URL}mine/`, {
      signal: myPostsAbortController.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }

    const data = await response.json();
    if (requestId !== myPostsRequestId) return;

    myServerPosts = Array.isArray(data) ? data : (data.results || []);
    renderMyPosts();
  } catch (error) {
    if (error.name === 'AbortError') return;
    if (requestId !== myPostsRequestId) return;

    console.error('Не удалось загрузить мои находки:', error);
    container.innerHTML = `
      <div class="card error-state">
        <p class="error-title">Ошибка при загрузке ваших объявлений</p>
        <p class="error-desc">${escapeHtml(error.message || 'Сервер временно недоступен.')}</p>
        <button type="button" class="btn-primary btn-retry" id="retryMyPostsBtn">Повторить</button>
      </div>
    `;

    document.getElementById('retryMyPostsBtn')?.addEventListener('click', () => {
      loadMyPostsFromServer();
    });
  }
}

function renderMyPosts() {
  const container = document.getElementById('myPostsContainer');
  if (!container) return;
  container.innerHTML = '';

  if (myServerPosts.length === 0) {
    container.innerHTML = '<div class="card"><div class="empty-state">Вы ещё не публиковали объявления.</div></div>';
    return;
  }

  myServerPosts.forEach(post => {
    const typeText = postStatusLabels[post.status];
    const isInactive = !postCompletionStatuses[post.status];
    const safeTitle = escapeHtml(post.title);
    const safeDesc = escapeHtml(post.description);
    const safeLocation = escapeHtml(post.location);
    const buildingName = post.building_name || (post.building ? (buildingMap[post.building] || `Корпус #${post.building}`) : '');
    const locationWithBuilding = buildingName ? `${escapeHtml(buildingName)}, ${safeLocation}` : safeLocation;
    const imageHtml = post.image ? `<div class="post-image" style="background-image: url('${encodeURI(post.image)}'); background-size: cover; background-position: center; height: 200px;"></div>` : '';

    const postHTML = `
      <article class="card post${isInactive ? ' post--inactive' : ''}" data-post-id="${post.id}" style="margin-bottom: 10px;">
        <div class="post-body">
          <h4>${safeTitle}</h4>
          <p><strong>${escapeHtml(typeText)} (${locationWithBuilding}):</strong> ${safeDesc}</p>
          ${imageHtml}
        </div>
        <div class="my-post-actions">
          <button type="button" class="btn-edit-post" data-post-action="edit">Редактировать</button>
          <button type="button" class="btn-delete-post" data-post-action="delete">Удалить</button>
        </div>
        <p class="field-error hidden" data-post-error role="alert"></p>
      </article>
    `;
    container.insertAdjacentHTML('beforeend', postHTML);
  });
}

myPostsContainer?.addEventListener('click', async event => {
  const action = event.target.closest('[data-post-action]');
  if (!action) return;
  const card = action.closest('[data-post-id]');
  const post = myServerPosts.find(item => String(item.id) === card.dataset.postId);
  if (!post || deletingPosts.has(post.id) || (isSubmittingPost && editingPost?.id === post.id)) return;

  if (action.dataset.postAction === 'edit') {
    openPostForm(post);
    return;
  }

  if (!window.confirm(`Удалить объявление «${post.title}»?`)) return;
  const errorMessage = card.querySelector('[data-post-error]');
  const buttons = card.querySelectorAll('[data-post-action]');
  errorMessage.classList.add('hidden');
  deletingPosts.add(post.id);
  buttons.forEach(button => { button.disabled = true; });

  try {
    const response = await fetch(`${API_URL}${post.id}/`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': getCookie('csrftoken') || '' }
    });
    if (!response.ok && response.status !== 404) throw new Error(`Не удалось удалить объявление (${response.status}).`);
    refreshPostLists();
  } catch (error) {
    errorMessage.textContent = error.message;
    errorMessage.classList.remove('hidden');
  } finally {
    buttons.forEach(button => { button.disabled = false; });
    deletingPosts.delete(post.id);
  }
});

// ФИЛЬТРЫ (BYUR-46)
const state = { type: [], building: [] };
const labelType = document.querySelector('[data-label-type]');
const labelBuilding = document.querySelector('[data-label-building]');

document.querySelectorAll('[data-toggle]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = btn.closest('[data-dropdown]');
    const menu = dropdown.querySelector('[data-menu]');
    const isOpen = !menu.classList.contains('hidden');

    document.querySelectorAll('[data-menu]').forEach(m => m.classList.add('hidden'));
    document.querySelectorAll('[data-toggle]').forEach(b => b.classList.remove('open'));

    if (!isOpen) {
      menu.classList.remove('hidden');
      btn.classList.add('open');
    }
  });
});

document.addEventListener('click', () => {
  document.querySelectorAll('[data-menu]').forEach(m => m.classList.add('hidden'));
  document.querySelectorAll('[data-toggle]').forEach(b => b.classList.remove('open'));
});

document.querySelectorAll('[data-menu]').forEach(m => {
  m.addEventListener('click', (e) => e.stopPropagation());
});

document.querySelectorAll('[data-filter="type"]').forEach(cb => {
  cb.addEventListener('change', () => {
    const value = cb.value;
    if (cb.checked) {
      if (!state.type.includes(value)) state.type.push(value);
    } else {
      state.type = state.type.filter(v => v !== value);
    }
    updateLabels();
    loadPostsFromServer();
  });
});

function updateLabels() {
  if (labelType) {
    if (state.type.length === 0) labelType.textContent = 'Активные';
    else if (state.type.length === 1) labelType.textContent = postStatusLabels[state.type[0]];
    else labelType.textContent = 'Несколько';
  }

  if (labelBuilding) {
    if (state.building.length === 0) labelBuilding.textContent = 'Все';
    else if (state.building.length === 1) {
      labelBuilding.textContent = buildingMap[state.building[0]] || `Корпус #${state.building[0]}`;
    } else labelBuilding.textContent = 'Несколько';
  }
}

const resetBtn = document.getElementById('resetFilters');
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    state.type = [];
    state.building = [];
    document.querySelectorAll('[data-filter]').forEach(cb => cb.checked = false);
    updateLabels();
    loadPostsFromServer();
  });
}

// ИНФО-МОДАЛКА
const infoModal = document.getElementById('infoModal');
const closeInfoBtn = document.getElementById('closeInfoBtn');
const infoModalTitle = document.getElementById('infoModalTitle');
const infoSections = document.querySelectorAll('[data-info-section]');
let activeInfoLink = null;

document.querySelectorAll('[data-info]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    infoSections.forEach(section => {
      section.hidden = section.dataset.infoSection !== link.dataset.info;
    });
    activeInfoLink = link;
    infoModalTitle.textContent = link.textContent;
    infoModal.classList.remove('hidden');
    closeInfoBtn.focus();
  });
});

closeInfoBtn.addEventListener('click', () => {
  infoModal.classList.add('hidden');
  activeInfoLink?.focus();
});

// ИНИЦИАЛИЗАЦИЯ ПРИ СТАРТЕ
window.addEventListener('load', () => {
  const nextPath = window.location.pathname || '/';
  const loginNextInput = document.getElementById('loginNextInput');
  if (loginNextInput) loginNextInput.value = nextPath;
  const djangoLoginLink = document.getElementById('djangoLoginLink');
  if (djangoLoginLink) djangoLoginLink.href = `/accounts/login/?next=${encodeURIComponent(nextPath)}`;

  // Сессия определяется строго из #django-context
  const djangoContextEl = document.getElementById('django-context');
  if (djangoContextEl) {
    try {
      const djangoUser = JSON.parse(djangoContextEl.textContent);
      if (djangoUser && djangoUser.isAuthenticated) {
        isLoggedIn = true;
        currentUserEmail = djangoUser.email || djangoUser.username;
        currentUserName = djangoUser.username;
        currentProfile = djangoUser.profile || {};
        if (headerGuest) headerGuest.classList.add('hidden');
        if (headerUserBlock) headerUserBlock.classList.remove('hidden');
        if (profileEmailDisplay) profileEmailDisplay.textContent = currentUserEmail;
        if (headerUserName) headerUserName.textContent = currentUserName;
      } else {
        isLoggedIn = false;
        currentUserEmail = null;
        currentUserName = 'Пользователь';
        if (headerGuest) headerGuest.classList.remove('hidden');
        if (headerUserBlock) headerUserBlock.classList.add('hidden');
      }
    } catch (_) {
      isLoggedIn = false;
    }
  } else {
    isLoggedIn = false;
  }

  updateProfileUI();
  loadItemStats();

  // Загружаем справочники и посты
  loadDirectories().then(() => {
    loadPostsFromServer();
  });
});
