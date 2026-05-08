import { initAuth, setupGoogleAuth, signIn, signOut, isAuthenticated } from './auth.js';
import { initData } from './data.js';

const views = {
  dashboard:  () => import('./views/dashboard.js'),
  missions:   () => import('./views/missions.js'),
  organismes: () => import('./views/organismes.js'),
  entreprises: () => import('./views/entreprises.js'),
  factures:   () => import('./views/factures.js'),
  bpf:        () => import('./views/bpf.js'),
  urssaf:     () => import('./views/urssaf.js'),
  parametres: () => import('./views/parametres.js'),
};

const sectionTitles = {
  dashboard:  'Tableau de bord',
  missions:   'Missions',
  organismes: 'Organismes de formation',
  entreprises: 'Entreprises formées',
  factures:   'Factures',
  bpf:        'Bilan Pédagogique et Financier',
  urssaf:     'Déclarations URSSAF',
  parametres: 'Paramètres',
};

let currentSection = 'dashboard';
let navParams = {};

export async function navigate(section, params = {}) {
  if (!views[section]) return;
  currentSection = section;
  navParams = params;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  document.getElementById('section-title').textContent = sectionTitles[section] || section;

  const content = document.getElementById('content-area');
  content.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const mod = await views[section]();
    content.innerHTML = mod.render(params);
    mod.init?.(params);
  } catch (e) {
    content.innerHTML = `<div class="error-state">Erreur de chargement : ${e.message}</div>`;
    console.error(e);
  }
}

export function showModal(title, body, extraClass = '') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  const modal = document.getElementById('modal');
  modal.className = `modal glass-card ${extraClass}`;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

async function onAuthChange(authenticated) {
  if (authenticated) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('loading-overlay').classList.remove('hidden');
    try {
      await initData();
      document.getElementById('loading-overlay').classList.add('hidden');
      navigate('dashboard');
    } catch (e) {
      document.getElementById('loading-overlay').classList.add('hidden');
      console.error('Init error:', e);
    }
  } else {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  }
}

function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.body.dataset.theme = saved;
  updateThemeIcon(saved);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.title = theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre';
  btn.innerHTML = theme === 'dark'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`;
}

function closeSidebar() {
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
}

function initNavigation() {
  // Hamburger
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('active', isOpen);
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      closeSidebar();
      navigate(item.dataset.section);
    });
  });

  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.getElementById('modal-close')?.addEventListener('click', closeModal);

  document.getElementById('signout-btn')?.addEventListener('click', () => {
    signOut();
  });

  document.getElementById('google-signin-btn')?.addEventListener('click', () => {
    signIn();
  });

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const current = document.body.dataset.theme || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = next;
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
  });
}

async function main() {
  initTheme();
  initNavigation();
  initAuth(onAuthChange);
  await setupGoogleAuth();
}

main();
