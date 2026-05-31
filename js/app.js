'use strict';

/* ─── TOAST ─── */
const Toast = {
  show(msg, type='') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    const c = document.getElementById('toast-container');
    c.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2500);
  }
};

/* ─── MODAL ─── */
const Modal = {
  open(html) {
    const m = document.getElementById('modal');
    const o = document.getElementById('modal-overlay');
    m.innerHTML = html;
    m.classList.remove('hidden');
    o.classList.remove('hidden');
    requestAnimationFrame(() => m.classList.add('open'));
  },
  close() {
    const m = document.getElementById('modal');
    const o = document.getElementById('modal-overlay');
    m.classList.remove('open');
    o.classList.add('hidden');
    setTimeout(() => { m.classList.add('hidden'); m.innerHTML = ''; }, 350);
  },
  closeOnOverlay(e) { if (e.target === e.currentTarget) Modal.close(); }
};

/* ─── NOTIFICATIONS ─── */
const Notif = {
  async push(userId, projectId, type, title, body) {
    const id = DB.genId();
    await DB.notifications.set(id, {
      id, userId, projectId, type, title, body, read: false, createdAt: Date.now()
    });
  },
  async render() {
    const user = Auth.currentUser();
    if (!user) return;
    const notifs = await DB.notifications.forUser(user.id);
    const list = document.getElementById('notif-list');
    const dot  = document.getElementById('notif-dot');
    if (!list) return;
    const unread = notifs.filter(n => !n.read);
    if (dot) dot.classList.toggle('hidden', unread.length === 0);
    if (notifs.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:30px 0"><p class="empty-state-sub">${I18n.t('notif.noNotif')}</p></div>`;
      return;
    }
    list.innerHTML = notifs.slice(0, 30).map(n => `
      <div class="notif-item ${n.read?'read':''}" onclick="Notif._markRead('${n.id}')">
        <div class="notif-item-title">${escHtml(n.title||'')}</div>
        <div class="notif-item-body">${escHtml(n.body||'')}</div>
        <div class="notif-item-time">${_timeAgo(n.createdAt?.seconds ? n.createdAt.seconds*1000 : n.createdAt)}</div>
      </div>`).join('');
  },
  async _markRead(id) {
    await DB.notifications.markRead(id);
    Notif.render();
  }
};

function _timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  const lang = I18n.getLang();
  if (diff < 60)   return lang === 'ko' ? '방금' : 'Just now';
  if (diff < 3600) return lang === 'ko' ? `${Math.floor(diff/60)}분 전` : `${Math.floor(diff/60)}m ago`;
  if (diff < 86400)return lang === 'ko' ? `${Math.floor(diff/3600)}시간 전` : `${Math.floor(diff/3600)}h ago`;
  return lang === 'ko' ? `${Math.floor(diff/86400)}일 전` : `${Math.floor(diff/86400)}d ago`;
}

/* ─── PW TOGGLE ─── */
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'text' ? 'password' : 'text';
  btn.querySelector('svg').style.opacity = input.type === 'text' ? '0.5' : '1';
}

/* ─── INJECT COMPONENT STYLES ─── */
(function injectStyles() {
  const s = document.createElement('style');
  s.textContent = `
    /* Loading */
    .loading-row { display:flex; justify-content:center; padding:60px 0; }
    .spinner {
      width:32px; height:32px; border-radius:50%;
      border:3px solid var(--border);
      border-top-color:var(--lime);
      animation:spin .7s linear infinite;
    }
    @keyframes spin { to { transform:rotate(360deg); } }

    /* Member chip */
    .member-chip {
      display:flex; align-items:center; gap:8px;
      background:var(--card2); border-radius:var(--radius-sm);
      padding:8px 12px; margin-top:6px; border:1px solid var(--border);
    }
    .member-chip span { font-size:13px; color:var(--txt); }

    /* TODO */
    .todo-filter-wrap { display:flex; gap:6px; padding:14px 20px 4px; }
    .todo-ftab {
      padding:6px 14px; border-radius:100px;
      font-size:12px; font-weight:600; color:var(--txt3);
      background:var(--card); border:1px solid transparent; transition:all .2s;
    }
    .todo-ftab.active { border-color:var(--lime); color:var(--lime); }
    .todo-list { padding:0 20px; }
    .todo-item {
      background:var(--card); border-radius:18px;
      padding:14px 16px; margin-bottom:8px;
      display:flex; align-items:center; gap:12px;
      border:1px solid transparent; cursor:pointer;
      transition:border-color .2s; position:relative; overflow:hidden;
    }
    .todo-item::before {
      content:''; position:absolute; left:0; top:0; bottom:0;
      width:3px; background:var(--lime); opacity:0; transition:opacity .2s;
    }
    .todo-urgent::before { opacity:1; }
    .todo-urgent { background:#1a1400 !important; }
    [data-theme=light] .todo-urgent { background:#fffde0 !important; }
    .todo-check {
      width:22px; height:22px; border-radius:8px;
      border:2px solid var(--border); flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      transition:all .2s; background:transparent;
    }
    .todo-check.checked { background:var(--lime); border-color:var(--lime); }
    .todo-body { flex:1; min-width:0; }
    .todo-title { font-size:13px; font-weight:600; color:var(--txt); }
    .todo-done .todo-title { text-decoration:line-through; opacity:.4; }
    .todo-meta { display:flex; align-items:center; gap:6px; margin-top:3px; }
    .todo-due { font-size:10px; color:var(--txt3); font-family:var(--font-mono); }
    .todo-due.overdue { color:var(--red); }

    /* MEMO */
    .memo-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:12px 20px; }
    @media(max-width:340px) { .memo-grid { grid-template-columns:1fr; } }
    .memo-card {
      border-radius:22px; padding:20px; cursor:pointer;
      transition:transform .2s cubic-bezier(.34,1.56,.64,1);
    }
    .memo-card-wide { grid-column:span 2; }
    .memo-card:active { transform:scale(.97); }
    .memo-card-date { font-family:var(--font-mono); font-size:10px; margin-bottom:6px; }
    .memo-card-title { font-family:var(--font-display); font-size:15px; font-weight:700; margin-bottom:6px; line-height:1.3; }
    .memo-card-preview { font-size:12px; line-height:1.6; }
    .memo-card-footer { display:flex; align-items:center; justify-content:space-between; margin-top:12px; }
    .memo-tag { font-size:9px; font-weight:700; padding:3px 10px; border-radius:100px; }

    /* SCHEDULE */
    .cal-header-row {
      display:flex; align-items:center; justify-content:space-between;
      padding:16px 20px 8px;
    }
    .cal-month-label { font-family:var(--font-display); font-size:16px; font-weight:700; color:var(--txt); }
    .cal-nav-btn {
      width:34px; height:34px; background:var(--card); border-radius:10px;
      display:flex; align-items:center; justify-content:center;
      border:1px solid var(--border);
    }
    .cal-nav-btn svg { stroke:var(--txt2); width:16px; height:16px; }
    .cal-grid-wrap { padding:0 20px; }
    .cal-wday { display:grid; grid-template-columns:repeat(7,1fr); text-align:center; margin-bottom:6px; }
    .cal-wlabel { font-size:10px; font-weight:700; color:var(--txt3); padding:4px 0; }
    .cal-days { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
    .cal-d {
      aspect-ratio:1; display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      font-size:13px; font-weight:500; color:var(--txt2);
      border-radius:10px; cursor:pointer; position:relative; transition:background .15s;
    }
    .cal-d:active { background:var(--card2); }
    .cal-d.today { background:var(--lime); color:#000; font-weight:800; }
    .cal-d.selected { background:var(--card2); color:var(--txt); border:1px solid var(--border); }
    .cal-d.has-dot::after {
      content:''; width:4px; height:4px; border-radius:50%;
      background:var(--lime); position:absolute; bottom:3px;
    }
    .cal-d.today.has-dot::after { background:#000; }
    .cal-d.inactive { opacity:.2; pointer-events:none; }
    .cal-sel-label {
      font-family:var(--font-display); font-size:14px; font-weight:700; color:var(--txt2);
      padding:18px 20px 10px; display:flex; align-items:center;
    }
    .cal-events { padding:0 20px; }
    .cal-event {
      background:var(--card); border-radius:16px;
      padding:14px 16px; margin-bottom:8px;
      display:flex; align-items:center; gap:10px;
      cursor:pointer; border:1px solid transparent; transition:border-color .15s;
    }
    .cal-event:active { border-color:var(--border); }
    .cal-event-bar { width:3px; align-self:stretch; border-radius:2px; flex-shrink:0; min-height:36px; }
    .cal-event-body { flex:1; }
    .cal-event-title { font-size:13px; font-weight:600; color:var(--txt); margin-bottom:2px; }
    .cal-event-time { font-size:11px; color:var(--txt3); font-family:var(--font-mono); }

    /* COLOR PICKER & TOGGLE */
    .color-picker { display:flex; gap:8px; flex-wrap:wrap; padding:4px 0; }
    .color-opt {
      width:28px; height:28px; border-radius:8px; cursor:pointer;
      border:2px solid transparent; transition:all .15s;
    }
    .color-opt.selected { border-color:var(--txt); transform:scale(1.15); }
    .toggle-wrap { position:relative; }
    .toggle-wrap input[type=checkbox] { position:absolute; opacity:0; width:0; height:0; }
    .toggle {
      width:44px; height:26px; background:var(--card2);
      border-radius:13px; cursor:pointer; border:1px solid var(--border);
      transition:background .2s; position:relative;
    }
    .toggle::after {
      content:''; position:absolute; left:3px; top:3px;
      width:18px; height:18px; border-radius:50%;
      background:var(--txt3); transition:all .25s cubic-bezier(.34,1.56,.64,1);
    }
    .toggle-wrap input:checked ~ .toggle { background:var(--lime); border-color:var(--lime); }
    .toggle-wrap input:checked ~ .toggle::after { left:21px; background:#000; }

    /* CHAT */
    .chat-members {
      display:flex; gap:8px; flex-wrap:wrap; padding:10px 20px 0;
    }
    .chat-member-chip {
      display:flex; align-items:center; gap:6px;
      background:var(--card); border-radius:100px;
      padding:5px 12px 5px 6px; border:1px solid var(--border);
      font-size:12px; color:var(--txt2);
    }
    .chat-member-chip.online { border-color:rgba(190,255,0,.3); }
    .chat-messages {
      padding:12px 20px; display:flex; flex-direction:column; gap:2px;
      min-height:120px;
    }
    .chat-date-sep {
      text-align:center; font-size:11px; color:var(--txt3);
      padding:10px 0; font-family:var(--font-mono);
    }
    .msg-row { display:flex; gap:8px; margin-bottom:2px; }
    .msg-row.mine { flex-direction:row-reverse; }
    .msg-avatar-wrap { width:32px; flex-shrink:0; }
    .msg-sender { font-size:11px; color:var(--txt3); margin-bottom:3px; padding-left:2px; }
    .msg-bubble {
      max-width:75%; padding:10px 14px; border-radius:18px;
      font-size:14px; line-height:1.5; word-break:break-word;
    }
    .msg-bubble.mine { background:var(--lime); color:#000; border-radius:18px 4px 18px 18px; }
    .msg-bubble.theirs { background:var(--card2); color:var(--txt); border-radius:4px 18px 18px 18px; }
    .msg-time { font-size:10px; color:var(--txt3); margin-top:3px; font-family:var(--font-mono); padding:0 2px; }
    .msg-row.mine .msg-time { text-align:right; }
    .chat-input-wrap {
      padding:10px 16px 16px; background:var(--bnav-bg);
      border-top:1px solid var(--border2);
      position:sticky; bottom:0; z-index:5;
    }
    .chat-input-inner {
      display:flex; gap:8px; align-items:flex-end;
      background:var(--card); border-radius:18px;
      padding:6px 6px 6px 14px; border:1px solid var(--border);
    }
    .chat-input {
      flex:1; background:none; border:none; outline:none;
      font-size:15px; color:var(--txt); resize:none;
      max-height:120px; line-height:1.5; padding:6px 0;
    }
    .chat-input::placeholder { color:var(--txt3); }
    .chat-send-btn {
      width:36px; height:36px; border-radius:12px;
      background:var(--lime); flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      transition:transform .15s;
    }
    .chat-send-btn:active { transform:scale(.92); }
    .chat-send-btn svg { stroke:#000; width:16px; height:16px; }

    /* SETTINGS */
    .settings-group {
      margin:0 20px 8px; background:var(--card);
      border-radius:var(--radius-lg); border:1px solid var(--border2); overflow:hidden;
    }
    .settings-item {
      display:flex; align-items:center; gap:12px;
      padding:14px 16px; width:100%;
    }
    .settings-icon { width:20px; height:20px; stroke:var(--txt2); flex-shrink:0; }
    .settings-label { flex:1; font-size:14px; font-weight:500; color:var(--txt); text-align:left; }
    .settings-arrow { width:16px; height:16px; stroke:var(--txt3); flex-shrink:0; }
    .settings-check { width:18px; height:18px; stroke:var(--lime); flex-shrink:0; }

    /* NOTIF */
    .notif-item.read { opacity:.5; }
  `;
  document.head.appendChild(s);
})();

/* ═══════════════════════════════════════════════
   MAIN APP CONTROLLER
═══════════════════════════════════════════════ */
const App = (() => {
  let _projectId = null;
  let _currentTab = 'todo';
  let _unsubNotif = null;
  let _authUnsub = null;

  /* ── INIT ── */
  function init() {
    Settings.applyOnLoad();
    I18n.applyAll();

    // Firebase Auth 상태 감지
    _authUnsub = Auth.onAuthStateChanged(({ loggedIn, user }) => {
      // 스플래시 제거
      const splash = document.getElementById('app-loading');
      if (splash) { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 400); }

      if (loggedIn && user) {
        _showMainApp(user);
      } else {
        _showAuth();
      }
    });
  }

  function _showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
    _initAuthForms();
  }

  function _showMainApp(user) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('proj-username').textContent = user.displayName;
    document.getElementById('project-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');

    Projects.renderList(user.id);
    Projects.subscribeList(user.id);

    // 알림 구독
    if (_unsubNotif) _unsubNotif();
    _unsubNotif = DB.notifications.on(user.id, () => Notif.render());
  }

  /* ── AUTH FORMS ── */
  function _initAuthForms() {
    // 탭 전환
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('login-form').classList.toggle('hidden', tab.dataset.tab !== 'login');
        document.getElementById('register-form').classList.toggle('hidden', tab.dataset.tab !== 'register');
      };
    });

    // 로그인
    document.getElementById('login-form').onsubmit = async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = '...';
      const res = await Auth.login(
        document.getElementById('login-id').value,
        document.getElementById('login-pw').value
      );
      if (!res.ok) {
        const err = document.getElementById('login-error');
        err.textContent = res.err; err.classList.remove('hidden');
      }
      btn.disabled = false; btn.textContent = I18n.t('auth.loginBtn');
    };

    // 회원가입
    document.getElementById('register-form').onsubmit = async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      const pw = document.getElementById('reg-pw').value;
      const pw2 = document.getElementById('reg-pw2').value;
      const err = document.getElementById('reg-error');
      if (pw !== pw2) { err.textContent = I18n.t('auth.err.pwMismatch'); err.classList.remove('hidden'); return; }
      btn.disabled = true; btn.textContent = '...';
      const res = await Auth.register(
        document.getElementById('reg-id').value,
        document.getElementById('reg-name').value,
        pw
      );
      if (!res.ok) { err.textContent = res.err; err.classList.remove('hidden'); }
      btn.disabled = false; btn.textContent = I18n.t('auth.registerBtn');
    };

    // 아이디 중복 확인 (debounce)
    let idTimer = null;
    document.getElementById('reg-id')?.addEventListener('input', e => {
      clearTimeout(idTimer);
      const msg = document.getElementById('reg-id-msg');
      idTimer = setTimeout(async () => {
        const val = e.target.value.trim();
        if (!val) { msg.textContent = ''; return; }
        const avail = await Auth.checkIdAvailable(val);
        if (avail === null || avail === undefined) { msg.textContent = ''; return; }
        if (avail === false) {
          msg.textContent = I18n.t('auth.err.idFormat'); msg.className = 'field-hint err';
        } else {
          msg.textContent = I18n.t('auth.idAvailable'); msg.className = 'field-hint ok';
        }
      }, 500);
    });
  }

  /* ── PROJECT ── */
  async function openProject(projectId) {
    _projectId = projectId;
    const proj = await DB.projects.getById(projectId);
    document.getElementById('current-project-name').textContent = proj?.name || '';
    document.getElementById('project-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    switchTab('todo');
  }

  function backToProjects() {
    if (_projectId) {
      Todo.destroy(); Memo.destroy(); Schedule.destroy(); Chat.destroy();
    }
    _projectId = null; _currentTab = 'todo';
    document.getElementById('project-screen').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
    const user = Auth.currentUser();
    if (user) {
      Projects.renderList(user.id);
      Projects.subscribeList(user.id);
    }
  }

  /* ── TAB SWITCH ── */
  function switchTab(tab) {
    _currentTab = tab;
    ['todo','memo','schedule','chat','settings'].forEach(t => {
      document.getElementById('s-'+t)?.classList.toggle('active', t === tab);
      document.querySelector(`.bn[data-screen="s-${t}"]`)?.classList.toggle('active', t === tab);
    });
    Chat.setVisible(tab === 'chat');

    if (tab === 'todo')     Todo.init(_projectId);
    if (tab === 'memo')     Memo.init(_projectId);
    if (tab === 'schedule') Schedule.init(_projectId);
    if (tab === 'chat')     Chat.init(_projectId);
  }

  /* ── SETTINGS ── */
  function goSettings() {
    ['todo','memo','schedule','chat'].forEach(t => {
      document.getElementById('s-'+t)?.classList.remove('active');
      document.querySelector(`.bn[data-screen="s-${t}"]`)?.classList.remove('active');
    });
    document.getElementById('s-settings').classList.add('active');
    Settings.render(_projectId);
  }

  /* ── NOTIFICATIONS ── */
  function toggleNotifPanel() {
    const panel   = document.getElementById('notif-panel');
    const overlay = document.getElementById('notif-overlay');
    const isHidden = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !isHidden);
    overlay.classList.toggle('hidden', !isHidden);
    if (isHidden) Notif.render();
  }

  async function clearNotifs() {
    await DB.notifications.clearAll(Auth.currentUser().id);
    Notif.render();
  }

  /* ── LOGOUT ── */
  async function logout() {
    if (_projectId) {
      Todo.destroy(); Memo.destroy(); Schedule.destroy(); Chat.destroy();
    }
    Projects.unsubscribeList();
    if (_unsubNotif) { _unsubNotif(); _unsubNotif = null; }
    _projectId = null; _currentTab = 'todo';
    await Auth.logout();
    // onAuthStateChanged 가 자동으로 _showAuth() 호출
  }

  /* ── HELPERS ── */
  function showCreateProject() { Projects.showCreate(); }
  function currentProjectId()  { return _projectId; }

  function rerenderAll() {
    I18n.applyAll();
    if (_currentTab === 'todo')     Todo.init(_projectId);
    else if (_currentTab === 'memo')     Memo.init(_projectId);
    else if (_currentTab === 'schedule') Schedule.init(_projectId);
    else if (_currentTab === 'chat')     Chat.init(_projectId);
    if (document.getElementById('s-settings').classList.contains('active')) {
      Settings.render(_projectId);
    }
  }

  /* ── BOOT ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    openProject, backToProjects, switchTab, goSettings,
    toggleNotifPanel, clearNotifs, logout,
    showCreateProject, currentProjectId, rerenderAll,
  };
})();
