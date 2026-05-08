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
// Safari bloque les popups OAuth même avec geste utilisateur.
// On utilise le flux redirect natif OAuth 2.0 implicit grant.
// PRÉREQUIS : ajouter l'URI de l'app dans Google Cloud Console >
//   APIs & Services > Identifiants > OAuth 2.0 > URI de redirection autorisés
//   → https://avrila.fr/gestion/

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

// Après le redirect, Google ajoute le token dans le fragment d'URL (#access_token=...)
function consumeRedirectToken() {
  if (!window.location.hash) return false;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') || '0');
  if (!token || !expiresIn) return false;

  // Nettoyer le fragment pour éviter de le rejouer
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
      // Pas de GIS pour Safari iOS — redirect OAuth natif uniquement
      if (consumeRedirectToken()) {
        onAuthChange?.(true);
      } else {
        tryAutoSignIn();
      }
      resolve();
      return;
    }

    // Flux popup GIS pour Chrome, Firefox, desktop Safari, etc.
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

// iOS BFCache : page restaurée après retour depuis un autre onglet
window.addEventListener('pageshow', (event) => {
  if (event.persisted && onAuthChange) tryAutoSignIn();
});

// ─── Handlers GIS (non-Safari uniquement) ────────────────────────────────────

function handleCredentialResponse() {
  tokenClient.requestAccessToken({ prompt: '' });
}

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

// ─── Cache token ──────────────────────────────────────────────────────────────

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

  if (!isSafariIOS()) {
    google.accounts.id.prompt(() => {});
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function signIn() {
  if (isSafariIOS()) {
    signInWithRedirect();
    return;
  }

  google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    }
  });
}

export function signOut() {
  try { if (accessToken && !isSafariIOS()) google.accounts.oauth2.revoke(accessToken); } catch (_) {}
  try { if (!isSafariIOS()) google.accounts.id.disableAutoSelect(); } catch (_) {}
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
