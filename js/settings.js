'use strict';
const Settings = (() => {
  const KEY='cw_settings';
  function get(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}}
  function save(data){localStorage.setItem(KEY,JSON.stringify({...get(),...data}));}

  function render(projectId){
    const el=document.getElementById('s-settings');
    const s=get(), user=Auth.currentUser();
    const lang=I18n.getLang(), theme=document.documentElement.getAttribute('data-theme')||'dark';
    el.innerHTML=`
      <div class="page-hd" style="margin-bottom:8px">
        <div class="page-hd-left"><h1 class="page-title">${I18n.t('settings.title')}</h1></div>
      </div>

      <div class="section-lbl">${I18n.t('settings.account')}</div>
      <div class="settings-group">
        <div class="settings-item">
          <div class="avatar avatar-md" style="background:${strColor(user.displayName)}">${user.displayName[0].toUpperCase()}</div>
          <div style="flex:1"><div style="font-size:15px;font-weight:700;color:var(--txt)">${escHtml(user.displayName)}</div><div style="font-size:12px;color:var(--txt3)">@${user.username}</div></div>
        </div>
        <div class="divider"></div>
        <button class="settings-item" onclick="Settings.showChangePw()">
          <svg class="settings-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          <span class="settings-label">${I18n.t('settings.changePw')}</span>
          <svg class="settings-arrow" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><polyline points="9,18 15,12 9,6"/></svg>
        </button>
      </div>

      <div class="section-lbl">${I18n.t('settings.theme')}</div>
      <div class="settings-group">
        <button class="settings-item" onclick="Settings.setTheme('dark')">
          <svg class="settings-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          <span class="settings-label">${I18n.t('settings.dark')}</span>
          ${theme==='dark'?`<svg class="settings-check" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round"><polyline points="20,6 9,17 4,12"/></svg>`:'<div style="width:20px"></div>'}
        </button>
        <div class="divider"></div>
        <button class="settings-item" onclick="Settings.setTheme('light')">
          <svg class="settings-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
          <span class="settings-label">${I18n.t('settings.light')}</span>
          ${theme==='light'?`<svg class="settings-check" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round"><polyline points="20,6 9,17 4,12"/></svg>`:'<div style="width:20px"></div>'}
        </button>
      </div>

      <div class="section-lbl">${I18n.t('settings.lang')}</div>
      <div class="settings-group">
        <button class="settings-item" onclick="Settings.setLang('ko')">
          <svg class="settings-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
          <span class="settings-label">${I18n.t('settings.ko')}</span>
          ${lang==='ko'?`<svg class="settings-check" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round"><polyline points="20,6 9,17 4,12"/></svg>`:'<div style="width:20px"></div>'}
        </button>
        <div class="divider"></div>
        <button class="settings-item" onclick="Settings.setLang('en')">
          <svg class="settings-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
          <span class="settings-label">${I18n.t('settings.en')}</span>
          ${lang==='en'?`<svg class="settings-check" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round"><polyline points="20,6 9,17 4,12"/></svg>`:'<div style="width:20px"></div>'}
        </button>
      </div>

      <div class="section-lbl">${I18n.t('settings.eventAlerts')}</div>
      <div class="settings-group">
        <div class="settings-item">
          <svg class="settings-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span class="settings-label">${I18n.t('settings.eventAlerts')}</span>
          <div class="toggle-wrap" style="margin-left:auto"><input type="checkbox" id="tog-ev" ${s.eventAlerts!==false?'checked':''} onchange="Settings.save({eventAlerts:this.checked})"><div class="toggle" onclick="document.getElementById('tog-ev').click()"></div></div>
        </div>
        <div class="divider"></div>
        <div class="settings-item">
          <svg class="settings-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          <span class="settings-label">${I18n.t('settings.chatAlerts')}</span>
          <div class="toggle-wrap" style="margin-left:auto"><input type="checkbox" id="tog-chat" ${s.chatAlerts!==false?'checked':''} onchange="Settings.save({chatAlerts:this.checked})"><div class="toggle" onclick="document.getElementById('tog-chat').click()"></div></div>
        </div>
      </div>

      <div class="section-lbl">${I18n.t('settings.members')}</div>
      <div class="settings-group">
        <button class="settings-item" onclick="Projects.showManageMembers('${projectId}')">
          <svg class="settings-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          <span class="settings-label">${I18n.t('project.manage')}</span>
          <svg class="settings-arrow" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><polyline points="9,18 15,12 9,6"/></svg>
        </button>
      </div>

      <div class="section-lbl">${I18n.t('settings.info')}</div>
      <div class="settings-group">
        <div class="settings-item">
          <svg class="settings-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span class="settings-label">${I18n.t('settings.version')}</span>
          <span style="font-size:12px;color:var(--txt3);font-family:var(--font-mono)">1.0.0</span>
        </div>
      </div>

      <div style="padding:20px 20px 40px">
        <button class="btn-danger btn-full" onclick="App.logout()">${I18n.t('settings.logout')}</button>
      </div>`;
  }

  function setTheme(t){document.documentElement.setAttribute('data-theme',t);save({theme:t});render(App.currentProjectId());}
  function setLang(l){I18n.setLang(l);save({lang:l});App.rerenderAll();}

  function showChangePw(){
    const html=`
      <div class="modal-handle"></div>
      <div class="modal-title">${I18n.t('settings.changePw')}</div>
      <div class="modal-body">
        <div class="field-group">
          <label class="field-label">${I18n.t('settings.newPw')}</label>
          <div class="field-wrap">
            <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            <input id="new-pw" class="field-input" type="password" placeholder="${I18n.t('settings.newPwPh')}">
            <button type="button" class="pw-toggle" onclick="togglePw('new-pw',this)"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">${I18n.t('settings.confirmNewPw')}</label>
          <div class="field-wrap">
            <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            <input id="new-pw2" class="field-input" type="password" placeholder="${I18n.t('settings.confirmNewPw')}">
          </div>
        </div>
        <div id="pw-err" class="auth-error hidden"></div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" style="flex:1" onclick="Modal.close()">${I18n.t('common.cancel')}</button>
        <button class="btn-primary" style="flex:2" onclick="Settings._submitPw()">${I18n.t('settings.save')}</button>
      </div>`;
    Modal.open(html);
    setTimeout(()=>document.getElementById('new-pw')?.focus(),300);
  }

  async function _submitPw(){
    const pw=document.getElementById('new-pw')?.value||'';
    const pw2=document.getElementById('new-pw2')?.value||'';
    const err=document.getElementById('pw-err');
    if(pw!==pw2){err.textContent=I18n.t('auth.err.pwMismatch');err.classList.remove('hidden');return;}
    const res=await Auth.changePw(pw);
    if(!res.ok){err.textContent=res.err;err.classList.remove('hidden');return;}
    Modal.close();
    Toast.show(I18n.getLang()==='ko'?'비밀번호가 변경되었습니다.':'Password changed.','success');
  }

  function applyOnLoad(){
    const s=get();
    if(s.theme) document.documentElement.setAttribute('data-theme',s.theme);
    if(s.lang) I18n.setLang(s.lang);
  }

  return{get,save,render,setTheme,setLang,showChangePw,_submitPw,applyOnLoad};
})();
