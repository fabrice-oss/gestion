import { store, saveSettings, saveDeclarationsUrssaf } from '../data.js';
import { uuid, toast, formatCurrency, isoToday } from '../utils.js';

const BNC_TYPES = ['animation', 'conception'];
const BIC_TYPES = ['creation_site_web', 'application_web', 'gestion_site_web'];

function lastDayOfMonth(year, month) {
  return new Date(year, month + 1, 0).toISOString().split('T')[0];
}

function buildPeriods(year, freq) {
  const periods = [];
  if (freq === 'mensuelle') {
    for (let m = 0; m < 12; m++) {
      const start = `${year}-${String(m + 1).padStart(2, '0')}-01`;
      const end = lastDayOfMonth(year, m);
      const deadlineMonth = (m + 1) % 12;
      const deadlineYear = m === 11 ? year + 1 : year;
      const deadline = lastDayOfMonth(deadlineYear, deadlineMonth);
      periods.push({
        id: `${year}-M${String(m + 1).padStart(2, '0')}`,
        label: new Date(year, m).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        start, end, deadline,
      });
    }
  } else {
    for (let q = 0; q < 4; q++) {
      const startMonth = q * 3;
      const start = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
      const end = lastDayOfMonth(year, startMonth + 2);
      const deadlineMonth = (startMonth + 3) % 12;
      const deadlineYear = q === 3 ? year + 1 : year;
      const deadline = lastDayOfMonth(deadlineYear, deadlineMonth);
      periods.push({
        id: `${year}-T${q + 1}`,
        label: `T${q + 1} ${year}`,
        start, end, deadline,
      });
    }
  }
  return periods;
}

function facturesForPeriod(start, end) {
  return store.factures.filter(f => f.statut === 'payee' && f.date_paiement >= start && f.date_paiement <= end);
}

function splitCAByType(start, end) {
  const factures = facturesForPeriod(start, end);
  let caBNC = 0, caBIC = 0;
  factures.forEach(f => {
    const mission = store.missions.find(m => m.id === f.mission_id);
    const type = mission?.type || '';
    if (BNC_TYPES.includes(type)) caBNC += f.montant_ht || 0;
    else if (BIC_TYPES.includes(type)) caBIC += f.montant_ht || 0;
    else caBNC += f.montant_ht || 0; // default to BNC if unknown
  });
  return { caBNC, caBIC };
}

function daysUntil(isoDate) {
  const diff = new Date(isoDate) - new Date(isoToday());
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function calcCotisations(caBNC, caBIC, settings) {
  const tauxBNC     = settings.urssaf_taux_bnc             || 25.60;
  const tauxBIC     = settings.urssaf_taux_bic_services    || 21.20;
  const tauxVentes  = settings.urssaf_taux_bic_ventes      || 12.30;
  const tauxFormPro = settings.urssaf_taux_formation_pro   || 0.20;

  const cotBIC     = caBIC  * tauxBIC     / 100;
  const cotVentes  = 0;
  const cotBNC     = caBNC  * tauxBNC     / 100;
  const cotFormPro = caBNC  * tauxFormPro / 100;
  const total      = cotBIC + cotVentes + cotBNC + cotFormPro;

  return { tauxBNC, tauxBIC, tauxVentes, tauxFormPro, cotBIC, cotVentes, cotBNC, cotFormPro, total };
}

export function render() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const freq = store.settings.urssaf_frequence || 'mensuelle';

  return `
    <div class="view-header">
      <h2>Déclarations URSSAF</h2>
    </div>

    <!-- Paramètres -->
    <div class="glass-card urssaf-settings-card">
      <h3 style="margin-bottom:16px;font-size:0.95rem;font-weight:600">Paramètres de déclaration</h3>
      <div class="form-grid" style="gap:16px">
        <div class="form-group form-group-half">
          <label>Fréquence de déclaration</label>
          <select id="urssaf-frequence">
            <option value="mensuelle" ${freq === 'mensuelle' ? 'selected' : ''}>Mensuelle</option>
            <option value="trimestrielle" ${freq === 'trimestrielle' ? 'selected' : ''}>Trimestrielle</option>
          </select>
        </div>
        <div class="form-group form-group-half">
          <label>Taux BNC — Formations (animation, conception)</label>
          <input type="number" id="urssaf-taux-bnc" value="${store.settings.urssaf_taux_bnc || 25.60}" min="0" max="50" step="0.01">
        </div>
        <div class="form-group form-group-half">
          <label>Taux BIC services — Web (création, appli, gestion)</label>
          <input type="number" id="urssaf-taux-bic-services" value="${store.settings.urssaf_taux_bic_services || 21.20}" min="0" max="50" step="0.01">
        </div>
        <div class="form-group form-group-half">
          <label>Formation prof. obligatoire (%)</label>
          <input type="number" id="urssaf-taux-formation-pro" value="${store.settings.urssaf_taux_formation_pro || 0.20}" min="0" max="5" step="0.01">
        </div>
        <div class="form-group form-group-half" style="align-self:flex-end">
          <button class="btn-primary" id="btn-save-urssaf-settings">Enregistrer les paramètres</button>
        </div>
      </div>
    </div>

    <!-- Sélecteur d'année -->
    <div class="bpf-year-selector glass-card">
      <label>Exercice :</label>
      <select id="urssaf-year">
        ${[currentYear, currentYear - 1, currentYear - 2].map(y => `<option value="${y}">${y}</option>`)}
      </select>
      <button class="btn-primary" id="btn-calc-urssaf">Afficher</button>
    </div>

    <div id="urssaf-content">
      ${renderDeclarations(currentYear, freq)}
    </div>`;
}

function renderDeclarations(year, freq) {
  const periods = buildPeriods(year, freq);
  const today = isoToday();
  const settings = store.settings;

  const rows = periods.map(period => {
    const { caBNC, caBIC } = splitCAByType(period.start, period.end);
    const cotis = calcCotisations(caBNC, caBIC, settings);
    const factures = facturesForPeriod(period.start, period.end);
    const declaration = store.declarations_urssaf.find(d => d.periode_id === period.id);
    const jours = daysUntil(period.deadline);
    const isUrgent  = !declaration && jours <= 7 && jours >= 0;
    const isOverdue = !declaration && jours < 0;
    const isFuture  = period.start > today;

    // Valeurs affichées (déclarée ou calculée)
    const dispBNC     = declaration?.ca_bnc     ?? caBNC;
    const dispBIC     = declaration?.ca_bic     ?? caBIC;
    const dispCotis   = declaration ? calcCotisations(dispBNC, dispBIC, settings) : cotis;

    let statusBadge = '';
    if (declaration) {
      statusBadge = `<span class="badge badge-success">✓ Déclarée le ${new Date(declaration.date_declaration).toLocaleDateString('fr-FR')}</span>`;
    } else if (isOverdue) {
      statusBadge = `<span class="badge badge-danger">⚠️ En retard (${Math.abs(jours)} j)</span>`;
    } else if (isUrgent) {
      statusBadge = `<span class="badge badge-warning">⏰ ${jours} jour(s) restant(s)</span>`;
    } else if (isFuture) {
      statusBadge = `<span class="badge badge-info">À venir</span>`;
    } else {
      statusBadge = `<span class="badge badge-info">${jours > 0 ? `${jours} jours` : "Échéance aujourd'hui"}</span>`;
    }

    const facturesDetail = factures.length > 0 ? `
      <div class="urssaf-factures-detail">
        <div class="urssaf-factures-title">Factures encaissées :</div>
        ${factures.map(f => {
          const mission = store.missions.find(m => m.id === f.mission_id);
          const cat = BNC_TYPES.includes(mission?.type) ? 'BNC' : BIC_TYPES.includes(mission?.type) ? 'BIC' : 'BNC';
          return `<div class="urssaf-facture-line">
            <span>${f.numero}</span>
            <span style="color:var(--text-muted);font-size:0.75rem">${mission?.intitule || '—'}</span>
            <span class="urssaf-cat-badge urssaf-cat-${cat.toLowerCase()}">${cat}</span>
            <span>${formatCurrency(f.montant_ht)}</span>
          </div>`;
        }).join('')}
      </div>` : '';

    const declareZone = !isFuture ? `
      <div class="urssaf-declare-form" id="declare-zone-${period.id}">
        <!-- Saisie CA -->
        <div class="urssaf-ca-inputs">
          <div class="form-group" style="margin:0;flex:1;min-width:160px">
            <label style="font-size:0.78rem">
              CA BNC — Formations (€)
              <span class="urssaf-auto-badge">● auto</span>
            </label>
            <input type="number"
              class="urssaf-ca-input"
              id="ca-bnc-${period.id}"
              data-type="bnc"
              data-period-id="${period.id}"
              value="${dispBNC.toFixed(2)}"
              min="0" step="0.01"
              ${declaration ? 'disabled' : ''}>
          </div>
          <div class="form-group" style="margin:0;flex:1;min-width:160px">
            <label style="font-size:0.78rem">
              CA BIC — Services web (€)
              <span class="urssaf-auto-badge">● auto</span>
            </label>
            <input type="number"
              class="urssaf-ca-input"
              id="ca-bic-${period.id}"
              data-type="bic"
              data-period-id="${period.id}"
              value="${dispBIC.toFixed(2)}"
              min="0" step="0.01"
              ${declaration ? 'disabled' : ''}>
          </div>
        </div>

        <!-- Tableau des 4 lignes URSSAF -->
        <div class="urssaf-cotis-table" id="cotis-table-${period.id}">
          ${renderCotisTable(dispCotis, period.id)}
        </div>

        ${facturesDetail}

        <div class="urssaf-declare-actions">
          ${declaration ? `
            <button class="btn-secondary btn-sm btn-edit-declare"
              data-id="${declaration.id}"
              data-period='${JSON.stringify(period)}'>
              ✏️ Modifier
            </button>
            <button class="btn-secondary btn-sm btn-undo-declare"
              data-id="${declaration.id}">
              Annuler la déclaration
            </button>
          ` : `
            <button class="btn-primary btn-sm btn-declare"
              data-period='${JSON.stringify(period)}'>
              Enregistrer la déclaration
            </button>
          `}
        </div>
      </div>` : `<div style="color:var(--text-muted);font-size:0.82rem;padding:8px 0">Période à venir — aucune déclaration à faire pour l'instant.</div>`;

    return `
      <div class="urssaf-period-card glass-card ${isUrgent ? 'urssaf-urgent' : ''} ${isOverdue ? 'urssaf-overdue' : ''} ${declaration ? 'urssaf-done' : ''}">
        <div class="urssaf-period-header">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span class="urssaf-period-label">${period.label}</span>
            ${statusBadge}
          </div>
          <div class="urssaf-period-deadline">
            Échéance : ${new Date(period.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        ${declareZone}
      </div>`;
  }).join('');

  // Totaux annuels
  let totalBNC = 0, totalBIC = 0;
  periods.forEach(p => {
    const s = splitCAByType(p.start, p.end);
    totalBNC += s.caBNC;
    totalBIC += s.caBIC;
  });
  const totalCotis = calcCotisations(totalBNC, totalBIC, settings);
  const nbDeclare = store.declarations_urssaf.filter(d => d.periode_id.startsWith(String(year))).length;

  return `
    <div class="urssaf-periods">${rows}</div>

    <div class="urssaf-total glass-card">
      <h4 style="margin-bottom:12px;font-size:0.9rem;font-weight:600;opacity:0.7">Récapitulatif ${year}</h4>
      <div class="urssaf-total-row">
        <span>CA BNC (formations)</span>
        <strong>${formatCurrency(totalBNC)}</strong>
      </div>
      <div class="urssaf-total-row">
        <span>CA BIC (services web)</span>
        <strong>${formatCurrency(totalBIC)}</strong>
      </div>
      <div class="urssaf-total-row" style="border-top:1px solid var(--border-color);margin-top:8px;padding-top:8px">
        <span>Cotisations BIC services (${totalCotis.tauxBIC}%)</span>
        <strong class="text-orange">${formatCurrency(totalCotis.cotBIC)}</strong>
      </div>
      <div class="urssaf-total-row">
        <span>Cotisations BNC (${totalCotis.tauxBNC}%)</span>
        <strong class="text-orange">${formatCurrency(totalCotis.cotBNC)}</strong>
      </div>
      <div class="urssaf-total-row">
        <span>Formation prof. obligatoire (${totalCotis.tauxFormPro}%)</span>
        <strong class="text-orange">${formatCurrency(totalCotis.cotFormPro)}</strong>
      </div>
      <div class="urssaf-total-row" style="border-top:1px solid var(--border-color);margin-top:8px;padding-top:8px;font-size:1rem">
        <span><strong>TOTAL COTISATIONS</strong></span>
        <strong class="text-orange" style="font-size:1.1rem">${formatCurrency(totalCotis.total)}</strong>
      </div>
      <div class="urssaf-total-row" style="margin-top:8px">
        <span>Périodes déclarées / Total</span>
        <strong>${nbDeclare} / ${periods.length}</strong>
      </div>
    </div>`;
}

function renderCotisTable(cotis, periodId) {
  return `
    <table class="urssaf-lines-table">
      <thead>
        <tr>
          <th>Nature des revenus</th>
          <th>Taux</th>
          <th>Cotisations</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Prestations de services (BIC)</td>
          <td>${cotis.tauxBIC}%</td>
          <td id="cotis-bic-${periodId}">${formatCurrency(cotis.cotBIC)}</td>
        </tr>
        <tr class="urssaf-line-muted">
          <td>Vente de marchandises (BIC)</td>
          <td>${cotis.tauxVentes}%</td>
          <td>—</td>
        </tr>
        <tr>
          <td>Prestations de services (BNC)</td>
          <td>${cotis.tauxBNC}%</td>
          <td id="cotis-bnc-${periodId}">${formatCurrency(cotis.cotBNC)}</td>
        </tr>
        <tr>
          <td>Formation professionnelle obligatoire</td>
          <td>${cotis.tauxFormPro}%</td>
          <td id="cotis-fpo-${periodId}">${formatCurrency(cotis.cotFormPro)}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2"><strong>TOTAL</strong></td>
          <td id="cotis-total-${periodId}"><strong>${formatCurrency(cotis.total)}</strong></td>
        </tr>
      </tfoot>
    </table>`;
}

export function init() {
  document.getElementById('btn-save-urssaf-settings')?.addEventListener('click', async () => {
    store.settings.urssaf_frequence        = document.getElementById('urssaf-frequence').value;
    store.settings.urssaf_taux_bnc         = parseFloat(document.getElementById('urssaf-taux-bnc').value) || 25.60;
    store.settings.urssaf_taux_bic_services= parseFloat(document.getElementById('urssaf-taux-bic-services').value) || 21.20;
    store.settings.urssaf_taux_formation_pro= parseFloat(document.getElementById('urssaf-taux-formation-pro').value) || 0.20;
    store.settings.urssaf_taux = store.settings.urssaf_taux_bnc; // compat
    await saveSettings();
    toast('Paramètres URSSAF enregistrés ✓');
    refreshContent();
  });

  document.getElementById('btn-calc-urssaf')?.addEventListener('click', refreshContent);

  attachDeclareEvents();
}

function refreshContent() {
  const year = parseInt(document.getElementById('urssaf-year').value);
  const freq = store.settings.urssaf_frequence || 'mensuelle';
  document.getElementById('urssaf-content').innerHTML = renderDeclarations(year, freq);
  attachDeclareEvents();
}

function updateCotisDisplay(periodId) {
  const caBNC = parseFloat(document.getElementById(`ca-bnc-${periodId}`)?.value) || 0;
  const caBIC = parseFloat(document.getElementById(`ca-bic-${periodId}`)?.value) || 0;
  const cotis = calcCotisations(caBNC, caBIC, store.settings);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set(`cotis-bic-${periodId}`,   formatCurrency(cotis.cotBIC));
  set(`cotis-bnc-${periodId}`,   formatCurrency(cotis.cotBNC));
  set(`cotis-fpo-${periodId}`,   formatCurrency(cotis.cotFormPro));
  set(`cotis-total-${periodId}`, formatCurrency(cotis.total));
}

function attachDeclareEvents() {
  document.querySelectorAll('.urssaf-ca-input').forEach(input => {
    input.addEventListener('input', () => updateCotisDisplay(input.dataset.periodId));
  });

  document.querySelectorAll('.btn-declare').forEach(btn => {
    btn.addEventListener('click', async () => {
      const period = JSON.parse(btn.dataset.period);
      const caBNC = parseFloat(document.getElementById(`ca-bnc-${period.id}`)?.value) || 0;
      const caBIC = parseFloat(document.getElementById(`ca-bic-${period.id}`)?.value) || 0;
      const cotis = calcCotisations(caBNC, caBIC, store.settings);

      store.declarations_urssaf.push({
        id: uuid(),
        periode_id: period.id,
        periode_label: period.label,
        ca_bnc: caBNC,
        ca_bic: caBIC,
        ca_declare: caBNC + caBIC,
        cotisations: cotis.total,
        cotisations_detail: { cotBIC: cotis.cotBIC, cotBNC: cotis.cotBNC, cotFormPro: cotis.cotFormPro },
        date_declaration: isoToday(),
        created_at: new Date().toISOString(),
      });
      await saveDeclarationsUrssaf();
      toast(`Déclaration ${period.label} enregistrée ✓`);
      refreshContent();
    });
  });

  document.querySelectorAll('.btn-edit-declare').forEach(btn => {
    btn.addEventListener('click', () => {
      const period = JSON.parse(btn.dataset.period);
      const declarationId = btn.dataset.id;

      document.getElementById(`ca-bnc-${period.id}`).disabled = false;
      document.getElementById(`ca-bic-${period.id}`).disabled = false;

      const actions = btn.closest('.urssaf-declare-actions');
      if (actions) {
        actions.innerHTML = `
          <button class="btn-primary btn-sm btn-save-edit"
            data-id="${declarationId}"
            data-period='${JSON.stringify(period)}'>
            Enregistrer la déclaration
          </button>
          <button class="btn-secondary btn-sm btn-cancel-edit">Annuler</button>`;
        attachEditSaveEvents();
      }
    });
  });

  document.querySelectorAll('.btn-undo-declare').forEach(btn => {
    btn.addEventListener('click', async () => {
      store.declarations_urssaf = store.declarations_urssaf.filter(d => d.id !== btn.dataset.id);
      await saveDeclarationsUrssaf();
      toast('Déclaration annulée');
      refreshContent();
    });
  });
}

function attachEditSaveEvents() {
  document.querySelectorAll('.btn-save-edit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const period = JSON.parse(btn.dataset.period);
      const declarationId = btn.dataset.id;
      const caBNC = parseFloat(document.getElementById(`ca-bnc-${period.id}`)?.value) || 0;
      const caBIC = parseFloat(document.getElementById(`ca-bic-${period.id}`)?.value) || 0;
      const cotis = calcCotisations(caBNC, caBIC, store.settings);

      const idx = store.declarations_urssaf.findIndex(d => d.id === declarationId);
      if (idx !== -1) {
        store.declarations_urssaf[idx] = {
          ...store.declarations_urssaf[idx],
          ca_bnc: caBNC,
          ca_bic: caBIC,
          ca_declare: caBNC + caBIC,
          cotisations: cotis.total,
          cotisations_detail: { cotBIC: cotis.cotBIC, cotBNC: cotis.cotBNC, cotFormPro: cotis.cotFormPro },
          date_declaration: isoToday(),
        };
      }
      await saveDeclarationsUrssaf();
      toast(`Déclaration ${period.label} mise à jour ✓`);
      refreshContent();
    });
  });

  document.querySelectorAll('.btn-cancel-edit').forEach(btn => {
    btn.addEventListener('click', () => refreshContent());
  });
}
