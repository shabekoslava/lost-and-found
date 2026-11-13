let isLoggedIn = false; 
let currentUserEmail = null;

// ИМИТАЦИЯ БАЗЫ ДАННЫХ (ЧЕРЕЗ LOCALSTORAGE)

// Пользователи
let usersDB = JSON.parse(localStorage.getItem('usersDB')) || [
  { name: 'Тест', email: 'test@tpu.ru', password: '123456' }
];

// Посты
let postsData = [
  {
    id: '1', authorId: 'other', authorName: 'Анна', authorAvatar: '',
    type: 'found', building: 'main', buildingText: 'Главный корпус',
    text: 'чёрный зонт в Главном корпусе, ауд. 305.', image: 'placeholder', date: 'сегодня в 14:32'
  },
  {
    id: '2', authorId: 'other', authorName: 'Дмитрий', authorAvatar: '',
    type: 'lost', building: '16b', buildingText: 'Корпус 16Б',
    text: 'студенческий билет №123456 (16Б).', image: 'placeholder', date: 'сегодня в 11:05'
  }
];

// АВТОРИЗАЦИЯ

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

// Вкладки внутри модалки
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

    const userExists = usersDB.find(u => u.email === email);
    if (userExists) {
      authError.textContent = 'Пользователь с таким email уже существует';
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
  
  localStorage.setItem('currentUserEmail', email);
  if (name && !localStorage.getItem('userFirstName')) {
    localStorage.setItem('userFirstName', name);
  }

  profileEmailDisplay.textContent = email;
  headerGuest.classList.add('hidden');
  headerUserBlock.classList.remove('hidden');
  loginModal.classList.add('hidden');
  loginForm.reset();

  updateProfileUI();
  renderFeed();
  if (document.getElementById('tab-lost').classList.contains('active')) renderMyPosts();

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
    if (target === 'feed') { switchTab(target); return; }
    if (!isLoggedIn) { pendingTarget = target; showLoginModal(); return; }
    switchTab(target);
  });
});

// ПРОФИЛЬ

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

window.addEventListener('load', () => {
  // Проверяем, залогинен ли пользователь (если сохраняли сессию)
  const savedEmail = localStorage.getItem('currentUserEmail');
  if (savedEmail) {
    const user = usersDB.find(u => u.email === savedEmail);
    if (user) {
      isLoggedIn = true;
      currentUserEmail = savedEmail;
      headerGuest.classList.add('hidden');
      headerUserBlock.classList.remove('hidden');
      profileEmailDisplay.textContent = savedEmail;
    }
  }

  const savedAvatar = localStorage.getItem('userAvatar');
  if (savedAvatar) {
    currentAvatarBase64 = savedAvatar;
    headerAvatar.style.backgroundImage = `url(${savedAvatar})`;
    profileAvatar.style.backgroundImage = `url(${savedAvatar})`;
  }
  updateProfileUI();
  renderFeed();
});

openEditProfileBtn.addEventListener('click', () => {
  editFirstName.value = localStorage.getItem('userFirstName') || '';
  editLastName.value = localStorage.getItem('userLastName') || '';
  editNickname.value = localStorage.getItem('userNickname') || '';
  editSchool.value = localStorage.getItem('userSchool') || '';
  editGroup.value = localStorage.getItem('userGroup') || '';
  editBio.value = localStorage.getItem('userBio') || '';
  
  if (currentAvatarBase64) editAvatarPreview.style.backgroundImage = `url(${currentAvatarBase64})`;
  else editAvatarPreview.style.backgroundImage = 'none';
  editProfileModal.classList.remove('hidden');
});

closeEditProfileBtn.addEventListener('click', () => editProfileModal.classList.add('hidden'));

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

  if (currentAvatarBase64) localStorage.setItem('userAvatar', currentAvatarBase64);
  else localStorage.removeItem('userAvatar');

  updateProfileUI();
  editProfileModal.classList.add('hidden');
  renderFeed();
  if (document.getElementById('tab-lost').classList.contains('active')) renderMyPosts();
});

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

const postTypeSelect = document.getElementById('postTypeSelect');
const postBuildingSelect = document.getElementById('postBuildingSelect');
const postTextInput = document.getElementById('postTextInput');
const postPhotoUpload = document.getElementById('postPhotoUpload');

const postPhotoPreviewWrapper = document.getElementById('postPhotoPreviewWrapper');
const postPhotoPreview = document.getElementById('postPhotoPreview');
const removePostPhotoBtn = document.getElementById('removePostPhotoBtn');
let postImageBase64 = null;

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
      postImageBase64 = event.target.result;
      postPhotoPreview.style.backgroundImage = `url(${postImageBase64})`;
      postPhotoPreviewWrapper.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }
});

removePostPhotoBtn.addEventListener('click', () => {
  postImageBase64 = null;
  postPhotoUpload.value = '';
  postPhotoPreview.style.backgroundImage = 'none';
  postPhotoPreviewWrapper.classList.add('hidden');
});

submitPostBtn.addEventListener('click', () => {
  const text = postTextInput.value.trim();
  if (!text) { alert('Введите текст описания!'); return; }

  const type = postTypeSelect.value;
  const building = postBuildingSelect.value;
  const buildingText = postBuildingSelect.options[postBuildingSelect.selectedIndex].text;
  
  const authorName = localStorage.getItem('userNickname') || localStorage.getItem('userFirstName') || 'Пользователь';
  const authorAvatar = localStorage.getItem('userAvatar') || '';

  const newPost = {
    id: Date.now().toString(),
    authorId: 'currentUser',
    authorName: authorName,
    authorAvatar: authorAvatar,
    type: type,
    building: building,
    buildingText: buildingText,
    text: text,
    image: postImageBase64,
    date: 'только что'
  };

  postsData.unshift(newPost);

  postTextInput.value = '';
  postImageBase64 = null;
  postPhotoUpload.value = '';
  postPhotoPreviewWrapper.classList.add('hidden');
  createPostModal.classList.add('hidden');
  
  document.getElementById('resetFilters').click();
  renderFeed();
  renderMyPosts();
});


// ОТРИСОВКА ПОСТОВ

function renderFeed() {
  const container = document.getElementById('postsContainer');
  container.innerHTML = ''; 

  postsData.forEach(post => {
    let actionBtnText = post.type === 'lost' ? 'Видел(а)' : 'Это моё';
    
    let imageHtml = '';
    if (post.image === 'placeholder') {
      imageHtml = `<div class="post-image">Фото вещи</div>`;
    } else if (post.image) {
      imageHtml = `<div class="post-image" style="background-image: url('${post.image}'); background-size: cover; background-position: center; height: 300px;"></div>`;
    }

    const postHTML = `
      <article class="card post" data-id="${post.id}" data-type="${post.type}" data-building="${post.building}">
        <div class="post-header">
          <div class="avatar avatar-small" style="background-image: url('${post.authorAvatar}')"></div>
          <div class="post-meta">
            <div class="post-author">${post.authorName}</div>
            <div class="post-date">${post.date}</div>
          </div>
        </div>
        <div class="post-body">
          <p><strong>${post.type === 'lost' ? 'Потеряно' : 'Найдено'} (${post.buildingText}):</strong> ${post.text}</p>
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

function renderMyPosts() {
  const container = document.getElementById('myPostsContainer');
  if (!container) return;
  container.innerHTML = '';

  const myPosts = postsData.filter(post => post.authorId === 'currentUser');

  if (myPosts.length === 0) {
    container.innerHTML = '<div class="card"><div class="empty-state">Вы ещё не публиковали объявления.</div></div>';
    return;
  }

  myPosts.forEach(post => {
    let imageHtml = '';
    if (post.image === 'placeholder') {
      imageHtml = `<div class="post-image">Фото вещи</div>`;
    } else if (post.image) {
      imageHtml = `<div class="post-image" style="background-image: url('${post.image}'); background-size: cover; background-position: center; height: 200px;"></div>`;
    }

    const postHTML = `
      <article class="card post" style="margin-bottom: 10px;">
        <div class="post-body">
          <p><strong>${post.type === 'lost' ? 'Потеряно' : 'Найдено'} (${post.buildingText}):</strong> ${post.text}</p>
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

// РЕДАКТИРОВАНИЕ И УДАЛЕНИЕ ПОСТОВ

const editPostModal = document.getElementById('editPostModal');
const closeEditPostBtn = document.getElementById('closeEditPostBtn');
const saveEditedPostBtn = document.getElementById('saveEditedPostBtn');

const editPostId = document.getElementById('editPostId');
const editPostText = document.getElementById('editPostText');
const editPostPhotoUpload = document.getElementById('editPostPhotoUpload');
const editPostPhotoPreviewWrapper = document.getElementById('editPostPhotoPreviewWrapper');
const editPostPhotoPreview = document.getElementById('editPostPhotoPreview');
const removeEditPostPhotoBtn = document.getElementById('removeEditPostPhotoBtn');
let editPostImageBase64 = null;

closeEditPostBtn.addEventListener('click', () => editPostModal.classList.add('hidden'));

editPostPhotoUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      editPostImageBase64 = event.target.result;
      editPostPhotoPreview.style.backgroundImage = `url(${editPostImageBase64})`;
      editPostPhotoPreviewWrapper.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }
});

removeEditPostPhotoBtn.addEventListener('click', () => {
  editPostImageBase64 = null;
  editPostPhotoUpload.value = '';
  editPostPhotoPreview.style.backgroundImage = 'none';
  editPostPhotoPreviewWrapper.classList.add('hidden');
});

window.editPost = function(id) {
  const post = postsData.find(p => p.id === id);
  if (!post) return;

  editPostId.value = id;
  editPostText.value = post.text;
  editPostImageBase64 = post.image;

  if (post.image && post.image !== 'placeholder') {
    editPostPhotoPreview.style.backgroundImage = `url(${post.image})`;
    editPostPhotoPreviewWrapper.classList.remove('hidden');
  } else {
    editPostPhotoPreview.style.backgroundImage = 'none';
    editPostPhotoPreviewWrapper.classList.add('hidden');
  }

  editPostModal.classList.remove('hidden');
};

window.deletePost = function(id) {
  if (confirm('Вы уверены, что хотите удалить это объявление?')) {
    postsData = postsData.filter(p => p.id !== id);
    renderFeed();
    renderMyPosts();
  }
};

saveEditedPostBtn.addEventListener('click', () => {
  const id = editPostId.value;
  const newText = editPostText.value.trim();
  
  if (!newText) { alert('Введите текст!'); return; }

  const postIndex = postsData.findIndex(p => p.id === id);
  if (postIndex !== -1) {
    postsData[postIndex].text = newText;
    postsData[postIndex].image = editPostImageBase64;
  }

  editPostModal.classList.add('hidden');
  renderFeed();
  renderMyPosts();
});

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

    if (cb.checked) {
      state[group].push(value);
    } else {
      state[group] = state[group].filter(v => v !== value);
    }

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
    const map = { 
      main: 'Главный', 1: 'Корпус 1', 2: 'Корпус 2', 3: 'Корпус 3', 4: 'Корпус 4', 
      5: 'Корпус 5', 6: 'Корпус 6', 7: 'Корпус 7', 8: 'Корпус 8', 9: 'Корпус 9', 
      10: 'Корпус 10', 11: 'Корпус 11', 12: 'Корпус 12', 15: 'Корпус 15', 16: 'Корпус 16', 
      '16a': 'Корпус 16А', '16b': 'Корпус 16Б',
      18: 'Корпус 18', 19: 'Корпус 19', 20: 'Корпус 20', 21: 'Корпус 21', library: 'НТБ' 
    };
    labelBuilding.textContent = map[state.building[0]] || state.building[0];
  } else labelBuilding.textContent = 'Несколько';
}

function applyFilters() {
  let visibleCount = 0;
  const allPosts = document.querySelectorAll('#postsContainer .post'); 
  
  allPosts.forEach(post => {
    const matchType = state.type.length === 0 || state.type.includes(post.dataset.type);
    const matchBuilding = state.building.length === 0 || state.building.includes(post.dataset.building);
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

// МОДАЛКА ПОЛЕЗНОЙ ИНФОРМАЦИИ

const infoModal = document.getElementById('infoModal');
const closeInfoBtn = document.getElementById('closeInfoBtn');
const infoModalTitle = document.getElementById('infoModalTitle');
const infoModalContent = document.getElementById('infoModalContent');

const infoData = {
  'how-to-get': {
    title: 'Как забрать вещь',
    text: 'Если вы нашли свою вещь в объявлении:<br><br>1. Нажмите кнопку «Это моё» или «Написать» под постом.<br>2. Свяжитесь с автором объявления, чтобы договориться о встрече.<br>3. При встрече обязательно подтвердите, что вещь ваша (например, назовите особые приметы).<br><br>Помните: администрация сайта не хранит вещи, мы лишь помогаем людям найти друг друга!'
  },
  'rules': {
    title: 'Правила бюро',
    text: '1. Публикуйте только реальные объявления о потерянных или найденных вещах.<br>2. Указывайте точный корпус и аудиторию, чтобы быстрее найти владельца.<br>3. Запрещено размещать оскорбительный контент, спам и рекламу.<br>4. Если вещь нашлась или вы вернули её владельцу — удалите объявление.<br>5. Не передавайте ценные вещи незнакомцам без свидетелей.'
  },
  'contacts': {
    title: 'Контакты',
    text: '<b>Тут будут контакты разные</b><br>.....<br><br><b>Телефон:</b> +7 .... <br><b>Email:</b> .....@tpu.ru<br><b>Telegram:</b> @.....<br>'
  }
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

closeInfoBtn.addEventListener('click', () => {
  infoModal.classList.add('hidden');
});