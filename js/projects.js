'use strict';
const Projects = (() => {
  const COLORS = ['#C8703C','#E89B6C','#6B9BD8','#A584C8','#7BA86B','#E5604F'];
  function getColor(i) { return COLORS[i % COLORS.length]; }

  async function renderList(userId) {
    const list = document.getElementById('project-list');
    list.innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
    const projects = await DB.projects.forUser(userId);
    list.innerHTML = '';

    if (projects.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:40px 0">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        <p class="empty-state-sub">${I18n.t('project.create')}</p>
      </div>`;
      return;
    }

    projects.sort((a,b) => (b.createdAt||0) - (a.createdAt||0))
      .forEach((proj, i) => {
        const color = getColor(i);
        const memberCount = (proj.memberIds || []).length;
        const card = document.createElement('div');
        card.className = 'project-card animate-in';
        card.style.animationDelay = (i * 0.06) + 's';
        card.innerHTML = `
          <div class="project-icon" style="background:${color}18;border:1px solid ${color}28">
            <svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" width="22" height="22">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <div class="project-info">
            <div class="project-name">${escHtml(proj.name)}</div>
            <div class="project-member-count">${memberCount}${I18n.getLang()==='ko'?' 명':' members'}</div>
          </div>
          <svg class="project-arrow" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><polyline points="9,18 15,12 9,6"/></svg>`;
        card.onclick = () => App.openProject(proj.id);
        list.appendChild(card);
      });
  }

  /* 실시간 프로젝트 목록 구독 */
  let _unsubProjects = null;
  function subscribeList(userId) {
    if (_unsubProjects) _unsubProjects();
    _unsubProjects = DB.projects.on(userId, () => renderList(userId));
  }
  function unsubscribeList() {
    if (_unsubProjects) { _unsubProjects(); _unsubProjects = null; }
  }

  function showCreate() {
    Projects._pendingMembers = [];
    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">${I18n.t('project.create')}</div>
      <div class="modal-body">
        <div class="field-group">
          <label class="field-label">${I18n.t('project.name')}</label>
          <div class="field-wrap">
            <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            <input id="new-proj-name" class="field-input" type="text" placeholder="${I18n.t('project.namePh')}" maxlength="40">
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">${I18n.t('project.members')}</label>
          <div style="display:flex;gap:8px">
            <div style="flex:1;position:relative">
              <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
              <input id="member-search" class="field-input" type="text" placeholder="${I18n.t('project.memberPh')}">
            </div>
            <button class="btn-primary" style="padding:0 18px;flex-shrink:0" onclick="Projects._addMember()">${I18n.t('project.add')}</button>
          </div>
          <div id="member-search-msg" class="field-hint"></div>
          <div id="member-list"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" style="flex:1" onclick="Modal.close()">${I18n.t('common.cancel')}</button>
        <button class="btn-primary" style="flex:2" onclick="Projects._submitCreate()">${I18n.t('project.create_btn')}</button>
      </div>`;
    Modal.open(html);
    setTimeout(() => document.getElementById('new-proj-name')?.focus(), 300);
  }

  async function _addMember() {
    const input = document.getElementById('member-search');
    const msg = document.getElementById('member-search-msg');
    const val = (input?.value || '').trim().toLowerCase();
    if (!val) return;

    msg.textContent = '...'; msg.className = 'field-hint';
    const user = await DB.users.getByUsername(val);
    const currentUser = Auth.currentUser();

    if (!user) { msg.textContent = I18n.t('project.notFound'); msg.className = 'field-hint err'; return; }
    if (user.id === currentUser.id || Projects._pendingMembers.find(m => m.id === user.id)) {
      msg.textContent = I18n.t('project.alreadyAdded'); msg.className = 'field-hint err'; return;
    }
    Projects._pendingMembers.push({ id: user.id, username: user.username, displayName: user.displayName });
    msg.textContent = ''; input.value = '';
    _renderMemberList();
  }

  function _renderMemberList() {
    const el = document.getElementById('member-list');
    if (!el) return;
    el.innerHTML = Projects._pendingMembers.map(m => `
      <div class="member-chip">
        <div class="avatar avatar-sm" style="background:${strColor(m.displayName)}">${m.displayName[0].toUpperCase()}</div>
        <span>${escHtml(m.displayName)}</span>
        <span style="color:var(--txt3);font-size:11px">@${m.username}</span>
        <button onclick="Projects._removeMember('${m.id}')" style="margin-left:auto;color:var(--txt3)">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');
  }

  function _removeMember(id) {
    Projects._pendingMembers = Projects._pendingMembers.filter(m => m.id !== id);
    _renderMemberList();
  }

  async function _submitCreate() {
    const nameEl = document.getElementById('new-proj-name');
    const name = (nameEl?.value || '').trim();
    if (!name) { nameEl?.focus(); return; }

    const user = Auth.currentUser();
    const memberIds = [user.id, ...Projects._pendingMembers.map(m => m.id)];
    const id = DB.genId();
    await DB.projects.set(id, { id, name, ownerId: user.id, memberIds, createdAt: Date.now() });

    Modal.close();
    Toast.show(I18n.getLang()==='ko' ? '프로젝트가 생성되었습니다.' : 'Project created.', 'success');
  }

  async function showManageMembers(projectId) {
    const proj = await DB.projects.getById(projectId);
    if (!proj) return;

    const memberDetails = await Promise.all(
      (proj.memberIds||[]).map(id => DB.users.getById(id))
    );
    const members = memberDetails.filter(Boolean);
    const currentUser = Auth.currentUser();
    const isOwner = proj.ownerId === currentUser.id;

    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">${I18n.t('settings.members')}</div>
      <div class="modal-body">
        ${members.map(m => `
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0">
            <div class="avatar avatar-md" style="background:${strColor(m.displayName)}">${m.displayName[0].toUpperCase()}</div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:600;color:var(--txt)">${escHtml(m.displayName)}</div>
              <div style="font-size:11px;color:var(--txt3)">@${m.username}${m.id===proj.ownerId?(I18n.getLang()==='ko'?' · 소유자':' · Owner'):''}</div>
            </div>
            ${isOwner && m.id !== currentUser.id ? `
              <button class="btn-icon" onclick="Projects._removeMemberFromProject('${projectId}','${m.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2" stroke-linecap="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>` : ''}
          </div>`).join('')}
        ${isOwner ? `
          <div class="field-group" style="margin-top:12px">
            <label class="field-label">${I18n.t('project.members')}</label>
            <div style="display:flex;gap:8px">
              <div style="flex:1;position:relative">
                <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>
                <input id="add-member-input" class="field-input" type="text" placeholder="${I18n.t('project.memberPh')}">
              </div>
              <button class="btn-primary" style="padding:0 18px" onclick="Projects._addMemberToProject('${projectId}')">${I18n.t('project.add')}</button>
            </div>
            <div id="add-member-msg" class="field-hint"></div>
          </div>` : ''}
        <button class="btn-danger btn-full" style="margin-top:12px" onclick="Projects._leaveProject('${projectId}')">${I18n.t('project.leave')}</button>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary btn-full" onclick="Modal.close()">${I18n.t('common.cancel')}</button>
      </div>`;
    Modal.open(html);
  }

  async function _addMemberToProject(projectId) {
    const input = document.getElementById('add-member-input');
    const msg = document.getElementById('add-member-msg');
    const val = (input?.value||'').trim().toLowerCase();
    if (!val) return;
    msg.textContent = '...';
    const proj = await DB.projects.getById(projectId);
    const user = await DB.users.getByUsername(val);
    if (!user) { msg.textContent = I18n.t('project.notFound'); msg.className = 'field-hint err'; return; }
    if ((proj.memberIds||[]).includes(user.id)) { msg.textContent = I18n.t('project.alreadyAdded'); msg.className = 'field-hint err'; return; }
    await DB.projects.set(projectId, { ...proj, memberIds: [...(proj.memberIds||[]), user.id] });
    Modal.close();
    Toast.show(I18n.getLang()==='ko'?'멤버가 추가되었습니다.':'Member added.', 'success');
    showManageMembers(projectId);
  }

  async function _removeMemberFromProject(projectId, userId) {
    const proj = await DB.projects.getById(projectId);
    await DB.projects.set(projectId, { ...proj, memberIds: (proj.memberIds||[]).filter(id => id !== userId) });
    Modal.close();
    showManageMembers(projectId);
  }

  async function _leaveProject(projectId) {
    if (!confirm(I18n.t('project.confirmLeave'))) return;
    const user = Auth.currentUser();
    const proj = await DB.projects.getById(projectId);
    const newMembers = (proj.memberIds||[]).filter(id => id !== user.id);
    if (newMembers.length === 0) {
      await DB.projects.remove(projectId);
    } else {
      await DB.projects.set(projectId, {
        ...proj, memberIds: newMembers,
        ownerId: proj.ownerId === user.id ? newMembers[0] : proj.ownerId
      });
    }
    Modal.close();
    App.backToProjects();
  }

  return {
    renderList, subscribeList, unsubscribeList, showCreate, showManageMembers,
    _addMember, _removeMember, _submitCreate,
    _addMemberToProject, _removeMemberFromProject, _leaveProject,
    _pendingMembers: [],
  };
})();

/* ── 공통 헬퍼 (전역) ── */
function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function strColor(str) {
  const colors = ['#C8703C','#E89B6C','#A85A35','#D88A5C','#B8704A','#E5604F','#A584C8','#6B9BD8'];
  let h = 0;
  for (let i=0;i<(str||'').length;i++) h=((h<<5)-h)+str.charCodeAt(i);
  return colors[Math.abs(h)%colors.length];
}
