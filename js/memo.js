'use strict';
const Memo = (() => {
  let _projectId = null;
  let _unsub = null;
  let _memos = [];

  function init(projectId) {
    if (_projectId === projectId && _unsub) { _render(); return; }
    _projectId = projectId;
    if (_unsub) { _unsub(); _unsub = null; }
    _memos = [];
    document.getElementById('s-memo').innerHTML = '<div class="loading-row"><div class="spinner"></div></div>';
    _unsub = DB.memos.on(projectId, docs => { _memos = docs; _render(); });
  }

  const STYLES = [
    { bg:'var(--lime)', title:'#000', text:'#000', meta:'rgba(0,0,0,.5)', tag:'background:rgba(0,0,0,.12);color:#000' },
    { bg:'var(--card)', title:'var(--txt)', text:'var(--txt2)', meta:'var(--txt3)', tag:'background:var(--lime-dim);color:var(--lime)' },
    { bg:'var(--card2)', title:'var(--txt)', text:'var(--txt2)', meta:'var(--txt3)', tag:'background:var(--lime-dim);color:var(--lime)' },
  ];

  function _render() {
    const el = document.getElementById('s-memo');
    const memos = [..._memos].sort((a,b)=>(b._updatedAt?.seconds||b._updatedAt||0)-(a._updatedAt?.seconds||a._updatedAt||0));
    el.innerHTML = `
      <div class="page-hd">
        <div class="page-hd-left">
          <h1 class="page-title">${I18n.t('memo.title')}</h1>
          <p class="page-sub">${memos.length}${I18n.getLang()==='ko'?' 개':' notes'}</p>
        </div>
        <button class="fab" onclick="Memo.showAdd()">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div class="memo-grid">
        ${memos.length===0 ? `
          <div class="empty-state" style="grid-column:1/-1">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" stroke-width="1.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
            <p class="empty-state-title">${I18n.t('memo.empty')}</p>
            <p class="empty-state-sub">${I18n.t('memo.emptySub')}</p>
          </div>` : memos.map((m,i)=>_renderCard(m,i)).join('')}
      </div>`;
  }

  function _renderCard(m, i) {
    const s = STYLES[i % STYLES.length];
    const preview = (m.content||'').slice(0,80)+((m.content||'').length>80?'…':'');
    const ts = m._updatedAt?.seconds ? m._updatedAt.seconds*1000 : (m._updatedAt||m.createdAt||0);
    return `
      <div class="memo-card ${i===0?'memo-card-wide':''}" style="background:${s.bg}" onclick="Memo.showEdit('${m.id}')">
        <div class="memo-card-date" style="color:${s.meta}">${_relDate(ts)}</div>
        <div class="memo-card-title" style="color:${s.title}">${escHtml(m.title||'—')}</div>
        <div class="memo-card-preview" style="color:${s.text}">${escHtml(preview)}</div>
        <div class="memo-card-footer">
          <span class="memo-tag" style="${s.tag}">${(m.content||'').length}${I18n.t('memo.chars')}</span>
        </div>
      </div>`;
  }

  function showAdd() { _showForm(null); }
  function showEdit(id) {
    const m = _memos.find(x=>x.id===id);
    if (m) _showForm(m);
  }

  function _showForm(memo) {
    const isEdit = !!memo;
    const html = `
      <div class="modal-handle"></div>
      ${isEdit ? `<div class="modal-title">${I18n.t('memo.edit')}</div>` : ''}
      <div class="modal-body" style="${isEdit?'':'padding-top:8px'}">
        <div class="field-group">
          <textarea id="memo-content" class="field-textarea" placeholder="${I18n.t('memo.contentPh')}" rows="10" style="min-height:200px">${escHtml(memo?.content||'')}</textarea>
          <div id="memo-char-count" class="field-hint" style="text-align:right"></div>
        </div>
        <div class="field-group">
          <label class="field-label">${I18n.t('memo.titleField')}</label>
          <div class="field-wrap">
            <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>
            <input id="memo-title" class="field-input" type="text" placeholder="${I18n.t('memo.titlePh')}" value="${escHtml(memo?.title||'')}" maxlength="80">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        ${isEdit?`<button class="btn-danger" style="margin-right:auto" onclick="Memo._delete('${memo.id}')">${I18n.t('memo.delete')}</button>`:''}
        <button class="btn-secondary" style="flex:1" onclick="Modal.close()">${I18n.t('common.cancel')}</button>
        <button class="btn-primary" style="flex:2" onclick="Memo._save('${memo?.id||''}')">${I18n.t('memo.save')}</button>
      </div>`;
    Modal.open(html);
    setTimeout(() => {
      const ta = document.getElementById('memo-content');
      const titleEl = document.getElementById('memo-title');
      const cc = document.getElementById('memo-char-count');

      // 글자수 카운터
      if (ta && cc) {
        cc.textContent = ta.value.length + I18n.t('memo.chars');
        ta.addEventListener('input', () => {
          cc.textContent = ta.value.length + I18n.t('memo.chars');
          // 신규 메모: 첫 10토큰을 제목으로 자동 입력
          if (!isEdit && titleEl) {
            const words = ta.value.trim().split(/\s+/).slice(0, 10).join(' ');
            titleEl.value = words.slice(0, 80);
          }
        });
      }

      // 본문 우선 포커스
      if (ta) {
        ta.focus();
        ta.setSelectionRange(0, 0);
      }
    }, 300);
  }

  async function _save(existingId) {
    const title = document.getElementById('memo-title')?.value.trim();
    const content = document.getElementById('memo-content')?.value.trim();
    if (!title && !content) return;
    const user = Auth.currentUser();
    const id = existingId || DB.genId();
    const existing = existingId ? _memos.find(x=>x.id===existingId) : null;
    await DB.memos.set(id, {
      id, projectId: _projectId, title, content,
      createdBy: existing?.createdBy || user.id,
      createdAt: existing?.createdAt || Date.now(),
    });
    Modal.close();
  }

  async function _delete(id) {
    if (!confirm(I18n.getLang()==='ko'?'정말 삭제하시겠습니까?':'Delete this memo?')) return;
    await DB.memos.remove(id);
    Modal.close();
  }

  function _relDate(ts) {
    if (!ts) return '';
    const diff = Math.floor((Date.now()-ts)/1000);
    const lang = I18n.getLang();
    if (diff<60) return lang==='ko'?'방금':'Just now';
    if (diff<3600) return lang==='ko'?`${Math.floor(diff/60)}분 전`:`${Math.floor(diff/60)}m ago`;
    if (diff<86400) return lang==='ko'?`${Math.floor(diff/3600)}시간 전`:`${Math.floor(diff/3600)}h ago`;
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()}`;
  }

  function destroy() { if (_unsub){_unsub();_unsub=null;} _memos=[]; }
  return { init, showAdd, showEdit, _save, _delete, destroy };
})();
