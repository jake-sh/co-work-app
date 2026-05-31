'use strict';
/* ═══════════════════════════════════════════════════════════
   Auth — Firebase Authentication (이메일/비밀번호)
   
   앱 아이디(username) 시스템 유지:
   - Firebase Auth 이메일 = username@cowork.app (내부용 가상 이메일)
   - Firestore users/{uid} 에 username, displayName 저장
   - 앱은 username 으로 로그인하지만 내부적으로 Firebase Auth 사용
═══════════════════════════════════════════════════════════ */
const Auth = (() => {
  const SESSION_KEY = 'cw_session';

  /* 가상 이메일 변환 (Firebase Auth 용) */
  function toEmail(username) {
    return username.trim().toLowerCase() + '@cowork.internal';
  }

  /* ── 세션 (메모리 캐시) ── */
  let _currentUser = null;

  try {
    _currentUser = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {}

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
        // Firestore에서 프로필 로드
        const profile = await DB.users.getById(firebaseUser.uid);
        if (profile) {
          const user = {
            id: firebaseUser.uid,
            username: profile.username,
            displayName: profile.displayName,
          };
          _setSession(user);
          callback({ loggedIn: true, user });
        } else {
          // 프로필 없으면 로그아웃 처리
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
    const existing = await DB.users.getByUsername(username);
    return !existing;
  }

  /* ── 회원가입 ── */
  async function register(username, displayName, password) {
    username = username.trim().toLowerCase();
    displayName = displayName.trim();

    if (!username)      return { ok: false, err: I18n.t('auth.err.idRequired') };
    if (!/^[a-z0-9_]{4,20}$/.test(username)) return { ok: false, err: I18n.t('auth.err.idFormat') };
    if (!displayName)  return { ok: false, err: I18n.t('auth.err.nameRequired') };
    if (password.length < 8) return { ok: false, err: I18n.t('auth.err.pwShort') };

    // 아이디 중복 확인
    const avail = await checkIdAvailable(username);
    if (!avail) return { ok: false, err: I18n.t('auth.err.idTaken') };

    try {
      // Firebase Auth 계정 생성
      const cred = await fbAuth.createUserWithEmailAndPassword(toEmail(username), password);
      const uid = cred.user.uid;

      // Firestore 프로필 저장
      await DB.users.set(uid, {
        id: uid,
        username,
        displayName,
        createdAt: Date.now(),
      });

      const user = { id: uid, username, displayName };
      _setSession(user);
      return { ok: true, user };
    } catch (e) {
      console.error('[Auth] register error:', e);
      if (e.code === 'auth/email-already-in-use') return { ok: false, err: I18n.t('auth.err.idTaken') };
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
      console.error('[Auth] login error:', e);
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
      // 재인증 필요한 경우
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
