import { CONFIG } from './config.js';

let tokenClient = null;
let accessToken = null;
let tokenExpiry = 0;
let onAuthChange = null;

export function initAuth(callback) {
  onAuthChange = callback;
}

export function setupGoogleAuth() {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(check);
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CONFIG.CLIENT_ID,
          scope: CONFIG.SCOPES,
          callback: handleTokenResponse,
        });
        tryAutoSignIn();
        resolve();
      }
    }, 100);
  });
}

function handleTokenResponse(resp) {
  if (resp.error) {
    console.error('Auth error:', resp.error);
    onAuthChange?.(false);
    return;
  }
  accessToken = resp.access_token;
  tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
  sessionStorage.setItem('gtoken', accessToken);
  sessionStorage.setItem('gtoken_expiry', tokenExpiry);
  onAuthChange?.(true);
}

function tryAutoSignIn() {
  const saved = sessionStorage.getItem('gtoken');
  const expiry = parseInt(sessionStorage.getItem('gtoken_expiry') || '0');
  if (saved && Date.now() < expiry) {
    accessToken = saved;
    tokenExpiry = expiry;
    onAuthChange?.(true);
  } else {
    onAuthChange?.(false);
  }
}

export function signIn() {
  tokenClient?.requestAccessToken({});
}

export function signOut() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken);
  }
  accessToken = null;
  tokenExpiry = 0;
  sessionStorage.removeItem('gtoken');
  sessionStorage.removeItem('gtoken_expiry');
  onAuthChange?.(false);
}

export function getToken() {
  if (!accessToken || Date.now() >= tokenExpiry) {
    tokenClient?.requestAccessToken({ prompt: '' });
    return null;
  }
  return accessToken;
}

export function isAuthenticated() {
  return !!accessToken && Date.now() < tokenExpiry;
}
