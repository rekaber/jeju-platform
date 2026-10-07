/* js/auth.js — 관리자 선등록 아이디 + 로그인 / 최초 비밀번호 변경 */
var AUTH_USERS_KEY = 'jeju_auth_users_v2';
var AUTH_SESSION_KEY = 'jeju_auth_session';
var AUTH_DEFAULT_PW = '1234!';
var AUTH_ADMIN_ID = 'admin';
var AUTH_PENDING_ID = null;

function authLoadUsers() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USERS_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function authSaveUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function getAuthSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(AUTH_SESSION_KEY) || 'null');
    if (!s || !s.id) return null;
    const user = authLoadUsers()[s.id];
    if (!user) {
      clearAuthSession();
      return null;
    }
    s.role = user.role || 'user';
    return s;
  } catch (e) {
    return null;
  }
}

function setAuthSession(id) {
  const user = authLoadUsers()[id];
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
    id: id,
    role: (user && user.role) || 'user'
  }));
}

function clearAuthSession() {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function isAdminSession() {
  const s = getAuthSession();
  return !!(s && s.role === 'admin');
}

async function hashPw(pw) {
  const raw = 'jeju-auth-v1:' + pw;
  if (window.crypto && crypto.subtle) {
    try {
      const data = new TextEncoder().encode(raw);
      const buf = await crypto.subtle.digest('SHA-256', data);
      return [...new Uint8Array(buf)].map(function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    } catch (e) { /* file:// 등 */ }
  }
  var h = 5381;
  for (var i = 0; i < raw.length; i++) h = ((h << 5) + h) ^ raw.charCodeAt(i);
  return 'fb_' + (h >>> 0).toString(16);
}

async function ensureAdminUser() {
  const users = authLoadUsers();
  if (!users[AUTH_ADMIN_ID]) {
    users[AUTH_ADMIN_ID] = {
      hash: await hashPw(AUTH_DEFAULT_PW),
      mustChange: true,
      role: 'admin'
    };
    authSaveUsers(users);
    return;
  }
  if (users[AUTH_ADMIN_ID].role !== 'admin') {
    users[AUTH_ADMIN_ID].role = 'admin';
    authSaveUsers(users);
  }
}

function authSetError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.classList.remove('is-ok');
  el.textContent = msg || '';
}

function refreshAuthUI() {
  const box = document.getElementById('auth-user-box');
  const label = document.getElementById('auth-user-label');
  const adminBtn = document.getElementById('admin-users-btn');
  const session = getAuthSession();
  if (!box) return;
  if (session) {
    box.classList.add('is-on');
    if (label) {
      label.textContent = session.role === 'admin'
        ? session.id + ' (관리자)'
        : session.id + ' 님';
    }
    if (adminBtn) adminBtn.style.display = session.role === 'admin' ? '' : 'none';
  } else {
    box.classList.remove('is-on');
    if (label) label.textContent = '';
    if (adminBtn) adminBtn.style.display = 'none';
  }
}

function showLogin() {
  clearAuthSession();
  refreshAuthUI();
  const intro = document.getElementById('intro-content');
  const panel = document.getElementById('login-panel');
  if (intro) intro.style.display = 'none';
  if (panel) panel.classList.add('is-open');
  showLoginView();
  const pwInput = document.getElementById('login-pw');
  if (pwInput) pwInput.value = '';
  setTimeout(function () {
    const idInput = document.getElementById('login-id');
    if (idInput) idInput.focus();
  }, 50);
}

function showLoginView() {
  const loginForm = document.getElementById('login-form');
  const firstForm = document.getElementById('first-pw-form');
  if (loginForm) loginForm.classList.remove('is-hidden');
  if (firstForm) firstForm.classList.add('is-hidden');
  authSetError('login-error', '');
}

function showFirstPwView(id) {
  AUTH_PENDING_ID = id;
  const loginForm = document.getElementById('login-form');
  const firstForm = document.getElementById('first-pw-form');
  const who = document.getElementById('first-pw-who');
  if (loginForm) loginForm.classList.add('is-hidden');
  if (firstForm) firstForm.classList.remove('is-hidden');
  if (who) who.textContent = id;
  authSetError('first-pw-error', '');
  const nw = document.getElementById('first-pw-new');
  const cf = document.getElementById('first-pw-confirm');
  if (nw) nw.value = '';
  if (cf) cf.value = '';
  setTimeout(function () { if (nw) nw.focus(); }, 50);
}

function enterPlatform(id) {
  setAuthSession(id);
  AUTH_PENDING_ID = null;
  refreshAuthUI();
  dismissIntro();
}

function validateNewPassword(pw, confirm) {
  if (!pw) return '새 비밀번호를 입력해 주세요.';
  if (pw.length < 4) return '비밀번호는 4자 이상이어야 합니다.';
  if (pw === AUTH_DEFAULT_PW) return '최초 비밀번호(1234!)는 사용할 수 없습니다.';
  if (pw !== confirm) return '새 비밀번호가 일치하지 않습니다.';
  return '';
}

function validateUserId(id) {
  if (!id) return '아이디를 입력해 주세요.';
  if (/\s/.test(id)) return '아이디에 공백은 사용할 수 없습니다.';
  if (id.length < 2 || id.length > 20) return '아이디는 2~20자여야 합니다.';
  if (!/^[A-Za-z0-9가-힣._-]+$/.test(id)) return '아이디는 영문, 숫자, 한글, . _ - 만 사용할 수 있습니다.';
  return '';
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const id = (document.getElementById('login-id').value || '').trim();
  const pw = document.getElementById('login-pw').value || '';
  authSetError('login-error', '');
  if (!id) return authSetError('login-error', '아이디를 입력해 주세요.');
  if (!pw) return authSetError('login-error', '비밀번호를 입력해 주세요.');

  const users = authLoadUsers();
  const user = users[id];
  if (!user) {
    return authSetError('login-error', '등록되지 않은 아이디입니다. 관리자에게 등록을 요청하세요.');
  }

  const pwHash = await hashPw(pw);
  if (user.hash !== pwHash) {
    return authSetError('login-error', '아이디 또는 비밀번호가 올바르지 않습니다.');
  }
  if (user.mustChange) {
    showFirstPwView(id);
    return;
  }
  enterPlatform(id);
}

async function handleFirstPwSubmit(e) {
  e.preventDefault();
  const id = AUTH_PENDING_ID;
  if (!id) return showLoginView();
  const pw = document.getElementById('first-pw-new').value || '';
  const confirm = document.getElementById('first-pw-confirm').value || '';
  const err = validateNewPassword(pw, confirm);
  if (err) return authSetError('first-pw-error', err);

  const users = authLoadUsers();
  if (!users[id]) {
    return authSetError('first-pw-error', '등록되지 않은 아이디입니다.');
  }
  users[id].hash = await hashPw(pw);
  users[id].mustChange = false;
  authSaveUsers(users);
  enterPlatform(id);
}

function logoutUser() {
  clearAuthSession();
  refreshAuthUI();
  const overlay = document.getElementById('intro-overlay');
  const intro = document.getElementById('intro-content');
  const panel = document.getElementById('login-panel');
  if (overlay) {
    overlay.classList.remove('fade-out');
    overlay.style.display = 'flex';
  }
  if (intro) intro.style.display = 'none';
  if (panel) panel.classList.add('is-open');
  const idInput = document.getElementById('login-id');
  const pwInput = document.getElementById('login-pw');
  if (pwInput) pwInput.value = '';
  showLoginView();
  closePwChangeModal();
  closeAdminUsersModal();
  if (idInput) idInput.focus();
}

function openPwChangeModal() {
  if (!getAuthSession()) return;
  const modal = document.getElementById('pw-change-modal');
  if (!modal) return;
  ['pw-cur', 'pw-new', 'pw-confirm'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  authSetError('pw-change-error', '');
  modal.classList.add('is-open');
  const cur = document.getElementById('pw-cur');
  if (cur) cur.focus();
}

function closePwChangeModal() {
  const modal = document.getElementById('pw-change-modal');
  if (modal) modal.classList.remove('is-open');
}

async function handlePwChangeSubmit(e) {
  e.preventDefault();
  const session = getAuthSession();
  if (!session) return;
  const cur = document.getElementById('pw-cur').value || '';
  const nw = document.getElementById('pw-new').value || '';
  const cf = document.getElementById('pw-confirm').value || '';
  authSetError('pw-change-error', '');
  if (!cur) return authSetError('pw-change-error', '현재 비밀번호를 입력해 주세요.');

  const users = authLoadUsers();
  const user = users[session.id];
  if (!user || user.hash !== await hashPw(cur)) {
    return authSetError('pw-change-error', '현재 비밀번호가 올바르지 않습니다.');
  }
  const err = validateNewPassword(nw, cf);
  if (err) return authSetError('pw-change-error', err);
  if (await hashPw(nw) === user.hash) {
    return authSetError('pw-change-error', '현재 비밀번호와 다른 비밀번호를 입력해 주세요.');
  }
  user.hash = await hashPw(nw);
  user.mustChange = false;
  users[session.id] = user;
  authSaveUsers(users);
  closePwChangeModal();
}

function openAdminUsersModal() {
  if (!isAdminSession()) return;
  const modal = document.getElementById('admin-users-modal');
  if (!modal) return;
  const input = document.getElementById('admin-new-id');
  if (input) input.value = '';
  authSetError('admin-users-msg', '');
  renderAdminUsersList();
  modal.classList.add('is-open');
  if (input) input.focus();
}

function closeAdminUsersModal() {
  const modal = document.getElementById('admin-users-modal');
  if (modal) modal.classList.remove('is-open');
}

function renderAdminUsersList() {
  const wrap = document.getElementById('admin-users-list');
  if (!wrap) return;
  const users = authLoadUsers();
  const ids = Object.keys(users).sort(function (a, b) {
    if (a === AUTH_ADMIN_ID) return -1;
    if (b === AUTH_ADMIN_ID) return 1;
    return a.localeCompare(b, 'ko');
  });
  if (!ids.length) {
    wrap.innerHTML = '<p class="admin-users-empty">등록된 계정이 없습니다.</p>';
    return;
  }
  wrap.innerHTML = ids.map(function (id) {
    const u = users[id];
    const isAdmin = u.role === 'admin' || id === AUTH_ADMIN_ID;
    const status = u.mustChange ? '최초 로그인 대기' : '사용 중';
    const actions = isAdmin
      ? '<button type="button" class="admin-row-btn" data-act="reset" data-id="' + id + '">비밀번호 초기화</button>'
      : '<button type="button" class="admin-row-btn" data-act="reset" data-id="' + id + '">비밀번호 초기화</button>' +
        '<button type="button" class="admin-row-btn danger" data-act="delete" data-id="' + id + '">삭제</button>';
    return '<div class="admin-user-row">' +
      '<div class="admin-user-meta">' +
        '<strong>' + id + '</strong>' +
        '<span class="admin-user-badge' + (isAdmin ? ' is-admin' : '') + '">' + (isAdmin ? '관리자' : '사용자') + '</span>' +
        '<span class="admin-user-status' + (u.mustChange ? ' is-wait' : '') + '">' + status + '</span>' +
      '</div>' +
      '<div class="admin-user-actions">' + actions + '</div>' +
    '</div>';
  }).join('');
}

async function handleAdminAddUser(e) {
  e.preventDefault();
  if (!isAdminSession()) return;
  const input = document.getElementById('admin-new-id');
  const id = ((input && input.value) || '').trim();
  const err = validateUserId(id);
  if (err) return authSetError('admin-users-msg', err);

  const users = authLoadUsers();
  if (users[id]) return authSetError('admin-users-msg', '이미 등록된 아이디입니다.');

  users[id] = {
    hash: await hashPw(AUTH_DEFAULT_PW),
    mustChange: true,
    role: 'user'
  };
  authSaveUsers(users);
  if (input) input.value = '';
  authSetError('admin-users-msg', '');
  const msg = document.getElementById('admin-users-msg');
  if (msg) {
    msg.classList.add('is-ok');
    msg.textContent = id + ' 아이디를 등록했습니다. 최초 비밀번호는 1234! 입니다.';
  }
  renderAdminUsersList();
}

async function handleAdminUserAction(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn || !isAdminSession()) return;
  const id = btn.getAttribute('data-id');
  const act = btn.getAttribute('data-act');
  const users = authLoadUsers();
  if (!users[id]) return;

  const msg = document.getElementById('admin-users-msg');
  if (msg) msg.classList.remove('is-ok');

  if (act === 'reset') {
    users[id].hash = await hashPw(AUTH_DEFAULT_PW);
    users[id].mustChange = true;
    authSaveUsers(users);
    if (msg) {
      msg.classList.add('is-ok');
      msg.textContent = id + ' 비밀번호를 1234! 로 초기화했습니다.';
    }
    renderAdminUsersList();
    return;
  }

  if (act === 'delete') {
    if (id === AUTH_ADMIN_ID || users[id].role === 'admin') {
      return authSetError('admin-users-msg', '관리자 계정은 삭제할 수 없습니다.');
    }
    const session = getAuthSession();
    if (session && session.id === id) {
      return authSetError('admin-users-msg', '현재 로그인한 계정은 삭제할 수 없습니다.');
    }
    delete users[id];
    authSaveUsers(users);
    if (msg) {
      msg.classList.add('is-ok');
      msg.textContent = id + ' 아이디를 삭제했습니다.';
    }
    renderAdminUsersList();
  }
}

(function initAuth() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  ensureAdminUser().then(function () {
    refreshAuthUI();
  });
  const loginForm = document.getElementById('login-form');
  const firstForm = document.getElementById('first-pw-form');
  const laterForm = document.getElementById('pw-change-form');
  const addForm = document.getElementById('admin-add-user-form');
  const list = document.getElementById('admin-users-list');
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
  if (firstForm) firstForm.addEventListener('submit', handleFirstPwSubmit);
  if (laterForm) laterForm.addEventListener('submit', handlePwChangeSubmit);
  if (addForm) addForm.addEventListener('submit', handleAdminAddUser);
  if (list) list.addEventListener('click', handleAdminUserAction);
})();
