let isLoggedIn = false; 
let currentUserEmail = null;
let currentUserName = "Пользователь";

// Адрес API (для локального теста)
const API_URL = '/api/items/'; 

// Вспомогательная функция для получения CSRF-токена Django
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

// Имитация базы пользователей (для входа)
let usersDB = JSON.parse(localStorage.getItem('usersDB')) || [
  { name: 'Тест', email: 'test@tpu.ru', password: '123456' }
];

// АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ
const loginModal = document.getElementById('loginModal');
const openLoginBtn = document.getElementById('openLoginBtn');
const closeLoginBtn = document.getElementById('closeLoginBtn');
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const authError = document.getElementById('authError');
const profileEmailDisplay = document.getElementById('profileEmailDisplay');

const headerGuest = document.getElementById('headerGuest');
const headerUserBlock = document.getElementById('headerUserBlock');
const logoutBtn = document.getElementById('logoutBtn');

const tabLoginBtn = document.getElementById('tabLoginBtn');
const tabRegisterBtn = document.getElementById('tabRegisterBtn');
const regNameField = document.getElementById('regNameField');
const regNameInput = document.getElementById('regNameInput');
const authSubmitBtn = document.getElementById('authSubmitBtn');

let authMode = 'login';

function showLoginModal() { 
  loginModal.classList.remove('hidden'); 
  switchAuthMode('login');
}

openLoginBtn.addEventListener('click', showLoginModal);
closeLoginBtn.addEventListener('click', () => loginModal.classList.add('hidden'));

function switchAuthMode(mode) {
  authMode = mode;
  authError.classList.add('hidden');
  loginForm.reset();

  if (mode === 'login') {
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
    regNameField.classList.add('hidden');
    authSubmitBtn.textContent = 'Войти';
  } else {
    tabLoginBtn.classList.remove('active');
    tabRegisterBtn.classList.add('active');
    regNameField.classList.remove('hidden');
    authSubmitBtn.textContent = 'Зарегистрироваться';
  }
}

tabLoginBtn.addEventListener('click', () => switchAuthMode('login'));
tabRegisterBtn.addEventListener('click', () => switchAuthMode('register'));

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value.trim();
  const name = regNameInput.value.trim();

  if (!email.includes('@') || email.length < 5 || password === '') {
    authError.textContent = 'Введите корректный email и пароль';
    authError.classList.remove('hidden');
    return;
  }

  if (authMode === 'register') {
    if (name === '') {
      authError.textContent = 'Введите ваше имя';
      authError.classList.remove('hidden');
      return;
    }
    usersDB.push({ name: name, email: email, password: password });
    localStorage.setItem('usersDB', JSON.stringify(usersDB));
    loginSuccess(email, name);
  } else {
    const user = usersDB.find(u => u.email === email && u.password === password);
    if (!user) {
      authError.textContent = 'Неверный email или пароль';
      authError.classList.remove('hidden');
      return;
    }
    loginSuccess(email, user.name);
  }
});

function loginSuccess(email, name) {
  isLoggedIn = true;
  currentUserEmail = email;
  currentUserName = name;
  
  localStorage.setItem('currentUserEmail', email);
  // Если имя в профиле еще не задано, задаем его из формы
  if (!localStorage.getItem('userFirstName')) {
    localStorage.setItem('userFirstName', name);
  }

  profileEmailDisplay.textContent = email;
  headerGuest.classList.add('hidden');
  headerUserBlock.classList.remove('hidden');
  loginModal.classList.add('hidden');
  loginForm.reset();

  updateProfileUI();
  loadPostsFromServer(); // Загружаем посты с сервера

  if (pendingTarget) {
    switchTab(pendingTarget);
    pendingTarget = null;
  }
}

logoutBtn.addEventListener('click', () => {
  isLoggedIn = false;
  currentUserEmail = null;
  localStorage.removeItem('currentUserEmail');
  headerUserBlock.classList.add('hidden');
  headerGuest.classList.remove('hidden');
  switchTab('feed');
  renderFeed(); 
});

// ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
const menuItems = document.querySelectorAll('.menu-item[data-target]');
const tabs = document.querySelectorAll('.tab-content');
let pendingTarget = null;

function switchTab(targetName) {
  menuItems.forEach(m => m.classList.remove('active'));
  tabs.forEach(t => t.classList.remove('active'));
  
  const menuItem = document.querySelector(`.menu-item[data-target="${targetName}"]`);
  if (menuItem) menuItem.classList.add('active');
  
  document.getElementById('tab-' + targetName).classList.add('active');

  if (targetName === 'lost') renderMyPosts();
}

menuItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const target = item.dataset.target;
    
    // Ленту смотрим без регистрации
    if (target === 'feed') { switchTab(target); return; }
    
    // Остальное требует входа
    if (!isLoggedIn) { pendingTarget = target; showLoginModal(); return; }
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
let currentAvatarBase64 = null;

// Заполняем форму при открытии
openEditProfileBtn.addEventListener('click', () => {
  editFirstName.value = localStorage.getItem('userFirstName') || '';
  editLastName.value = localStorage.getItem('userLastName') || '';
  editNickname.value = localStorage.getItem('userNickname') || '';
  editSchool.value = localStorage.getItem('userSchool') || '';
  editGroup.value = localStorage.getItem('userGroup') || '';
  editBio.value = localStorage.getItem('userBio') || '';

  currentAvatarBase64 = localStorage.getItem('userAvatar');
  if (currentAvatarBase64) {
    editAvatarPreview.style.backgroundImage = `url(${currentAvatarBase64})`;
  } else {
    editAvatarPreview.style.backgroundImage = 'none';
  }

  editProfileModal.classList.remove('hidden');
});

closeEditProfileBtn.addEventListener('click', () => editProfileModal.classList.add('hidden'));

// Загрузка новой аватарки
avatarUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      currentAvatarBase64 = event.target.result;
      editAvatarPreview.style.backgroundImage = `url(${currentAvatarBase64})`;
    };
    reader.readAsDataURL(file);
  }
});

removeAvatarBtn.addEventListener('click', () => {
  currentAvatarBase64 = null;
  editAvatarPreview.style.backgroundImage = 'none';
  avatarUpload.value = ''; 
});

saveProfileBtn.addEventListener('click', () => {
  localStorage.setItem('userFirstName', editFirstName.value.trim());
  localStorage.setItem('userLastName', editLastName.value.trim());
  localStorage.setItem('userNickname', editNickname.value.trim());
  localStorage.setItem('userSchool', editSchool.value.trim());
  localStorage.setItem('userGroup', editGroup.value.trim());
  localStorage.setItem('userBio', editBio.value.trim());

  if (currentAvatarBase64) {
    localStorage.setItem('userAvatar', currentAvatarBase64);
  } else {
    localStorage.removeItem('userAvatar');
  }

  updateProfileUI();
  editProfileModal.classList.add('hidden');
  renderFeed(); // Обновляем аватарку в постах
  if (document.getElementById('tab-lost').classList.contains('active')) renderMyPosts();
});

// Обновление интерфейса профиля
function updateProfileUI() {
  const firstName = localStorage.getItem('userFirstName') || '';
  const lastName = localStorage.getItem('userLastName') || '';
  const nickname = localStorage.getItem('userNickname') || '';
  const school = localStorage.getItem('userSchool') || 'Не указана';
  const group = localStorage.getItem('userGroup') || 'Не указана';
  const bio = localStorage.getItem('userBio') || 'Не указано';
  const avatar = localStorage.getItem('userAvatar');

  const fullName = `${lastName} ${firstName}`.trim() || 'Без имени';
  const displayHeaderName = nickname || firstName || 'Пользователь';
  
  headerUserName.textContent = displayHeaderName;
  profileNameDisplay.textContent = fullName;
  profileNicknameDisplay.textContent = nickname ? `@${nickname.replace('@', '')}` : '';
  profileSchoolDisplay.textContent = school;
  profileGroupDisplay.textContent = group;
  profileBioDisplay.textContent = bio;

  if (avatar) {
    headerAvatar.style.backgroundImage = `url(${avatar})`;
    profileAvatar.style.backgroundImage = `url(${avatar})`;
  } else {
    headerAvatar.style.backgroundImage = 'none';
    profileAvatar.style.backgroundImage = 'none';
  }
}

// СОЗДАНИЕ ПОСТА
const createPostModal = document.getElementById('createPostModal');
const openCreatePostBtn = document.getElementById('openCreatePostBtn');
const closeCreatePostBtn = document.getElementById('closeCreatePostBtn');
const submitPostBtn = document.getElementById('submitPostBtn');

const postTitleInput = document.getElementById('postTitleInput');
const postCategorySelect = document.getElementById('postCategorySelect');
const postLocationInput = document.getElementById('postLocationInput');
const postDateEventInput = document.getElementById('postDateEventInput');
const postTypeSelect = document.getElementById('postTypeSelect');
const postBuildingSelect = document.getElementById('postBuildingSelect');
const postTextInput = document.getElementById('postTextInput');
const postPhotoUpload = document.getElementById('postPhotoUpload');
const postPhotoPreviewWrapper = document.getElementById('postPhotoPreviewWrapper');
const postPhotoPreview = document.getElementById('postPhotoPreview');
const removePostPhotoBtn = document.getElementById('removePostPhotoBtn');

openCreatePostBtn.addEventListener('click', () => {
  if (!isLoggedIn) { showLoginModal(); return; }
  createPostModal.classList.remove('hidden');
});

closeCreatePostBtn.addEventListener('click', () => createPostModal.classList.add('hidden'));

postPhotoUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      postPhotoPreview.style.backgroundImage = `url(${event.target.result})`;
      postPhotoPreviewWrapper.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }
});

removePostPhotoBtn.addEventListener('click', () => {
  postPhotoUpload.value = '';
  postPhotoPreview.style.backgroundImage = 'none';
  postPhotoPreviewWrapper.classList.add('hidden');
});

submitPostBtn.addEventListener('click', async () => {
  const title = postTitleInput.value.trim();
  const description = postTextInput.value.trim();
  const location = postLocationInput.value.trim();
  const dateEvent = postDateEventInput.value;
  const file = postPhotoUpload.files[0];

  if (!title || !description) { 
    alert('Заполните название и описание!'); 
    return; 
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  formData.append('status', postTypeSelect.value);
  formData.append('location', location);
  formData.append('date_event', dateEvent || new Date().toISOString().split('T')[0]);
  formData.append('category', postCategorySelect.value);
  formData.append('building', postBuildingSelect.value);

  if (file) formData.append('image', file);

  try {
    submitPostBtn.textContent = 'Публикация...';
    submitPostBtn.disabled = true;

    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
      headers: {
        'X-CSRFToken': getCookie('csrftoken') 
      }
    });

    if (!response.ok) throw new Error('Ошибка сервера');

    // Очищаем форму
    postTitleInput.value = '';
    postTextInput.value = '';
    postLocationInput.value = '';
    postPhotoUpload.value = '';
    postPhotoPreviewWrapper.classList.add('hidden');
    createPostModal.classList.add('hidden');
    
    // Обновляем ленту
    loadPostsFromServer();

  } catch (error) {
    console.error(error);
    alert('Не удалось опубликовать. Проверьте консоль (F12).');
  } finally {
    submitPostBtn.textContent = 'Опубликовать';
    submitPostBtn.disabled = false;
  }
});

// ЗАГРУЗКА И ОТРИСОВКА ПОСТОВ (GET)
let serverPosts = [];

async function loadPostsFromServer() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Ошибка сети');
    serverPosts = await response.json();
    renderFeed();
  } catch (error) {
    console.error("Не удалось загрузить посты:", error);
    document.getElementById('postsContainer').innerHTML = `
      <div class="empty-state">Не удалось загрузить объявления. Сервер недоступен.</div>
    `;
  }
}

function renderFeed() {
  const container = document.getElementById('postsContainer');
  container.innerHTML = ''; 

  if (serverPosts.length === 0) {
    container.innerHTML = '<div class="empty-state">Пока нет объявлений.</div>';
    return;
  }

  serverPosts.forEach(post => {
    let actionBtnText = post.status === 'lost' ? 'Видел(а)' : 'Это моё';
    let typeText = post.status === 'lost' ? 'Потеряно' : (post.status === 'found' ? 'Найдено' : 'Возвращено');
    
    let postDate = new Date(post.created_at).toLocaleString('ru-RU', { 
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
    });

    let imageHtml = post.image 
      ? `<div class="post-image" style="background-image: url('${post.image}'); background-size: cover; background-position: center; height: 300px;"></div>`
      : `<div class="post-image">Фото вещи</div>`;

    const postHTML = `
      <article class="card post" data-id="${post.id}" data-type="${post.status}" data-building="${post.building}">
        <div class="post-header">
          <div class="avatar avatar-small"></div>
          <div class="post-meta">
            <div class="post-author">${post.author_name || 'Аноним'}</div>
            <div class="post-date">${postDate}</div>
          </div>
        </div>
        <div class="post-body">
          <h4 style="margin-bottom: 5px;">${post.title}</h4>
          <p><strong>${typeText} (${post.location}):</strong> ${post.description}</p>
          ${imageHtml}
        </div>
        <div class="post-actions">
          <button class="btn-action ${!isLoggedIn ? 'auth-required' : ''}">${actionBtnText}</button>
          <button class="btn-action ${!isLoggedIn ? 'auth-required' : ''}">Написать</button>
        </div>
      </article>
    `;
    container.insertAdjacentHTML('beforeend', postHTML);
  });

  document.querySelectorAll('.auth-required').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!isLoggedIn) { e.preventDefault(); showLoginModal(); }
      else { alert('Действие выполнено!'); }
    });
  });
  applyFilters();
}

// Отрисовка "Мои находки"
function renderMyPosts() {
  const container = document.getElementById('myPostsContainer');
  if (!container) return;
  container.innerHTML = '';

  // Сравниваем по имени автора (так как ID автора может быть недоступен в JSON)
  const myPosts = serverPosts.filter(post => post.author_name === currentUserName);

  if (myPosts.length === 0) {
    container.innerHTML = '<div class="card"><div class="empty-state">Вы ещё не публиковали объявления.</div></div>';
    return;
  }

  myPosts.forEach(post => {
    let typeText = post.status === 'lost' ? 'Потеряно' : 'Найдено';
    let imageHtml = post.image ? `<div class="post-image" style="background-image: url('${post.image}'); background-size: cover; background-position: center; height: 200px;"></div>` : '';

    const postHTML = `
      <article class="card post" style="margin-bottom: 10px;">
        <div class="post-body">
          <h4>${post.title}</h4>
          <p><strong>${typeText} (${post.location}):</strong> ${post.description}</p>
          ${imageHtml}
        </div>
        <div class="my-post-actions">
          <button class="btn-edit-post" onclick="editPost('${post.id}')">Редактировать</button>
          <button class="btn-delete-post" onclick="deletePost('${post.id}')">Удалить</button>
        </div>
      </article>
    `;
    container.insertAdjacentHTML('beforeend', postHTML);
  });
}

// Заглушки, пока нет PATCH и DELETE
window.editPost = function(id) { alert('Редактирование через API мы подключим на следующем шаге.'); };
window.deletePost = function(id) { alert('Удаление через API мы подключим на следующем шаге.'); };

// ФИЛЬТРЫ
const state = { type: [], building: [] };
const emptyState = document.getElementById('emptyState');
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

document.querySelectorAll('[data-filter]').forEach(cb => {
  cb.addEventListener('change', () => {
    const group = cb.dataset.filter;
    const value = cb.value;
    if (cb.checked) state[group].push(value);
    else state[group] = state[group].filter(v => v !== value);
    updateLabels();
    applyFilters();
  });
});

function updateLabels() {
  if (state.type.length === 0) labelType.textContent = 'Все';
  else if (state.type.length === 1) labelType.textContent = state.type[0] === 'lost' ? 'Потеряно' : 'Найдено';
  else labelType.textContent = 'Несколько';

  if (state.building.length === 0) labelBuilding.textContent = 'Все';
  else if (state.building.length === 1) {
    const map = { 1: 'Корпус 1', 2: 'Корпус 2', 3: 'Корпус 3', 4: 'Корпус 4', 5: 'Корпус 5', 6: 'Корпус 6', 7: 'Корпус 7', 8: 'Корпус 8', 9: 'Корпус 9', 10: 'Корпус 10', 11: 'Корпус 11', 12: 'Корпус 12', 15: 'Корпус 15', 16: 'Корпус 16', 18: 'Корпус 18', 19: 'Корпус 19', 20: 'Корпус 20', 21: 'Корпус 21' };
    labelBuilding.textContent = map[state.building[0]] || `Корпус ${state.building[0]}`;
  } else labelBuilding.textContent = 'Несколько';
}

function applyFilters() {
  let visibleCount = 0;
  const allPosts = document.querySelectorAll('#postsContainer .post'); 
  
  allPosts.forEach(post => {
    const matchType = state.type.length === 0 || state.type.includes(post.dataset.type);
    const matchBuilding = state.building.length === 0 || state.building.includes(String(post.dataset.building));
    const isVisible = matchType && matchBuilding;
    post.style.display = isVisible ? '' : 'none';
    if (isVisible) visibleCount++;
  });
  emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
}

document.getElementById('resetFilters').addEventListener('click', () => {
  state.type = [];
  state.building = [];
  document.querySelectorAll('[data-filter]').forEach(cb => cb.checked = false);
  updateLabels();
  applyFilters();
});

// ИНФО-МОДАЛКА (Полезное)
const infoModal = document.getElementById('infoModal');
const closeInfoBtn = document.getElementById('closeInfoBtn');
const infoModalTitle = document.getElementById('infoModalTitle');
const infoModalContent = document.getElementById('infoModalContent');

const infoData = {
  'how-to-get': { title: 'Как забрать вещь', text: '... (текст)' },
  'rules': { title: 'Правила бюро', text: '... (текст)' },
  'contacts': { title: 'Контакты', text: '... (текст)' }
};

document.querySelectorAll('[data-info]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const key = link.dataset.info;
    const data = infoData[key];
    if (data) {
      infoModalTitle.textContent = data.title;
      infoModalContent.innerHTML = data.text;
      infoModal.classList.remove('hidden');
    }
  });
});

closeInfoBtn.addEventListener('click', () => infoModal.classList.add('hidden'));

// ЗАГРУЗКА ПРИ СТАРТЕ
window.addEventListener('load', () => {
  // Проверяем, залогинен ли пользователь
  const savedEmail = localStorage.getItem('currentUserEmail');
  if (savedEmail) {
    const user = usersDB.find(u => u.email === savedEmail);
    if (user) {
      isLoggedIn = true;
      currentUserEmail = savedEmail;
      currentUserName = user.name;
      headerGuest.classList.add('hidden');
      headerUserBlock.classList.remove('hidden');
      profileEmailDisplay.textContent = savedEmail;
    }
  }

  // Подтягиваем аватарку
  const savedAvatar = localStorage.getItem('userAvatar');
  if (savedAvatar) {
    currentAvatarBase64 = savedAvatar;
    headerAvatar.style.backgroundImage = `url(${savedAvatar})`;
    profileAvatar.style.backgroundImage = `url(${savedAvatar})`;
  }
  
  updateProfileUI();
  loadPostsFromServer(); // Загружаем посты с сервера
});
