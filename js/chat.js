'use strict';
const Chat = (() => {
  let _projectId=null, _unsub=null, _unsubPres=null;
  let _msgs=[], _isVisible=false, _unreadCount=0;

  function init(projectId) {
    if(_projectId===projectId && _unsub){setVisible(true);return;}
    _projectId=projectId; _msgs=[]; _unreadCount=0;
    if(_unsub){_unsub();_unsub=null;}
    if(_unsubPres){_unsubPres();_unsubPres=null;}

    const user=Auth.currentUser();
    DB.presence.set(user.id,projectId,true);

    _render();
    _unsub=DB.messages.on(projectId,docs=>{
      const prev=_msgs.length;
      _msgs=docs;
      if(!_isVisible && docs.length>prev){
        const newMsgs=docs.slice(prev);
        const mine=newMsgs.filter(m=>m.senderId===user.id);
        const others=newMsgs.filter(m=>m.senderId!==user.id);
        _unreadCount+=others.length;
        _updateBadge();
        if(others.length>0){
          const s=Settings.get();
          if(s.chatAlerts!==false){
            const last=others[others.length-1];
            DB.users.getById(last.senderId).then(sender=>{
              Notif.push(user.id,_projectId,'chat',sender?.displayName||'Chat',last.text?.slice(0,60)||'');
            });
          }
        }
      }
      _renderMsgs();
    });
    _unsubPres=DB.presence.on(projectId,()=>_renderOnline());
  }

  function setVisible(v){
    _isVisible=v;
    if(v){_unreadCount=0;_updateBadge();_renderMsgs();}
  }

  function _render(){
    const el=document.getElementById('s-chat');
    // 채팅 화면 flex 구조로 설정
    el.style.cssText='display:flex;flex-direction:column;height:100%;overflow:hidden;';
    el.innerHTML=`
      <div class="page-hd" style="flex-shrink:0">
        <div class="page-hd-left">
          <h1 class="page-title">${I18n.t('chat.title')}</h1>
          <p class="page-sub" id="chat-online-count"></p>
        </div>
      </div>
      <div id="chat-member-pins" class="chat-members" style="flex-shrink:0"></div>
      <div class="chat-messages" id="chat-messages" style="flex:1;overflow-y:auto;padding:12px 20px;display:flex;flex-direction:column;gap:2px;"></div>
      <div class="chat-input-wrap" style="flex-shrink:0;padding:10px 16px 16px;background:var(--bnav-bg);border-top:1px solid var(--border2);">
        <div class="chat-input-inner" style="display:flex;gap:8px;align-items:flex-end;background:var(--card);border-radius:18px;padding:6px 6px 6px 14px;border:1px solid var(--border);">
          <textarea id="chat-input" class="chat-input" placeholder="${I18n.t('chat.msgPh')}" rows="1"
            onkeydown="Chat.onKeyDown(event)" oninput="Chat.autoResize(this)"
            style="flex:1;background:none;border:none;outline:none;font-size:15px;color:var(--txt);resize:none;max-height:120px;line-height:1.5;padding:6px 0;font-family:var(--font-body)"></textarea>
          <button class="chat-send-btn" onclick="Chat.send()" style="width:36px;height:36px;border-radius:12px;background:var(--accent);flex-shrink:0;display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;stroke:#fff"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
          </button>
        </div>
      </div>`;
    _renderOnline();
    _renderMsgs();
  }

  async function _renderOnline(){
    const presences=await DB.presence.forProject(_projectId);
    const now=Date.now();
    const onlineIds=presences.filter(p=>p.online&&(now-(p.lastSeen||0)<30000)).map(p=>p.userId);

    // pins
    const proj=await DB.projects.getById(_projectId);
    if(!proj)return;
    const members=await Promise.all((proj.memberIds||[]).map(id=>DB.users.getById(id)));
    const pinsEl=document.getElementById('chat-member-pins');
    if(pinsEl) pinsEl.innerHTML=members.filter(Boolean).map(m=>{
      const online=onlineIds.includes(m.id);
      return`<div class="chat-member-chip ${online?'online':''}">
        <div class="avatar avatar-sm ${online?'online-dot':''}" style="background:${strColor(m.displayName)}">${m.displayName[0].toUpperCase()}</div>
        <span>${escHtml(m.displayName)}</span>
      </div>`;
    }).join('');

    const cntEl=document.getElementById('chat-online-count');
    if(cntEl) cntEl.textContent=I18n.getLang()==='ko'?`${onlineIds.length}명 온라인`:`${onlineIds.length} online`;
  }

  function _renderMsgs(){
    const el=document.getElementById('chat-messages');
    if(!el)return;
    const user=Auth.currentUser();
    if(_msgs.length===0){
      el.innerHTML=`<div class="empty-state"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" stroke-width="1.5" stroke-linecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><p class="empty-state-sub">${I18n.t('chat.empty')}</p></div>`;
      return;
    }
    let html='', lastDate='', lastSender='';
    _msgs.forEach(msg=>{
      const isMine=msg.senderId===user.id;
      const ts=msg.createdAt?.seconds?msg.createdAt.seconds*1000:(msg.createdAt||0);
      const dateStr=new Date(ts).toDateString();
      if(dateStr!==lastDate){lastDate=dateStr;lastSender='';html+=`<div class="chat-date-sep">${_fmtDateLbl(ts)}</div>`;}
      const showAva=!isMine&&lastSender!==msg.senderId;
      lastSender=msg.senderId;
      const senderName=msg.senderName||msg.senderId;
      const timeStr=_fmtTime(ts);
      if(isMine){
        html+=`<div class="msg-row mine"><div class="msg-bubble mine">${escHtml(msg.text)}</div><div class="msg-time">${timeStr}</div></div>`;
      } else {
        html+=`<div class="msg-row theirs">
          <div class="msg-avatar-wrap">${showAva?`<div class="avatar avatar-sm" style="background:${strColor(senderName)}">${senderName[0].toUpperCase()}</div>`:'<div style="width:32px"></div>'}</div>
          <div>${showAva?`<div class="msg-sender">${escHtml(senderName)}</div>`:''}<div class="msg-bubble theirs">${escHtml(msg.text)}</div><div class="msg-time">${timeStr}</div></div>
        </div>`;
      }
    });
    el.innerHTML=html;
    el.scrollTop=el.scrollHeight;
  }

  async function send(){
    const input=document.getElementById('chat-input');
    const text=(input?.value||'').trim();
    if(!text)return;
    const user=Auth.currentUser();
    const id=DB.genId();
    await DB.messages.set(id,{id,projectId:_projectId,senderId:user.id,senderName:user.displayName,text,createdAt:Date.now()});
    input.value=''; input.style.height='';
  }

  function onKeyDown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}
  function autoResize(ta){ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,120)+'px';}

  function _updateBadge(){
    const b=document.getElementById('chat-badge');
    if(!b)return;
    if(_unreadCount>0){b.textContent=_unreadCount;b.classList.remove('hidden');}
    else b.classList.add('hidden');
  }

  function _fmtTime(ts){
    const d=new Date(ts),h=d.getHours(),m=d.getMinutes(),lang=I18n.getLang();
    const mm=String(m).padStart(2,'0');
    return lang==='ko'?`${h<12?'오전':'오후'} ${h%12||12}:${mm}`:`${h%12||12}:${mm} ${h<12?'AM':'PM'}`;
  }
  function _fmtDateLbl(ts){
    const d=new Date(ts),today=new Date();today.setHours(0,0,0,0);
    const diff=Math.round((d-today)/86400000);
    if(diff===0)return I18n.t('common.today');
    if(diff===-1)return I18n.t('common.yesterday');
    const lang=I18n.getLang();
    return lang==='ko'?`${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`:`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function destroy(){
    if(_unsub){_unsub();_unsub=null;}
    if(_unsubPres){_unsubPres();_unsubPres=null;}
    const user=Auth.currentUser();
    if(user&&_projectId) DB.presence.set(user.id,_projectId,false);
    _msgs=[];
  }

  return{init,setVisible,send,onKeyDown,autoResize,destroy};
})();
