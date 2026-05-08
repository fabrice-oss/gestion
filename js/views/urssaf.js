import { store, saveSettings, saveDeclarationsUrssaf } from '../data.js';
import { uuid, toast, formatCurrency, isoToday } from '../utils.js';

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

function caForPeriod(start, end) {
  return store.factures
    .filter(f => f.statut === 'payee' && f.date_paiement >= start && f.date_paiement <= end)
    .reduce((s, f) => s + (f.montant_ht || 0), 0);
}

function facturesForPeriod(start, end) {
  return store.factures.filter(f => f.statut === 'payee' && f.date_paiement >= start && f.date_paiement <= end);
}

function daysUntil(isoDate) {
  const diff = new Date(isoDate) - new Date(isoToday());
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function render() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const freq = store.settings.urssaf_frequence || 'mensuelle';
  const taux = store.settings.urssaf_taux || 25.6;

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
          <label>Taux de cotisations (%)</label>
          <input type="number" id="urssaf-taux" value="${taux}" min="0" max="50" step="0.1">
          <small style="color:var(--text-muted)">Taux auto-entrepreneur 2026 — modifiable si besoin</small>
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
      ${renderDeclarations(currentYear, freq, taux)}
    </div>`;
}

function renderDeclarations(year, freq, taux) {
  const periods = buildPeriods(year, freq);
  const today = isoToday();

  const rows = periods.map(period => {
    const ca = caForPeriod(period.start, period.end);
    const cotisations = ca * taux / 100;
    const factures = facturesForPeriod(period.start, period.end);
    const declaration = store.declarations_urssaf.find(d => d.periode_id === period.id);
    const jours = daysUntil(period.deadline);
    const isUrgent   = !declaration && jours <= 7 && jours >= 0;
    const isOverdue  = !declaration && jours < 0;
    const isFuture   = period.start > today;
    const isEditing  = false; // géré côté DOM

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
      statusBadge = `<span class="badge badge-info">${jours > 0 ? `${jours} jours` : 'Échéance aujourd\'hui'}</span>`;
    }

    // Détail des factures payées sur la période
    const facturesDetail = factures.length > 0 ? `
      <div class="urssaf-factures-detail">
        <div class="urssaf-factures-title">Factures encaissées :</div>
        ${factures.map(f => {
          const mission = store.missions.find(m => m.id === f.mission_id);
          return `<div class="urssaf-facture-line">
            <span>${f.numero}</span>
            <span style="color:var(--text-muted);font-size:0.75rem">${mission?.intitule || '—'}</span>
            <span>${formatCurrency(f.montant_ht)}</span>
          </div>`;
        }).join('')}
      </div>` : '';

    // Zone de saisie / déclaration
    const caDeclaree = declaration?.ca_declare ?? ca;
    const cotisDeclaree = declaration?.cotisations ?? cotisations;

    const declareZone = !isFuture ? `
      <div class="urssaf-declare-form" id="declare-zone-${period.id}">
        <div class="urssaf-declare-row">
          <div class="form-group" style="margin:0;flex:1;min-width:180px">
            <label style="font-size:0.78rem">
              CA à déclarer (€)
              <span class="urssaf-auto-badge">● calculé automatiquement</span>
            </label>
            <input type="number"
              class="urssaf-ca-input"
              id="ca-input-${period.id}"
              value="${caDeclaree.toFixed(2)}"
              min="0" step="0.01"
              data-taux="${taux}"
              data-period-id="${period.id}"
              ${declaration ? 'disabled' : ''}>
          </div>
          <div class="urssaf-cotis-preview" id="cotis-preview-${period.id}">
            <span class="urssaf-cotis-label">Cotisations (${taux}%)</span>
            <span class="urssaf-cotis-value" id="cotis-value-${period.id}">${formatCurrency(declaration ? cotisDeclaree : cotisations)}</span>
          </div>
          <div class="urssaf-declare-actions">
            ${declaration ? `
              <button class="btn-secondary btn-sm btn-edit-declare"
                data-id="${declaration.id}"
                data-period='${JSON.stringify(period)}'
                data-taux="${taux}">
                ✏️ Modifier
              </button>
              <button class="btn-secondary btn-sm btn-undo-declare"
                data-id="${declaration.id}">
                Annuler
              </button>
            ` : `
              <button class="btn-primary btn-sm btn-declare"
                data-period='${JSON.stringify(period)}'
                data-taux="${taux}">
                Enregistrer la déclaration
              </button>
            `}
          </div>
        </div>
        ${facturesDetail}
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

        <div class="urssaf-period-amounts">
          <div class="urssaf-amount-block">
            <span class="urssaf-amount-label">CA encaissé (factures payées)</span>
            <span class="urssaf-amount-value ${ca === 0 ? 'text-muted' : ''}">${formatCurrency(ca)}</span>
          </div>
          <div class="urssaf-amount-block">
            <span class="urssaf-amount-label">Cotisations calculées (${taux}%)</span>
            <span class="urssaf-amount-value ${ca === 0 ? 'text-muted' : 'text-orange'}">${formatCurrency(cotisations)}</span>
          </div>
          ${declaration ? `
          <div class="urssaf-amount-block">
            <span class="urssaf-amount-label">CA déclaré</span>
            <span class="urssaf-amount-value">${formatCurrency(declaration.ca_declare)}</span>
          </div>
          <div class="urssaf-amount-block">
            <span class="urssaf-amount-label">Cotisations déclarées</span>
            <span class="urssaf-amount-value text-orange">${formatCurrency(declaration.cotisations)}</span>
          </div>` : ''}
        </div>

        ${declareZone}
      </div>`;
  }).join('');

  const totalCA = periods.reduce((s, p) => s + caForPeriod(p.start, p.end), 0);
  const totalCotis = totalCA * taux / 100;
  const nbDeclare = store.declarations_urssaf.filter(d => d.periode_id.startsWith(String(year))).length;

  return `
    <div class="urssaf-periods">${rows}</div>

    <div class="urssaf-total glass-card">
      <div class="urssaf-total-row">
        <span>CA total encaissé ${year}</span>
        <strong>${formatCurrency(totalCA)}</strong>
      </div>
      <div class="urssaf-total-row">
        <span>Total cotisations à prévoir (${taux}%)</span>
        <strong class="text-orange">${formatCurrency(totalCotis)}</strong>
      </div>
      <div class="urssaf-total-row">
        <span>Périodes déclarées / Total</span>
        <strong>${nbDeclare} / ${periods.length}</strong>
      </div>
    </div>`;
}

export function init() {
  document.getElementById('btn-save-urssaf-settings')?.addEventListener('click', async () => {
    store.settings.urssaf_frequence = document.getElementById('urssaf-frequence').value;
    store.settings.urssaf_taux = parseFloat(document.getElementById('urssaf-taux').value) || 25.6;
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
  const taux = store.settings.urssaf_taux || 25.6;
  document.getElementById('urssaf-content').innerHTML = renderDeclarations(year, freq, taux);
  attachDeclareEvents();
}

function attachDeclareEvents() {
  // Mise à jour en temps réel des cotisations à la saisie du CA
  document.querySelectorAll('.urssaf-ca-input').forEach(input => {
    input.addEventListener('input', () => {
      const taux = parseFloat(input.dataset.taux) || 25.6;
      const ca = parseFloat(input.value) || 0;
      const cotis = ca * taux / 100;
      const preview = document.getElementById(`cotis-value-${input.dataset.periodId}`);
      if (preview) preview.textContent = formatCurrency(cotis);
    });
  });

  // Enregistrer
  document.querySelectorAll('.btn-declare').forEach(btn => {
    btn.addEventListener('click', async () => {
      const period = JSON.parse(btn.dataset.period);
      const taux = parseFloat(btn.dataset.taux) || 25.6;
      const caInput = document.getElementById(`ca-input-${period.id}`);
      const ca = parseFloat(caInput?.value) || 0;

      store.declarations_urssaf.push({
        id: uuid(),
        periode_id: period.id,
        periode_label: period.label,
        ca_declare: ca,
        cotisations: ca * taux / 100,
        date_declaration: isoToday(),
        created_at: new Date().toISOString(),
      });
      await saveDeclarationsUrssaf();
      toast(`Déclaration ${period.label} enregistrée ✓`);
      refreshContent();
    });
  });

  // Modifier une déclaration existante
  document.querySelectorAll('.btn-edit-declare').forEach(btn => {
    btn.addEventListener('click', () => {
      const period = JSON.parse(btn.dataset.period);
      const taux = parseFloat(btn.dataset.taux) || 25.6;
      const declarationId = btn.dataset.id;
      const declaration = store.declarations_urssaf.find(d => d.id === declarationId);

      // Activer le champ de saisie
      const input = document.getElementById(`ca-input-${period.id}`);
      if (input) input.disabled = false;

      // Remplacer les boutons par "Enregistrer" et "Annuler modif"
      const actions = btn.closest('.urssaf-declare-actions');
      if (actions) {
        actions.innerHTML = `
          <button class="btn-primary btn-sm btn-save-edit"
            data-id="${declarationId}"
            data-period='${JSON.stringify(period)}'
            data-taux="${taux}">
            Enregistrer la déclaration
          </button>
          <button class="btn-secondary btn-sm btn-cancel-edit"
            data-id="${declarationId}"
            data-period='${JSON.stringify(period)}'
            data-taux="${taux}">
            Annuler
          </button>`;
        attachEditSaveEvents();
      }
    });
  });

  // Annuler une déclaration
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
      const taux = parseFloat(btn.dataset.taux) || 25.6;
      const declarationId = btn.dataset.id;
      const input = document.getElementById(`ca-input-${period.id}`);
      const ca = parseFloat(input?.value) || 0;

      const idx = store.declarations_urssaf.findIndex(d => d.id === declarationId);
      if (idx !== -1) {
        store.declarations_urssaf[idx] = {
          ...store.declarations_urssaf[idx],
          ca_declare: ca,
          cotisations: ca * taux / 100,
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
