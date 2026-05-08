import { store, saveSettings, saveDeclarationsUrssaf } from '../data.js';
import { uuid, toast, formatCurrency, isoToday } from '../utils.js';

// Calendrier URSSAF pour auto-entrepreneur
// Mensuel : CA du mois M à déclarer avant le dernier jour du mois M+1
// Trimestriel : CA du trimestre T à déclarer avant le dernier jour du mois suivant le trimestre

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

function daysUntil(isoDate) {
  const diff = new Date(isoDate) - new Date(isoToday());
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function render() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const freq = store.settings.urssaf_frequence || 'mensuelle';
  const taux = store.settings.urssaf_taux || 22;
  const selectedYear = currentYear;

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
          <small style="color:var(--text-muted)">Taux indicatif. Vérifiez sur autoentrepreneur.urssaf.fr</small>
        </div>
        <div class="form-group form-group-half" style="align-self:flex-end">
          <button class="btn-primary" id="btn-save-urssaf-settings">Enregistrer</button>
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
      ${renderDeclarations(selectedYear, freq, taux)}
    </div>`;
}

function renderDeclarations(year, freq, taux) {
  const periods = buildPeriods(year, freq);
  const today = isoToday();

  return `
    <div class="urssaf-periods">
      ${periods.map(period => {
        const ca = caForPeriod(period.start, period.end);
        const cotisations = ca * taux / 100;
        const declaration = store.declarations_urssaf.find(d => d.periode_id === period.id);
        const isPast = period.end < today;
        const jours = daysUntil(period.deadline);
        const isUrgent = !declaration && jours <= 7 && jours >= 0;
        const isOverdue = !declaration && jours < 0;
        const isFuture = period.start > today;

        let statusBadge = '';
        if (declaration) {
          statusBadge = `<span class="badge badge-success">✓ Déclarée le ${new Date(declaration.date_declaration).toLocaleDateString('fr-FR')}</span>`;
        } else if (isOverdue) {
          statusBadge = `<span class="badge badge-danger">⚠️ En retard (${Math.abs(jours)} j)</span>`;
        } else if (isUrgent) {
          statusBadge = `<span class="badge badge-warning">⏰ ${jours} jour(s)</span>`;
        } else if (isFuture) {
          statusBadge = `<span class="badge badge-info">À venir</span>`;
        } else {
          statusBadge = `<span class="badge badge-info">${jours > 0 ? `${jours} jours` : 'Aujourd\'hui'}</span>`;
        }

        return `
          <div class="urssaf-period-card glass-card ${isUrgent ? 'urssaf-urgent' : ''} ${isOverdue ? 'urssaf-overdue' : ''} ${declaration ? 'urssaf-done' : ''}">
            <div class="urssaf-period-header">
              <div>
                <span class="urssaf-period-label">${period.label}</span>
                ${statusBadge}
              </div>
              <div class="urssaf-period-deadline">
                Échéance : ${new Date(period.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
              </div>
            </div>
            <div class="urssaf-period-amounts">
              <div class="urssaf-amount-block">
                <span class="urssaf-amount-label">CA encaissé</span>
                <span class="urssaf-amount-value ${ca === 0 ? 'text-muted' : ''}">${formatCurrency(ca)}</span>
              </div>
              <div class="urssaf-amount-block">
                <span class="urssaf-amount-label">Cotisations estimées (${taux}%)</span>
                <span class="urssaf-amount-value ${ca === 0 ? 'text-muted' : 'text-orange'}">${formatCurrency(cotisations)}</span>
              </div>
              ${declaration ? `
              <div class="urssaf-amount-block">
                <span class="urssaf-amount-label">CA déclaré</span>
                <span class="urssaf-amount-value">${formatCurrency(declaration.ca_declare)}</span>
              </div>` : ''}
            </div>
            ${!declaration && !isFuture ? `
            <div class="urssaf-declare-form" id="form-container-${period.id}">
              <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
                <div class="form-group" style="margin:0;flex:1;min-width:160px">
                  <label style="font-size:0.78rem">CA réel à déclarer (€)</label>
                  <input type="number" class="urssaf-ca-input" id="ca-input-${period.id}"
                    value="${ca.toFixed(2)}" min="0" step="0.01">
                </div>
                <button class="btn-primary btn-sm btn-declare" data-period='${JSON.stringify(period)}'
                  data-ca-taux="${taux}">
                  Enregistrer la déclaration
                </button>
              </div>
            </div>` : ''}
            ${declaration ? `
            <div style="margin-top:12px">
              <button class="btn-secondary btn-sm btn-undo-declare" data-id="${declaration.id}" data-periode="${period.id}">
                Annuler la déclaration
              </button>
            </div>` : ''}
          </div>`;
      }).join('')}
    </div>

    <div class="urssaf-total glass-card">
      <div class="urssaf-total-row">
        <span>CA total encaissé ${year}</span>
        <strong>${formatCurrency(periods.reduce((s, p) => s + caForPeriod(p.start, p.end), 0))}</strong>
      </div>
      <div class="urssaf-total-row">
        <span>Total cotisations estimées</span>
        <strong class="text-orange">${formatCurrency(periods.reduce((s, p) => s + caForPeriod(p.start, p.end) * taux / 100, 0))}</strong>
      </div>
      <div class="urssaf-total-row">
        <span>Périodes déclarées / Total</span>
        <strong>${store.declarations_urssaf.filter(d => d.periode_id.startsWith(String(year))).length} / ${periods.length}</strong>
      </div>
    </div>`;
}

export function init() {
  document.getElementById('btn-save-urssaf-settings')?.addEventListener('click', async () => {
    store.settings.urssaf_frequence = document.getElementById('urssaf-frequence').value;
    store.settings.urssaf_taux = parseFloat(document.getElementById('urssaf-taux').value) || 22;
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
  const taux = store.settings.urssaf_taux || 22;
  document.getElementById('urssaf-content').innerHTML = renderDeclarations(year, freq, taux);
  attachDeclareEvents();
}

function attachDeclareEvents() {
  document.querySelectorAll('.btn-declare').forEach(btn => {
    btn.addEventListener('click', async () => {
      const period = JSON.parse(btn.dataset.period);
      const taux = parseFloat(btn.dataset.caTaux) || 22;
      const caInput = document.getElementById(`ca-input-${period.id}`);
      const ca = parseFloat(caInput?.value) || 0;

      const declaration = {
        id: uuid(),
        periode_id: period.id,
        periode_label: period.label,
        ca_declare: ca,
        cotisations: ca * taux / 100,
        date_declaration: isoToday(),
        created_at: new Date().toISOString(),
      };
      store.declarations_urssaf.push(declaration);
      await saveDeclarationsUrssaf();
      toast(`Déclaration ${period.label} enregistrée ✓`);
      refreshContent();
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
