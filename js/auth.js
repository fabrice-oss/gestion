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
      if (window.google?.accounts?.id && window.google?.accounts?.oauth2) {
        clearInterval(check);

        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CONFIG.CLIENT_ID,
          scope: CONFIG.SCOPES,
          callback: handleTokenResponse,
        });

        google.accounts.id.initialize({
          client_id: CONFIG.CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: true,
          cancel_on_tap_outside: false,
          use_fedcm_for_prompt: false,
        });

        tryAutoSignIn();
        resolve();
      }
    }, 100);
  });
}

function handleCredentialResponse() {
  // Après identification One Tap, on récupère le token API silencieusement
  tokenClient.requestAccessToken({ prompt: '' });
}

function handleTokenResponse(resp) {
  if (resp.error) {
    if (resp.error === 'interaction_required' || resp.error === 'consent_required' || resp.error === 'access_denied') {
      // Fallback : demande explicite si le silent token a échoué (fréquent sur mobile)
      tokenClient.requestAccessToken({ prompt: 'select_account' });
      return;
    }
    onAuthChange?.(false);
    return;
  }
  accessToken = resp.access_token;
  tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
  localStorage.setItem('gtoken', accessToken);
  localStorage.setItem('gtoken_expiry', String(tokenExpiry));
  onAuthChange?.(true);
}

function tryAutoSignIn() {
  const saved = localStorage.getItem('gtoken');
  const expiry = parseInt(localStorage.getItem('gtoken_expiry') || '0');
  if (saved && Date.now() < expiry) {
    accessToken = saved;
    tokenExpiry = expiry;
    onAuthChange?.(true);
  } else {
    onAuthChange?.(false);
    // Tente One Tap automatique au chargement
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // One Tap non disponible, l'utilisateur devra cliquer
      }
    });
  }
}

export function signIn() {
  // Affiche l'overlay One Tap (sur la page, sans nouvel onglet)
  google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      // Fallback si One Tap bloqué (ex: paramètre navigateur)
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    }
  });
}

export function signOut() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken);
  }
  google.accounts.id.disableAutoSelect();
  accessToken = null;
  tokenExpiry = 0;
  localStorage.removeItem('gtoken');
  localStorage.removeItem('gtoken_expiry');
  onAuthChange?.(false);
}

export function getToken() {
  if (!accessToken || Date.now() >= tokenExpiry) {
    tokenClient.requestAccessToken({ prompt: '' });
    return null;
  }
  return accessToken;
}

export function isAuthenticated() {
  return !!accessToken && Date.now() < tokenExpiry;
}
