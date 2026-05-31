'use strict';
/* ═══════════════════════════════════════════════════════════
   Auth — Firebase Authentication
   이메일: username@cowork.app (내부 가상 도메인)
═══════════════════════════════════════════════════════════ */
const Auth = (() => {
  const SESSION_KEY = 'cw_session';
  let _currentUser = null;
  let _authReady = false;
  let _authReadyCbs = [];

  try { _currentUser = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch {}

  function toEmail(u) { return u.trim().toLowerCase() + '@cowork.app'; }
  function currentUser() { return _currentUser; }

  function _setSession(user) {
    _currentUser = user;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
  function _clearSession() {
    _currentUser = null;
    sessionStorage.removeItem(SESSION_KEY);
  }

  /* ── Firebase Auth 상태 감지 ── */
  function onAuthStateChanged(callback) {
    return fbAuth.onAuthStateChanged(async firebaseUser => {
      if (firebaseUser) {
        // 프로필 로드 재시도 (회원가입 직후 타이밍 이슈 대비)
        let profile = null;
        for (let i = 0; i < 5; i++) {
          profile = await DB.users.getById(firebaseUser.uid);
          if (profile) break;
          await new Promise(r => setTimeout(r, 500));
        }
        if (profile) {
          const user = { id: firebaseUser.uid, username: profile.username, displayName: profile.displayName };
          _setSession(user);
          callback({ loggedIn: true, user });
        } else {
          await fbAuth.signOut();
          _clearSession();
          callback({ loggedIn: false });
        }
      } else {
        _clearSession();
        callback({ loggedIn: false });
      }
    });
  }

  /* ── 아이디 중복 확인 ── */
  async function checkIdAvailable(username) {
    username = username.trim().toLowerCase();
    if (!username) return null;
    if (!/^[a-z0-9_]{4,20}$/.test(username)) return false;
    try {
      const existing = await DB.users.getByUsername(username);
      return !existing;
    } catch { return true; }
  }

  /* ── 회원가입 ── */
  async function register(username, displayName, password) {
    username = username.trim().toLowerCase();
    displayName = displayName.trim();

    if (!username) return { ok: false, err: I18n.t('auth.err.idRequired') };
    if (!/^[a-z0-9_]{4,20}$/.test(username)) return { ok: false, err: I18n.t('auth.err.idFormat') };
    if (!displayName) return { ok: false, err: I18n.t('auth.err.nameRequired') };
    if (password.length < 8) return { ok: false, err: I18n.t('auth.err.pwShort') };

    try {
      // 아이디 중복 확인
      const existing = await DB.users.getByUsername(username);
      if (existing) return { ok: false, err: I18n.t('auth.err.idTaken') };

      // Firebase Auth 계정 생성
      const cred = await fbAuth.createUserWithEmailAndPassword(toEmail(username), password);
      const uid = cred.user.uid;

      // 토큰 갱신 대기 (Firestore 권한 활성화)
      await cred.user.getIdToken(true);

      // Firestore 프로필 저장
      await fsdb.collection('users').doc(uid).set({
        id: uid,
        username,
        displayName,
        createdAt: Date.now(),
        _updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      const user = { id: uid, username, displayName };
      _setSession(user);
      return { ok: true, user };
    } catch (e) {
      console.error('[Auth] register error:', e.code, e.message);
      if (e.code === 'auth/email-already-in-use') return { ok: false, err: I18n.t('auth.err.idTaken') };
      if (e.code === 'auth/invalid-email') return { ok: false, err: I18n.t('auth.err.idFormat') };
      if (e.code === 'auth/weak-password') return { ok: false, err: I18n.t('auth.err.pwShort') };
      return { ok: false, err: e.message };
    }
  }

  /* ── 로그인 ── */
  async function login(username, password) {
    username = username.trim().toLowerCase();
    try {
      const cred = await fbAuth.signInWithEmailAndPassword(toEmail(username), password);
      const uid = cred.user.uid;
      const profile = await DB.users.getById(uid);
      if (!profile) return { ok: false, err: I18n.t('auth.err.notFound') };
      const user = { id: uid, username: profile.username, displayName: profile.displayName };
      _setSession(user);
      return { ok: true, user };
    } catch (e) {
      console.error('[Auth] login error:', e.code);
      return { ok: false, err: I18n.t('auth.err.notFound') };
    }
  }

  /* ── 로그아웃 ── */
  async function logout() {
    await fbAuth.signOut();
    _clearSession();
  }

  /* ── 비밀번호 변경 ── */
  async function changePw(newPw) {
    if (newPw.length < 8) return { ok: false, err: I18n.t('auth.err.pwShort') };
    try {
      await fbAuth.currentUser.updatePassword(newPw);
      return { ok: true };
    } catch (e) {
      if (e.code === 'auth/requires-recent-login') {
        return { ok: false, err: I18n.getLang() === 'ko'
          ? '보안을 위해 다시 로그인 후 시도해주세요.'
          : 'Please log in again for security.' };
      }
      return { ok: false, err: e.message };
    }
  }

  return { currentUser, onAuthStateChanged, register, login, logout, checkIdAvailable, changePw };
})();
