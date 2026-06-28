// Shared client-side auth helper for token-based auth (Firebase ID token, no server session).
// Loaded as a plain <script> (non-module) so admin/customer pages can use it without import wiring.
(function () {
  var TOKEN_KEY = 'kj_token';
  var USER_KEY = 'kj_user';

  function getStoredToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function setStoredToken(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearStoredToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // Wrapper around fetch() that injects the stored Firebase ID token as a Bearer header.
  // On 401, clears the token and redirects to the appropriate login page.
  function authFetch(url, options) {
    options = options || {};
    var token = getStoredToken();
    var headers = Object.assign({}, options.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;

    return fetch(url, Object.assign({}, options, { headers: headers })).then(function (res) {
      if (res.status === 401) {
        clearStoredToken();
        var loginPath = location.pathname.startsWith('/admin') ? '/admin/login' : '/profile';
        location.href = loginPath;
      }
      return res;
    });
  }

  // Keeps the stored token in sync with Firebase's background auto-refresh (Firebase ID tokens
  // expire after ~1 hour) so a long-lived browser tab doesn't suddenly start getting 401s.
  function watchTokenRefresh(fbAuth, onIdTokenChanged) {
    onIdTokenChanged(fbAuth, function (user) {
      if (!user) return;
      user.getIdToken().then(function (token) {
        var stored = getStoredUser();
        setStoredToken(token, stored);
      });
    });
  }

  function logout(redirectTo) {
    clearStoredToken();
    location.href = redirectTo || '/';
  }

  window.KJAuth = {
    getStoredToken: getStoredToken,
    getStoredUser: getStoredUser,
    setStoredToken: setStoredToken,
    clearStoredToken: clearStoredToken,
    authFetch: authFetch,
    watchTokenRefresh: watchTokenRefresh,
    logout: logout,
  };
})();
