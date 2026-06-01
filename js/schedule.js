'use strict';
const Schedule = (() => {
  let _projectId=null, _unsub=null, _events=[];
  let _selDate=null, _year=null, _month=null;
  const COLORS=['#C8703C','#E89B6C','#6B9BD8','#A584C8','#7BA86B','#E5604F'];

  function init(projectId) {
    if (_projectId===projectId && _unsub){_render();return;}
    _projectId=projectId;
    if(_unsub){_unsub();_unsub=null;}
    const now=new Date();
    _selDate=_toDs(now); _year=now.getFullYear(); _month=now.getMonth();
    _events=[];
    document.getElementById('s-schedule').innerHTML='<div class="loading-row"><div class="spinner"></div></div>';
    _unsub=DB.events.on(projectId,docs=>{_events=docs;_render();});
  }

  function _toDs(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}

  function _render(){
    const el=document.getElementById('s-schedule');
    const now=new Date(), todayDs=_toDs(now);
    const first=new Date(_year,_month,1), last=new Date(_year,_month+1,0);
    const startDow=first.getDay(), daysInMonth=last.getDate();
    const eventDays=new Set();
    _events.forEach(e=>{
      if(!e.startDate)return;
      eventDays.add(e.startDate.slice(0,10));
      if(e.endDate){
        let d=new Date(e.startDate.slice(0,10)+'T00:00:00');
        const end=new Date(e.endDate.slice(0,10)+'T00:00:00');
        while(d<=end){eventDays.add(_toDs(d));d.setDate(d.getDate()+1);}
      }
    });
    const lang=I18n.getLang();
    const mNames={ko:['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']};
    const dNames={ko:['일','월','화','수','목','금','토'],en:['S','M','T','W','T','F','S']};
    let cells='';
    for(let i=0;i<startDow;i++) cells+=`<div class="cal-d inactive"></div>`;
    for(let d=1;d<=daysInMonth;d++){
      const ds=`${_year}-${String(_month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells+=`<div class="cal-d ${ds===todayDs?'today':''} ${ds===_selDate&&ds!==todayDs?'selected':''} ${eventDays.has(ds)?'has-dot':''}" onclick="Schedule.selDate('${ds}')">${d}</div>`;
    }
    const selEvs=_events.filter(e=>{
      if(!e.startDate)return false;
      const s=e.startDate.slice(0,10), en=e.endDate?e.endDate.slice(0,10):s;
      return _selDate>=s&&_selDate<=en;
    }).sort((a,b)=>(a.startDate||'').localeCompare(b.startDate||''));

    el.innerHTML=`
      <div class="page-hd">
        <div class="page-hd-left">
          <h1 class="page-title">${I18n.t('schedule.title')}</h1>
          <p class="page-sub">${_year}${lang==='ko'?'년 ':' '}${mNames[lang][_month]}</p>
        </div>
        <button class="fab" onclick="Schedule.showAdd()">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div class="cal-header-row">
        <button class="cal-nav-btn" onclick="Schedule.prevMonth()"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><polyline points="15,18 9,12 15,6"/></svg></button>
        <span class="cal-month-label">${_year}${lang==='ko'?'. ':' '}${mNames[lang][_month]}</span>
        <button class="cal-nav-btn" onclick="Schedule.nextMonth()"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><polyline points="9,18 15,12 9,6"/></svg></button>
      </div>
      <div class="cal-grid-wrap">
        <div class="cal-wday">${dNames[lang].map(d=>`<div class="cal-wlabel">${d}</div>`).join('')}</div>
        <div class="cal-days">${cells}</div>
      </div>
      <div class="cal-sel-label">${_selDate===todayDs?I18n.t('common.today'):_fmtSelDate(_selDate)}${selEvs.length>0?`<span class="lime-tag" style="margin-left:8px">${selEvs.length}</span>`:''}</div>
      <div class="cal-events">
        ${selEvs.length===0?`<div class="empty-state" style="padding:24px 0"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg><p class="empty-state-sub">${I18n.t('schedule.empty')}</p></div>`
        :selEvs.map(e=>_renderEv(e)).join('')}
      </div>`;
  }

  function _renderEv(e){
    const c=e.color||COLORS[0];
    const t=e.allDay?(I18n.getLang()==='ko'?'종일':'All day'):(e.startDate?.slice(11,16)||'');
    return `<div class="cal-event" onclick="Schedule.showEdit('${e.id}')">
      <div class="cal-event-bar" style="background:${c}"></div>
      <div class="cal-event-body"><div class="cal-event-title">${escHtml(e.title)}</div><div class="cal-event-time">${t}${e.desc?' · '+escHtml(e.desc.slice(0,30)):''}</div></div>
      <div style="width:24px;height:24px;border-radius:7px;background:${c}20;border:1px solid ${c}40;flex-shrink:0"></div>
    </div>`;
  }

  function selDate(ds){_selDate=ds;_render();}
  function prevMonth(){_month--;if(_month<0){_month=11;_year--;}_render();}
  function nextMonth(){_month++;if(_month>11){_month=0;_year++;}_render();}

  function showAdd(){_showForm(null,_selDate);}
  function showEdit(id){const e=_events.find(x=>x.id===id);if(e)_showForm(e);}

  function _showForm(ev,defaultDate){
    const isEdit=!!ev;
    const defStart=ev?.startDate?.slice(0,16)||(defaultDate?defaultDate+'T09:00':'');
    const defEnd=ev?.endDate?.slice(0,16)||(defaultDate?defaultDate+'T10:00':'');
    const colorOpts=COLORS.map(c=>`<div class="color-opt ${(ev?.color||COLORS[0])===c?'selected':''}" style="background:${c}" onclick="Schedule._pickColor(this,'${c}')"></div>`).join('');
    const html=`
      <div class="modal-handle"></div>
      <div class="modal-title">${I18n.t(isEdit?'schedule.edit':'schedule.new')}</div>
      <div class="modal-body">
        <div class="field-group">
          <label class="field-label">${I18n.t('schedule.eventTitle')}</label>
          <div class="field-wrap">
            <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <input id="ev-title" class="field-input" type="text" placeholder="${I18n.t('schedule.eventTitlePh')}" value="${escHtml(ev?.title||'')}" maxlength="80">
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">${I18n.t('schedule.color')}</label>
          <div class="color-picker">${colorOpts}</div>
          <input type="hidden" id="ev-color" value="${ev?.color||COLORS[0]}">
        </div>
        <div style="display:flex;align-items:center;gap:12px;padding:4px 0">
          <label class="field-label" style="margin:0">${I18n.t('schedule.allDay')}</label>
          <div class="toggle-wrap">
            <input type="checkbox" id="ev-allday" ${ev?.allDay?'checked':''} onchange="Schedule._toggleAllDay(this)">
            <div class="toggle" onclick="document.getElementById('ev-allday').click()"></div>
          </div>
        </div>
        <div id="ev-time-f" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field-group"><label class="field-label">${I18n.t('schedule.startDate')}</label><input id="ev-start" class="field-input" type="datetime-local" style="padding-left:16px" value="${defStart}"></div>
          <div class="field-group"><label class="field-label">${I18n.t('schedule.endDate')}</label><input id="ev-end" class="field-input" type="datetime-local" style="padding-left:16px" value="${defEnd}"></div>
        </div>
        <div id="ev-date-f" style="display:none;grid-template-columns:1fr 1fr;gap:12px">
          <div class="field-group"><label class="field-label">${I18n.t('schedule.startDate')}</label><input id="ev-start-d" class="field-input" type="date" style="padding-left:16px" value="${ev?.startDate?.slice(0,10)||defaultDate||''}"></div>
          <div class="field-group"><label class="field-label">${I18n.t('schedule.endDate')}</label><input id="ev-end-d" class="field-input" type="date" style="padding-left:16px" value="${ev?.endDate?.slice(0,10)||defaultDate||''}"></div>
        </div>
        <div class="field-group">
          <label class="field-label">${I18n.t('schedule.desc')}</label>
          <textarea id="ev-desc" class="field-textarea" placeholder="${I18n.t('schedule.descPh')}" rows="2">${escHtml(ev?.desc||'')}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        ${isEdit?`<button class="btn-danger" style="margin-right:auto" onclick="Schedule._delete('${ev.id}')">${I18n.t('schedule.delete')}</button>`:''}
        <button class="btn-secondary" style="flex:1" onclick="Modal.close()">${I18n.t('common.cancel')}</button>
        <button class="btn-primary" style="flex:2" onclick="Schedule._save('${ev?.id||''}')">${I18n.t('schedule.save')}</button>
      </div>`;
    Modal.open(html);
    if(ev?.allDay) Schedule._toggleAllDay({checked:true});
    setTimeout(()=>document.getElementById('ev-title')?.focus(),300);
  }

  function _pickColor(el,c){document.querySelectorAll('.color-opt').forEach(o=>o.classList.remove('selected'));el.classList.add('selected');document.getElementById('ev-color').value=c;}
  function _toggleAllDay(cb){
    const tf=document.getElementById('ev-time-f'),df=document.getElementById('ev-date-f');
    if(tf)tf.style.display=cb.checked?'none':'grid';
    if(df)df.style.display=cb.checked?'grid':'none';
  }

  async function _save(existingId){
    const title=document.getElementById('ev-title')?.value.trim();
    if(!title){document.getElementById('ev-title')?.focus();return;}
    const allDay=document.getElementById('ev-allday')?.checked;
    const color=document.getElementById('ev-color')?.value||COLORS[0];
    const desc=document.getElementById('ev-desc')?.value.trim();
    let startDate,endDate;
    if(allDay){startDate=document.getElementById('ev-start-d')?.value||_toDs(new Date());endDate=document.getElementById('ev-end-d')?.value||startDate;}
    else{startDate=document.getElementById('ev-start')?.value;endDate=document.getElementById('ev-end')?.value;}
    const user=Auth.currentUser();
    const id=existingId||DB.genId();
    const existing=existingId?_events.find(x=>x.id===existingId):null;
    await DB.events.set(id,{id,projectId:_projectId,title,startDate,endDate,allDay,color,desc,createdBy:existing?.createdBy||user.id,createdAt:existing?.createdAt||Date.now()});
    // 멤버 알림
    const proj=await DB.projects.getById(_projectId);
    await Promise.all((proj?.memberIds||[]).filter(mid=>mid!==user.id).map(mid=>
      Notif.push(mid,_projectId,'schedule',I18n.getLang()==='ko'?'새 일정':'New event',`${user.displayName}: ${title}`)
    ));
    Modal.close();
  }

  async function _delete(id){
    if(!confirm(I18n.getLang()==='ko'?'정말 삭제하시겠습니까?':'Delete this event?'))return;
    await DB.events.remove(id);Modal.close();
  }

  function _fmtSelDate(ds){
    if(!ds)return'';
    const d=new Date(ds+'T00:00:00'),lang=I18n.getLang();
    return lang==='ko'?`${d.getMonth()+1}월 ${d.getDate()}일`:`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getDate()}`;
  }

  function destroy(){if(_unsub){_unsub();_unsub=null;}_events=[];}
  return{init,selDate,prevMonth,nextMonth,showAdd,showEdit,_save,_delete,_pickColor,_toggleAllDay,destroy};
})();
