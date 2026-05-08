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

        // One Tap est bloqué par l'ITP de Safari iOS — on l'initialise uniquement
        // sur les navigateurs qui le supportent réellement
        if (!isSafariIOS()) {
          google.accounts.id.initialize({
            client_id: CONFIG.CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: true,
            cancel_on_tap_outside: false,
            use_fedcm_for_prompt: false,
          });
        }

        tryAutoSignIn();
        resolve();
      }
    }, 100);
  });
}

// iOS BFCache : quand la page est restaurée après un retour depuis l'onglet OAuth
window.addEventListener('pageshow', (event) => {
  if (event.persisted && onAuthChange) {
    tryAutoSignIn();
  }
});

function handleCredentialResponse() {
  // One Tap a réussi → récupération silencieuse du token API (non-Safari uniquement)
  tokenClient.requestAccessToken({ prompt: '' });
}

function handleTokenResponse(resp) {
  if (resp.error) {
    // Ces deux erreurs indiquent qu'une interaction utilisateur est nécessaire
    // (ex : session Google expirée, consentement pas encore donné)
    if (resp.error === 'interaction_required' || resp.error === 'consent_required') {
      tokenClient.requestAccessToken({ prompt: 'select_account' });
      return;
    }
    // Pour toute autre erreur (access_denied, popup_closed, etc.) :
    // on revient proprement à l'écran de connexion sans boucler
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
  const saved  = localStorage.getItem('gtoken');
  const expiry = parseInt(localStorage.getItem('gtoken_expiry') || '0');

  if (saved && Date.now() < expiry) {
    // Token valide en cache → connexion immédiate sans rien demander
    accessToken  = saved;
    tokenExpiry  = expiry;
    onAuthChange?.(true);
    return;
  }

  // Pas de token valide → écran de connexion
  onAuthChange?.(false);

  // One Tap automatique uniquement hors Safari iOS
  if (!isSafariIOS()) {
    google.accounts.id.prompt(() => {
      // Silencieux : si One Tap n'est pas disponible, l'utilisateur clique
    });
  }
}

export function signIn() {
  if (isSafariIOS()) {
    // CRITIQUE : sur Safari iOS, requestAccessToken doit être appelé
    // directement depuis le handler du clic (contexte de geste utilisateur).
    // Si on passe par google.accounts.id.prompt() d'abord (async), Safari
    // considère que le geste est perdu et bloque la popup silencieusement.
    tokenClient.requestAccessToken({ prompt: 'select_account' });
    return;
  }

  // Autres navigateurs : One Tap en premier, popup en fallback
  google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    }
  });
}

export function signOut() {
  try { if (accessToken) google.accounts.oauth2.revoke(accessToken); } catch (_) {}
  try { if (!isSafariIOS()) google.accounts.id.disableAutoSelect(); } catch (_) {}
  accessToken  = null;
  tokenExpiry  = 0;
  localStorage.removeItem('gtoken');
  localStorage.removeItem('gtoken_expiry');
  onAuthChange?.(false);
}

export function getToken() {
  if (!accessToken || Date.now() >= tokenExpiry) {
    // Ne pas tenter un refresh silencieux ici : sur Safari iOS cela déclenche
    // une popup hors-contexte qui échoue et crée une boucle d'authentification.
    // Si le token est expiré pendant l'utilisation, les appels API échoueront
    // et l'utilisateur verra une erreur → pourra se reconnecter.
    return null;
  }
  return accessToken;
}

export function isAuthenticated() {
  return !!accessToken && Date.now() < tokenExpiry;
}
