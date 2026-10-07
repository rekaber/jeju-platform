/* js/auth.js — 관리자 선등록 아이디 + 로그인 / 최초 비밀번호 변경
   계정·비밀번호는 Supabase app_users(서버)에 저장되어 모든 PC에서 공유된다. */
var AUTH_LEGACY_USERS_KEY = 'jeju_auth_users_v2';
var AUTH_SESSION_KEY = 'jeju_auth_session';
var AUTH_DEFAULT_PW = '1234!';
var AUTH_ADMIN_ID = 'admin';
var AUTH_PRESET_IDS = ['jejusoa6891', 'jjy0811', 'jeju'];
var AUTH_PENDING = null;

async function authRpc(fn, params) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: 'Bearer ' + SUPABASE_ANON,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params || {})
  });
  if (!res.ok) throw new Error('auth rpc ' + fn + ' ' + res.status);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

var AUTH_NETWORK_ERR = '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';

function getAuthSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(AUTH_SESSION_KEY) || 'null');
    return s && s.id && s.token ? s : null;
  } catch (e) {
    return null;
  }
}

function setAuthSession(id, role, token) {
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
    id: id,
    role: role || 'user',
    token: token
  }));
}

function clearAuthSession() {
  const s = getAuthSession();
  if (s) authRpc('auth_logout', { p_token: s.token }).catch(function () {});
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function isAdminSession() {
  const s = getAuthSession();
  return !!(s && s.role === 'admin');
}

function isPresetUserId(id) {
  return AUTH_PRESET_IDS.indexOf(id) !== -1;
}

function authSetError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.classList.remove('is-ok');
  el.textContent = msg || '';
}

function authSetOk(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.classList.add('is-ok');
  el.textContent = msg || '';
}

function authSetBusy(form, busy) {
  const btn = form && form.querySelector('button[type="submit"]');
  if (btn) btn.disabled = !!busy;
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
  AUTH_PENDING = null;
  const loginForm = document.getElementById('login-form');
  const firstForm = document.getElementById('first-pw-form');
  if (loginForm) loginForm.classList.remove('is-hidden');
  if (firstForm) firstForm.classList.add('is-hidden');
  authSetError('login-error', '');
}

function showFirstPwView(id, curPw) {
  AUTH_PENDING = { id: id, pw: curPw };
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

function enterPlatform(id, role, token) {
  setAuthSession(id, role, token);
  AUTH_PENDING = null;
  refreshAuthUI();
  dismissIntro();
}

function validateNewPassword(pw, confirm) {
  if (!pw) return '새 비밀번호를 입력해 주세요.';
  if (pw.length < 4) return '비밀번호는 4자 이상이어야 합니다.';
  if (pw === AUTH_DEFAULT_PW) return '최초 비밀번호는 사용할 수 없습니다.';
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

function setPasswordErrorText(code) {
  switch (code) {
    case 'bad_password': return '현재 비밀번호가 올바르지 않습니다.';
    case 'too_short': return '비밀번호는 4자 이상이어야 합니다.';
    case 'default_password': return '최초 비밀번호는 사용할 수 없습니다.';
    case 'same_password': return '현재 비밀번호와 다른 비밀번호를 입력해 주세요.';
    case 'not_found': return '등록되지 않은 아이디입니다.';
    default: return '비밀번호를 변경하지 못했습니다.';
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const id = (document.getElementById('login-id').value || '').trim();
  const pw = document.getElementById('login-pw').value || '';
  authSetError('login-error', '');
  if (!id) return authSetError('login-error', '아이디를 입력해 주세요.');
  if (!pw) return authSetError('login-error', '비밀번호를 입력해 주세요.');

  authSetBusy(form, true);
  var r;
  try {
    r = await authRpc('auth_login', { p_id: id, p_pw: pw });
  } catch (err) {
    return authSetError('login-error', AUTH_NETWORK_ERR);
  } finally {
    authSetBusy(form, false);
  }

  if (!r || !r.ok) {
    if (r && r.error === 'not_found') {
      return authSetError('login-error', '등록되지 않은 아이디입니다. 관리자에게 등록을 요청하세요.');
    }
    return authSetError('login-error', '아이디 또는 비밀번호가 올바르지 않습니다.');
  }
  if (r.must_change) {
    showFirstPwView(id, pw);
    return;
  }
  enterPlatform(id, r.role, r.token);
}

async function handleFirstPwSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const pending = AUTH_PENDING;
  if (!pending) return showLoginView();
  const pw = document.getElementById('first-pw-new').value || '';
  const confirm = document.getElementById('first-pw-confirm').value || '';
  const err = validateNewPassword(pw, confirm);
  if (err) return authSetError('first-pw-error', err);

  authSetBusy(form, true);
  var r;
  try {
    r = await authRpc('auth_set_password', { p_id: pending.id, p_old: pending.pw, p_new: pw });
  } catch (ex) {
    return authSetError('first-pw-error', AUTH_NETWORK_ERR);
  } finally {
    authSetBusy(form, false);
  }
  if (!r || !r.ok) return authSetError('first-pw-error', setPasswordErrorText(r && r.error));
  enterPlatform(pending.id, r.role, r.token);
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
  const form = e.currentTarget;
  const session = getAuthSession();
  if (!session) return;
  const cur = document.getElementById('pw-cur').value || '';
  const nw = document.getElementById('pw-new').value || '';
  const cf = document.getElementById('pw-confirm').value || '';
  authSetError('pw-change-error', '');
  if (!cur) return authSetError('pw-change-error', '현재 비밀번호를 입력해 주세요.');
  const err = validateNewPassword(nw, cf);
  if (err) return authSetError('pw-change-error', err);

  authSetBusy(form, true);
  var r;
  try {
    r = await authRpc('auth_set_password', { p_id: session.id, p_old: cur, p_new: nw });
  } catch (ex) {
    return authSetError('pw-change-error', AUTH_NETWORK_ERR);
  } finally {
    authSetBusy(form, false);
  }
  if (!r || !r.ok) return authSetError('pw-change-error', setPasswordErrorText(r && r.error));
  setAuthSession(session.id, r.role, r.token);
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

function adminErrorText(code) {
  switch (code) {
    case 'forbidden': return '관리자 세션이 만료되었습니다. 다시 로그인해 주세요.';
    case 'invalid_id': return '아이디는 영문, 숫자, 한글, . _ - 2~20자만 사용할 수 있습니다.';
    case 'exists': return '이미 등록된 아이디입니다.';
    case 'not_found': return '등록되지 않은 아이디입니다.';
    case 'self': return '현재 로그인한 계정은 삭제할 수 없습니다.';
    case 'protected': return '관리자·기본 계정은 삭제할 수 없습니다.';
    default: return '요청을 처리하지 못했습니다.';
  }
}

async function renderAdminUsersList() {
  const wrap = document.getElementById('admin-users-list');
  const session = getAuthSession();
  if (!wrap || !session) return;
  var r;
  try {
    r = await authRpc('auth_admin_list', { p_token: session.token });
  } catch (ex) {
    wrap.innerHTML = '<p class="admin-users-empty">' + AUTH_NETWORK_ERR + '</p>';
    return;
  }
  if (!r || !r.ok) {
    wrap.innerHTML = '<p class="admin-users-empty">' + adminErrorText(r && r.error) + '</p>';
    return;
  }
  const users = r.users || [];
  if (!users.length) {
    wrap.innerHTML = '<p class="admin-users-empty">등록된 계정이 없습니다.</p>';
    return;
  }
  wrap.innerHTML = users.map(function (u) {
    const id = u.id;
    const isAdmin = u.role === 'admin' || id === AUTH_ADMIN_ID;
    const isPreset = isPresetUserId(id);
    const status = u.must_change ? '최초 로그인 대기' : '사용 중';
    const resetBtn = '<button type="button" class="admin-row-btn" data-act="reset" data-id="' + id + '">비밀번호 초기화</button>';
    const actions = (isAdmin || isPreset)
      ? resetBtn
      : resetBtn + '<button type="button" class="admin-row-btn danger" data-act="delete" data-id="' + id + '">삭제</button>';
    return '<div class="admin-user-row">' +
      '<div class="admin-user-meta">' +
        '<strong>' + id + '</strong>' +
        '<span class="admin-user-badge' + (isAdmin ? ' is-admin' : '') + '">' + (isAdmin ? '관리자' : '사용자') + '</span>' +
        '<span class="admin-user-status' + (u.must_change ? ' is-wait' : '') + '">' + status + '</span>' +
      '</div>' +
      '<div class="admin-user-actions">' + actions + '</div>' +
    '</div>';
  }).join('');
}

async function handleAdminAddUser(e) {
  e.preventDefault();
  const session = getAuthSession();
  if (!session || session.role !== 'admin') return;
  const input = document.getElementById('admin-new-id');
  const id = ((input && input.value) || '').trim();
  const err = validateUserId(id);
  if (err) return authSetError('admin-users-msg', err);

  var r;
  try {
    r = await authRpc('auth_admin_add', { p_token: session.token, p_id: id });
  } catch (ex) {
    return authSetError('admin-users-msg', AUTH_NETWORK_ERR);
  }
  if (!r || !r.ok) return authSetError('admin-users-msg', adminErrorText(r && r.error));
  if (input) input.value = '';
  authSetOk('admin-users-msg', id + ' 아이디를 등록했습니다.');
  renderAdminUsersList();
}

async function handleAdminUserAction(e) {
  const btn = e.target.closest('[data-act]');
  const session = getAuthSession();
  if (!btn || !session || session.role !== 'admin') return;
  const id = btn.getAttribute('data-id');
  const act = btn.getAttribute('data-act');
  authSetError('admin-users-msg', '');

  if (act === 'delete') {
    if (id === AUTH_ADMIN_ID || isPresetUserId(id)) {
      return authSetError('admin-users-msg', adminErrorText('protected'));
    }
    if (id === session.id) return authSetError('admin-users-msg', adminErrorText('self'));
  }

  const fn = act === 'reset' ? 'auth_admin_reset' : act === 'delete' ? 'auth_admin_delete' : null;
  if (!fn) return;
  var r;
  try {
    r = await authRpc(fn, { p_token: session.token, p_id: id });
  } catch (ex) {
    return authSetError('admin-users-msg', AUTH_NETWORK_ERR);
  }
  if (!r || !r.ok) return authSetError('admin-users-msg', adminErrorText(r && r.error));
  authSetOk('admin-users-msg', act === 'reset'
    ? id + ' 비밀번호를 초기화했습니다.'
    : id + ' 아이디를 삭제했습니다.');
  renderAdminUsersList();
}

(function initAuth() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(AUTH_LEGACY_USERS_KEY);
  refreshAuthUI();
  const session = getAuthSession();
  if (session) {
    authRpc('auth_session', { p_token: session.token }).then(function (r) {
      if (!r || !r.ok) {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
      } else {
        setAuthSession(r.id, r.role, session.token);
      }
      refreshAuthUI();
    }).catch(function () {});
  }
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
