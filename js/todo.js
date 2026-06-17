'use strict';
const Todo = (() => {
  let _projectId = null;
  let _unsub = null;
  let _filter = 'all';
  let _todos = [];

  function init(projectId) {
    if (_projectId === projectId && _unsub) { _render(); return; }
    _projectId = projectId;
    if (_unsub) { _unsub(); _unsub = null; }
    _todos = [];
    _showLoading();
    _unsub = DB.todos.on(projectId, docs => {
      _todos = docs;
      _render();
    });
  }

  function _showLoading() {
    document.getElementById('s-todo').innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
  }

  function _render() {
    const el = document.getElementById('s-todo');
    const user = Auth.currentUser();
    let todos = [..._todos];
    if (_filter === 'inProgress') todos = todos.filter(t => !t.done);
    if (_filter === 'done') todos = todos.filter(t => t.done);

    const total = _todos.length;
    const doneCount = _todos.filter(t => t.done).length;
    const inProgress = total - doneCount;

    todos.sort((a,b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const po = {high:0,mid:1,low:2};
      return (po[a.priority]||1)-(po[b.priority]||1) || (b.createdAt||0)-(a.createdAt||0);
    });

    const user = Auth.currentUser();
    const uname = user ? user.displayName : '';
    const avatarData = Settings.getAvatar ? Settings.getAvatar() : null;
    const avatarHtml = avatarData
      ? `<img src="${avatarData}" alt="avatar">`
      : (uname ? uname[0].toUpperCase() : '?');

    el.innerHTML = `
      <div class="welcome-hd">
        <div class="welcome-top">
          <button class="welcome-avatar" onclick="Settings.editAvatar()" style="background:${avatarData?'transparent':strColor(uname)}">
            ${avatarHtml}
          </button>
          <button class="btn-icon" onclick="App.switchTab('chat')" style="border-radius:50%;width:42px;height:42px">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </button>
        </div>
        <div class="welcome-text">
          <div class="welcome-greeting">${I18n.getLang()==='ko'?'환영합니다,':'Welcome Back,'}</div>
          <div class="welcome-name">${escHtml(uname)}</div>
        </div>
      </div>
      <div class="page-hd" style="padding-top:8px">
        <div class="page-hd-left">
          <h1 class="page-title">${I18n.t('todo.title')}</h1>
          <p class="page-sub">${inProgress}${I18n.getLang()==='ko'?' 개 진행 중':' in progress'} · ${doneCount}${I18n.getLang()==='ko'?' 개 완료':' done'}</p>
        </div>
        <button class="fab" onclick="Todo.showAdd()">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div class="todo-filter-wrap">
        <button class="todo-ftab ${_filter==='all'?'active':''}" onclick="Todo.setFilter('all')">${I18n.t('todo.all')}</button>
        <button class="todo-ftab ${_filter==='inProgress'?'active':''}" onclick="Todo.setFilter('inProgress')">${I18n.t('todo.inProgress')}</button>
        <button class="todo-ftab ${_filter==='done'?'active':''}" onclick="Todo.setFilter('done')">${I18n.t('todo.done')}</button>
      </div>
      <div class="todo-list">
        ${todos.length === 0 ? `
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="5" width="6" height="6" rx="1"/><rect x="3" y="13" width="6" height="6" rx="1"/><line x1="13" y1="8" x2="21" y2="8"/><line x1="13" y1="16" x2="21" y2="16"/></svg>
            <p class="empty-state-title">${I18n.t('todo.empty')}</p>
            <p class="empty-state-sub">${I18n.t('todo.emptySub')}</p>
          </div>` : todos.map(t => _renderItem(t)).join('')}
      </div>`;
  }

  function _renderItem(t) {
    const assignee = t.assigneeId ? (DB._cache?.users?.[t.assigneeId] || null) : null;
    const dueStr = t.dueDate ? _formatDate(t.dueDate) : '';
    const isOverdue = t.dueDate && !t.done && new Date(t.dueDate) < new Date();
    const prioClass = {high:'tag-red',mid:'tag-lime',low:'tag-gray'}[t.priority]||'tag-gray';
    return `
      <div class="todo-item ${t.done?'todo-done':''} ${t.priority==='high'&&!t.done?'todo-urgent':''}"
           onclick="Todo.showEdit('${t.id}')">
        <button class="todo-check ${t.done?'checked':''}" onclick="event.stopPropagation();Todo.toggleDone('${t.id}')">
          ${t.done?`<svg viewBox="0 0 12 12" fill="none" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round"><polyline points="2,6 5,9 10,3"/></svg>`:''}
        </button>
        <div class="todo-body">
          <div class="todo-title">${escHtml(t.title)}</div>
          <div class="todo-meta">
            ${dueStr?`<span class="todo-due ${isOverdue?'overdue':''}">${dueStr}</span>`:''}
            <span class="tag ${prioClass}">${I18n.t('todo.pri.'+(t.priority||'mid'))}</span>
          </div>
        </div>
        ${t.assigneeId?`<div class="avatar avatar-sm" style="background:${strColor(t.assigneeId)}">${(t.assigneeId||'?')[0].toUpperCase()}</div>`:''}
      </div>`;
  }

  function setFilter(f) { _filter = f; _render(); }

  async function toggleDone(id) {
    const t = _todos.find(x => x.id === id);
    if (!t) return;
    await DB.todos.set(id, { ...t, done: !t.done });
  }

  function showAdd() { _showForm(null); }
  function showEdit(id) {
    const t = _todos.find(x => x.id === id);
    if (t) _showForm(t);
  }

  async function _showForm(todo) {
    const proj = await DB.projects.getById(_projectId);
    const memberIds = proj?.memberIds || [];
    const members = await Promise.all(memberIds.map(id => DB.users.getById(id)));
    const validMembers = members.filter(Boolean);
    const isEdit = !!todo;

    const html = `
      <div class="modal-handle"></div>
      ${isEdit ? `<div class="modal-title">${I18n.t('todo.edit')}</div>` : ''}
      <div class="modal-body" style="${isEdit?'':'padding-top:4px'}">
        <div class="field-group">
          <label class="field-label">${I18n.t('todo.taskName')}</label>
          <div class="field-wrap">
            <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            <input id="td-title" class="field-input" type="text" placeholder="${I18n.t('todo.taskNamePh')}" value="${escHtml(todo?.title||'')}" maxlength="100">
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">${I18n.t('todo.desc')}</label>
          <textarea id="td-desc" class="field-textarea" placeholder="${I18n.t('todo.descPh')}" rows="3">${escHtml(todo?.desc||'')}</textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field-group">
            <label class="field-label">${I18n.t('todo.priority')}</label>
            <select id="td-priority" class="custom-select">
              <option value="high" ${todo?.priority==='high'?'selected':''}>${I18n.t('todo.pri.high')}</option>
              <option value="mid" ${(!todo||todo?.priority==='mid')?'selected':''}>${I18n.t('todo.pri.mid')}</option>
              <option value="low" ${todo?.priority==='low'?'selected':''}>${I18n.t('todo.pri.low')}</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">${I18n.t('todo.dueDate')}</label>
            <input id="td-due" class="field-input" type="date" style="padding-left:16px" value="${todo?.dueDate||''}">
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">${I18n.t('todo.assignee')}</label>
          <select id="td-assignee" class="custom-select">
            <option value="">—</option>
            ${validMembers.map(m=>`<option value="${m.id}" ${todo?.assigneeId===m.id?'selected':''}>${escHtml(m.displayName)} (@${m.username})</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        ${isEdit?`<button class="btn-danger" style="margin-right:auto" onclick="Todo._delete('${todo.id}')">${I18n.t('todo.delete')}</button>`:''}
        <button class="btn-secondary" style="flex:1" onclick="Modal.close()">${I18n.t('common.cancel')}</button>
        <button class="btn-primary" style="flex:2" onclick="Todo._save('${todo?.id||''}')">${I18n.t('todo.save')}</button>
      </div>`;
    Modal.open(html);
    setTimeout(()=>document.getElementById('td-title')?.focus(),300);
  }

  async function _save(existingId) {
    const title = document.getElementById('td-title')?.value.trim();
    if (!title) { document.getElementById('td-title')?.focus(); return; }
    const desc = document.getElementById('td-desc')?.value.trim();
    const priority = document.getElementById('td-priority')?.value||'mid';
    const dueDate = document.getElementById('td-due')?.value||'';
    const assigneeId = document.getElementById('td-assignee')?.value||'';

    const user = Auth.currentUser();
    const id = existingId || DB.genId();
    const existing = existingId ? _todos.find(x=>x.id===existingId) : null;

    await DB.todos.set(id, {
      id, projectId: _projectId, title, desc, priority, dueDate, assigneeId,
      done: existing?.done || false,
      createdBy: existing?.createdBy || user.id,
      createdAt: existing?.createdAt || Date.now(),
    });

    if (assigneeId && assigneeId !== user.id) {
      const assigneeName = (await DB.users.getById(assigneeId))?.displayName || '';
      await Notif.push(assigneeId, _projectId, 'todo',
        I18n.getLang()==='ko'?'할 일 배정':'Task assigned',
        `${user.displayName}: ${title}`);
    }
    Modal.close();
  }

  async function _delete(id) {
    if (!confirm(I18n.getLang()==='ko'?'정말 삭제하시겠습니까?':'Delete this task?')) return;
    await DB.todos.remove(id);
    Modal.close();
  }

  function _formatDate(ds) {
    if (!ds) return '';
    const d = new Date(ds);
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.round((d-today)/(86400000));
    if (diff===0) return I18n.t('common.today');
    if (diff===-1) return I18n.t('common.yesterday');
    return `${d.getMonth()+1}/${d.getDate()}`;
  }

  function destroy() { if (_unsub) { _unsub(); _unsub=null; } _todos=[]; }

  return { init, setFilter, toggleDone, showAdd, showEdit, _save, _delete, destroy, refresh:_render };
})();
