import { CONFIG } from './config.js';

let tokenClient = null;
let accessToken = null;
let tokenExpiry = 0;
let onAuthChange = null;

// iPadOS 13+ envoie un UA "Macintosh" — on détecte via maxTouchPoints
function isSafariIOS() {
  const ua = navigator.userAgent;
  const isAppleSafari = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Firefox/.test(ua);
  const isIPhoneOrIPod = /iP(hone|od)/.test(ua);
  const isIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return isAppleSafari && (isIPhoneOrIPod || isIPad);
}

export function initAuth(callback) {
  onAuthChange = callback;
}

// ─── Redirect flow (Safari iOS / iPadOS) ─────────────────────────────────────
// Safari bloque les popups OAuth. On utilise le flux redirect natif.
// PRÉREQUIS Google Cloud Console → URI de redirection autorisés :
//   https://avrila.fr/nabhoo/

function signInWithRedirect() {
  const redirectUri = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({
    client_id: CONFIG.CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: CONFIG.SCOPES,
    prompt: 'select_account',
    include_granted_scopes: 'true',
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function consumeRedirectToken() {
  if (!window.location.hash) return false;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') || '0');
  if (!token || !expiresIn) return false;
  history.replaceState(null, '', window.location.pathname + window.location.search);
  accessToken = token;
  tokenExpiry = Date.now() + (expiresIn - 60) * 1000;
  localStorage.setItem('gtoken', accessToken);
  localStorage.setItem('gtoken_expiry', String(tokenExpiry));
  return true;
}

// ─── Setup ───────────────────────────────────────────────────────────────────
export function setupGoogleAuth() {
  return new Promise((resolve) => {
    if (isSafariIOS()) {
      // Safari : pas de popup GIS, redirect OAuth uniquement
      if (consumeRedirectToken()) {
        onAuthChange?.(true);
      } else {
        tryAutoSignIn();
      }
      resolve();
      return;
    }

    // Autres navigateurs : popup GIS (pas de One Tap — bouton seul)
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

// BFCache iOS : page restaurée depuis le cache navigateur
window.addEventListener('pageshow', (event) => {
  if (event.persisted && onAuthChange) tryAutoSignIn();
});

// ─── Token handler ────────────────────────────────────────────────────────────
function handleTokenResponse(resp) {
  if (resp.error) {
    if (resp.error === 'interaction_required' || resp.error === 'consent_required') {
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

// ─── Cache localStorage ───────────────────────────────────────────────────────
function tryAutoSignIn() {
  const saved  = localStorage.getItem('gtoken');
  const expiry = parseInt(localStorage.getItem('gtoken_expiry') || '0');
  if (saved && Date.now() < expiry) {
    accessToken = saved;
    tokenExpiry = expiry;
    onAuthChange?.(true);
    return;
  }
  onAuthChange?.(false);
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function signIn() {
  if (isSafariIOS()) {
    signInWithRedirect();
    return;
  }
  // Popup directe — pas de One Tap (inutile quand on a un bouton dédié)
  tokenClient.requestAccessToken({ prompt: 'select_account' });
}

export function signOut() {
  try { if (accessToken && !isSafariIOS()) google.accounts.oauth2.revoke(accessToken); } catch (_) {}
  accessToken = null;
  tokenExpiry = 0;
  localStorage.removeItem('gtoken');
  localStorage.removeItem('gtoken_expiry');
  onAuthChange?.(false);
}

export function getToken() {
  if (!accessToken || Date.now() >= tokenExpiry) return null;
  return accessToken;
}

export function isAuthenticated() {
  return !!accessToken && Date.now() < tokenExpiry;
}
