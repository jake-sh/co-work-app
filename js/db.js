'use strict';
/* ═══════════════════════════════════════════════════════════
   DB  —  Firestore 실시간 동기화
   
   컬렉션 구조:
   users/{uid}              — 사용자 정보 (username, displayName)
   projects/{pid}           — 프로젝트
   todos/{tid}              — 할 일 (projectId 필드로 필터)
   memos/{mid}              — 메모
   events/{eid}             — 일정
   messages/{msgid}         — 채팅 메시지
   notifications/{nid}      — 알림
   presence/{uid_pid}       — 온라인 상태
═══════════════════════════════════════════════════════════ */
const DB = (() => {

  /* ── 내부 캐시 (오프라인 / 즉시 읽기용) ── */
  const _cache = {};
  const _listeners = {};   // { col: [ unsubFn, ... ] }

  function _cacheKey(col, id) { return col + '/' + id; }

  function _setCache(col, id, data) {
    if (!_cache[col]) _cache[col] = {};
    _cache[col][id] = data;
  }

  function _delCache(col, id) {
    if (_cache[col]) delete _cache[col][id];
  }

  /* ── ID 생성 ── */
  function genId() {
    return fsdb.collection('_').doc().id;   // Firestore 고유 ID 사용
  }

  /* ═══════════════════════════════
     CORE CRUD (Promise 기반)
  ═══════════════════════════════ */

  async function getItem(col, id) {
    // 캐시 우선
    if (_cache[col]?.[id]) return _cache[col][id];
    const snap = await fsdb.collection(col).doc(id).get();
    if (!snap.exists) return null;
    const data = { id: snap.id, ...snap.data() };
    _setCache(col, id, data);
    return data;
  }

  async function setItem(col, id, data) {
    const payload = { ...data, _updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    await fsdb.collection(col).doc(id).set(payload, { merge: true });
    const local = { ...payload, id, _updatedAt: Date.now() };
    _setCache(col, id, local);
    return local;
  }

  async function removeItem(col, id) {
    await fsdb.collection(col).doc(id).delete();
    _delCache(col, id);
  }

  /* ─ 쿼리 (한 번 읽기) ─ */
  async function queryOnce(col, ...whereClauses) {
    let ref = fsdb.collection(col);
    for (const [field, op, val] of whereClauses) {
      ref = ref.where(field, op, val);
    }
    const snap = await ref.get();
    return snap.docs.map(d => {
      const data = { id: d.id, ...d.data() };
      _setCache(col, d.id, data);
      return data;
    });
  }

  /* ─ 실시간 구독 ─ */
  function onCollection(col, whereClauses, callback) {
    let ref = fsdb.collection(col);
    for (const [field, op, val] of whereClauses) {
      ref = ref.where(field, op, val);
    }
    const unsub = ref.onSnapshot(snap => {
      const docs = snap.docs.map(d => {
        const data = { id: d.id, ...d.data() };
        _setCache(col, d.id, data);
        return data;
      });
      // 삭제된 doc 캐시 제거
      snap.docChanges().forEach(change => {
        if (change.type === 'removed') _delCache(col, change.doc.id);
      });
      callback(docs);
    }, err => console.error('[DB] onSnapshot error:', col, err));
    return unsub;
  }

  /* ═══════════════════════════════
     COLLECTIONS API
  ═══════════════════════════════ */

  /* ── users ── */
  const users = {
    async getById(uid) {
      return getItem('users', uid);
    },
    async getByUsername(uname) {
      // 캐시에서 먼저
      const cached = Object.values(_cache['users'] || {}).find(u => u.username === uname);
      if (cached) return cached;
      const results = await queryOnce('users', ['username', '==', uname]);
      return results[0] || null;
    },
    async set(uid, data) {
      return setItem('users', uid, data);
    },
  };

  /* ── projects ── */
  const projects = {
    async getById(pid) {
      return getItem('projects', pid);
    },
    async forUser(uid) {
      return queryOnce('projects', ['memberIds', 'array-contains', uid]);
    },
    async set(pid, data) {
      return setItem('projects', pid, data);
    },
    async remove(pid) {
      return removeItem('projects', pid);
    },
    on(uid, callback) {
      return onCollection('projects', [['memberIds', 'array-contains', uid]], callback);
    },
  };

  /* ── todos ── */
  const todos = {
    async forProject(pid) {
      const cached = Object.values(_cache['todos'] || {}).filter(t => t.projectId === pid);
      if (cached.length > 0) return cached;
      return queryOnce('todos', ['projectId', '==', pid]);
    },
    async get(id) { return getItem('todos', id); },
    async set(id, data) { return setItem('todos', id, data); },
    async remove(id) { return removeItem('todos', id); },
    on(pid, callback) {
      return onCollection('todos', [['projectId', '==', pid]], callback);
    },
  };

  /* ── memos ── */
  const memos = {
    async forProject(pid) {
      const cached = Object.values(_cache['memos'] || {}).filter(m => m.projectId === pid);
      if (cached.length > 0) return cached;
      return queryOnce('memos', ['projectId', '==', pid]);
    },
    async get(id) { return getItem('memos', id); },
    async set(id, data) { return setItem('memos', id, data); },
    async remove(id) { return removeItem('memos', id); },
    on(pid, callback) {
      return onCollection('memos', [['projectId', '==', pid]], callback);
    },
  };

  /* ── events (schedule) ── */
  const events = {
    async forProject(pid) {
      const cached = Object.values(_cache['events'] || {}).filter(e => e.projectId === pid);
      if (cached.length > 0) return cached;
      return queryOnce('events', ['projectId', '==', pid]);
    },
    async get(id) { return getItem('events', id); },
    async set(id, data) { return setItem('events', id, data); },
    async remove(id) { return removeItem('events', id); },
    on(pid, callback) {
      return onCollection('events', [['projectId', '==', pid]], callback);
    },
  };

  /* ── messages ── */
  const messages = {
    async forProject(pid) {
      const results = await queryOnce('messages', ['projectId', '==', pid]);
      return results.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    },
    async set(id, data) { return setItem('messages', id, data); },
    on(pid, callback) {
      return onCollection(
        'messages',
        [['projectId', '==', pid]],
        docs => callback(docs.sort((a,b) => (a.createdAt?.seconds||0)-(b.createdAt?.seconds||0)))
      );
    },
  };

  /* ── notifications ── */
  const notifications = {
    async forUser(uid) {
      const results = await queryOnce('notifications', ['userId', '==', uid]);
      return results.sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    },
    async set(id, data) { return setItem('notifications', id, data); },
    async markRead(id) {
      await fsdb.collection('notifications').doc(id).update({ read: true });
    },
    async clearAll(uid) {
      const snap = await fsdb.collection('notifications').where('userId','==',uid).get();
      const batch = fsdb.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    },
    on(uid, callback) {
      return onCollection('notifications', [['userId', '==', uid]], callback);
    },
  };

  /* ── presence ── */
  const presence = {
    async set(userId, projectId, online) {
      const id = userId + '_' + projectId;
      return setItem('presence', id, { userId, projectId, online, lastSeen: Date.now() });
    },
    async get(userId, projectId) {
      return getItem('presence', userId + '_' + projectId);
    },
    async forProject(pid) {
      return queryOnce('presence', ['projectId', '==', pid]);
    },
    on(pid, callback) {
      return onCollection('presence', [['projectId', '==', pid]], callback);
    },
  };

  return {
    genId,
    getItem, setItem, removeItem, queryOnce,
    users, projects, todos, memos, events, messages, notifications, presence,
  };
})();
