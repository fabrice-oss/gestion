import { store, bpfStats } from '../data.js';
import { formatCurrency } from '../utils.js';

export function render() {
  const year = new Date().getFullYear();
  return `
    <div class="view-header">
      <h2>Bilan Pédagogique et Financier (BPF)</h2>
    </div>
    <div class="bpf-year-selector glass-card">
      <label>Exercice comptable :</label>
      <select id="bpf-year">
        ${[year, year - 1, year - 2].map(y => `<option value="${y}">${y}</option>`)}
      </select>
      <button class="btn-primary" id="btn-calc-bpf">Calculer</button>
    </div>
    <div id="bpf-content">
      ${renderBPF(year)}
    </div>`;
}

function renderBPF(year) {
  const stats = bpfStats(year);
  const s = store.settings;

  return `
    <div class="bpf-sections">

      <!-- Zone A -->
      <div class="bpf-section glass-card">
        <div class="bpf-section-header">
          <span class="bpf-zone">A</span>
          <h3>Identification de l'organisme</h3>
          <span class="badge badge-info">Pré-rempli</span>
        </div>
        <div class="bpf-fields">
          <div class="bpf-field"><label>Numéro de déclaration</label><span>${s.nda}</span></div>
          <div class="bpf-field"><label>Forme juridique</label><span>${s.forme_juridique}</span></div>
          <div class="bpf-field"><label>SIRET</label><span>${s.siret}</span></div>
          <div class="bpf-field"><label>Code NAF</label><span>${s.naf}</span></div>
          <div class="bpf-field"><label>Nom</label><span>${s.dirigeant}</span></div>
          <div class="bpf-field"><label>Adresse</label><span>${s.adresse}, ${s.cp} ${s.ville}</span></div>
          <div class="bpf-field"><label>Téléphone</label><span>${s.tel}</span></div>
          <div class="bpf-field"><label>Email</label><span>${s.email}</span></div>
        </div>
        <p class="bpf-note">⚠️ Vérifiez et complétez ces données dans <strong>Paramètres</strong> avant de soumettre le BPF.</p>
      </div>

      <!-- Zone B -->
      <div class="bpf-section glass-card">
        <div class="bpf-section-header">
          <span class="bpf-zone">B</span>
          <h3>Informations générales</h3>
        </div>
        <div class="bpf-fields">
          <div class="bpf-field"><label>Exercice comptable du</label><span>01/01/${year} au 31/12/${year}</span></div>
          <div class="bpf-field">
            <label>Actions de formation à distance</label>
            <span class="badge badge-${stats.distanciel ? 'success' : 'info'}">${stats.distanciel ? 'OUI' : 'NON'}</span>
          </div>
        </div>
      </div>

      <!-- Zone C -->
      <div class="bpf-section glass-card">
        <div class="bpf-section-header">
          <span class="bpf-zone">C</span>
          <h3>Bilan financier — Origine des produits</h3>
          <span class="badge badge-success">Calculé automatiquement</span>
        </div>
        <table class="bpf-table">
          <tbody>
            <tr class="bpf-row-inactive"><td>1 — Entreprises (formation salariés)</td><td>0,00 €</td></tr>
            <tr class="bpf-row-inactive"><td>a — Contrats d'apprentissage</td><td>0,00 €</td></tr>
            <tr class="bpf-row-inactive"><td>b — Contrats de professionnalisation</td><td>0,00 €</td></tr>
            <tr class="bpf-row-inactive"><td>c — Promotion / reconversion par alternance</td><td>0,00 €</td></tr>
            <tr class="bpf-row-inactive"><td>d — Projets de transition professionnelle</td><td>0,00 €</td></tr>
            <tr class="bpf-row-inactive"><td>e — CPF</td><td>0,00 €</td></tr>
            <tr class="bpf-row-inactive"><td>f — Dispositifs pour personnes en recherche d'emploi</td><td>0,00 €</td></tr>
            <tr class="bpf-row-inactive"><td>g — Travailleurs non-salariés</td><td>0,00 €</td></tr>
            <tr class="bpf-row-inactive"><td>h — Plan de développement des compétences</td><td>0,00 €</td></tr>
            <tr class="bpf-row-inactive"><td><strong>2 — Total organismes gestionnaires (a à h)</strong></td><td><strong>0,00 €</strong></td></tr>
            <tr class="bpf-row-inactive"><td>3 — Pouvoirs publics (agents)</td><td>0,00 €</td></tr>
            <tr class="bpf-row-inactive"><td>4 — Instances européennes</td><td>0,00 €</td></tr>
            <tr class="bpf-row-inactive"><td>5 — État</td><td>0,00 €</td></tr>
            <tr class="bpf-row-inactive"><td>6 — Conseils régionaux</td><td>0,00 €</td></tr>
            <tr class="bpf-row-inactive"><td>7 — France Travail</td><td>0,00 €</td></tr>
            <tr class="bpf-row-inactive"><td>8 — Autres ressources publiques</td><td>0,00 €</td></tr>
            <tr class="bpf-row-inactive"><td>9 — Personnes à titre individuel</td><td>0,00 €</td></tr>
            <tr class="bpf-row-active"><td><strong>10 — Contrats avec d'autres organismes de formation</strong></td><td><strong>${formatCurrency(stats.totalCA)}</strong></td></tr>
            <tr class="bpf-row-inactive"><td>11 — Autres produits</td><td>0,00 €</td></tr>
            <tr class="bpf-row-total"><td><strong>TOTAL DES PRODUITS</strong></td><td><strong>${formatCurrency(stats.totalCA)}</strong></td></tr>
            <tr><td>Part du CA dans la formation professionnelle</td><td><strong>100 %</strong></td></tr>
          </tbody>
        </table>
      </div>

      <!-- Zone E -->
      <div class="bpf-section glass-card">
        <div class="bpf-section-header">
          <span class="bpf-zone">E</span>
          <h3>Personnes dispensant des heures de formation</h3>
          <span class="badge badge-success">Calculé automatiquement</span>
        </div>
        <table class="bpf-table">
          <thead><tr><th></th><th>Nombre</th><th>Heures dispensées</th></tr></thead>
          <tbody>
            <tr class="bpf-row-active">
              <td>Personnes de votre organisme</td>
              <td><strong>1</strong></td>
              <td><strong>${stats.heuresFormateur}</strong></td>
            </tr>
            <tr class="bpf-row-inactive">
              <td>Personnes extérieures (sous-traitance)</td>
              <td>0</td>
              <td>0</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Zone G -->
      <div class="bpf-section glass-card">
        <div class="bpf-section-header">
          <span class="bpf-zone">G</span>
          <h3>Stagiaires dont la formation a été confiée par un autre organisme</h3>
          <span class="badge badge-success">Calculé automatiquement</span>
        </div>
        <table class="bpf-table">
          <thead><tr><th></th><th>Nombre de stagiaires</th><th>Heures totales stagiaires</th></tr></thead>
          <tbody>
            <tr class="bpf-row-active">
              <td>Formations confiées par un autre organisme</td>
              <td><strong>${stats.totalStagiaires}</strong></td>
              <td><strong>${stats.heuresStagiaires}</strong></td>
            </tr>
          </tbody>
        </table>
        <p class="bpf-note">Heures stagiaires = somme de (participants × heures) par session</p>
      </div>

      <!-- Missions détail -->
      <div class="bpf-section glass-card">
        <div class="bpf-section-header">
          <span class="bpf-zone" style="background:#555">📋</span>
          <h3>Détail des missions d'animation — ${year}</h3>
          <span class="badge badge-info">Animation uniquement</span>
        </div>
        <table class="bpf-table">
          <thead><tr><th>Mission</th><th>Organisme</th><th>Participants</th><th>Heures formateur</th><th>Heures stagiaires</th><th>CA HT</th></tr></thead>
          <tbody>
            ${stats.missions.length === 0
              ? '<tr><td colspan="6" class="empty-state">Aucune mission d\'animation pour cet exercice</td></tr>'
              : stats.missions.map(m => {
                  const org = store.organismes.find(o => o.id === m.organisme_id);
                  const facture = store.factures.find(f => f.mission_id === m.id);
                  const hf = m.sessions?.reduce((s, sess) => s + (sess.heures || 0), 0) || 0;
                  return `<tr>
                    <td>${escHtml(m.intitule || '—')}</td>
                    <td>${escHtml(org?.nom || '—')}</td>
                    <td>${m.participants || 0}</td>
                    <td>${hf}h</td>
                    <td>${hf * (m.participants || 0)}h</td>
                    <td>${formatCurrency(facture?.montant_ht || 0)}</td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
        <p class="bpf-note">ℹ️ Seules les missions de type "Animation de formation" sont comptabilisées dans le BPF. Les missions "Conception pédagogique" et les prestations web ne sont pas incluses.</p>
      </div>

    </div>`;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

export function init() {
  document.getElementById('btn-calc-bpf')?.addEventListener('click', () => {
    const year = parseInt(document.getElementById('bpf-year').value);
    document.getElementById('bpf-content').innerHTML = renderBPF(year);
  });
}
