import { store, saveMissions, getOrganisme, getMissionEntreprises, getMissionFacture } from '../data.js';
import { uuid, toast, escHtml, confirm, formatDate, formatCurrency, missionTotalHT, missionHeuresFormateur, isoToday } from '../utils.js';
import { showModal, closeModal, navigate } from '../app.js';
import { createEvent } from '../api/calendar.js';

const MISSION_TYPES = [
  { value: 'animation',         label: 'Animation de formation' },
  { value: 'conception',        label: 'Conception pédagogique' },
  { value: 'creation_site_web', label: 'Création de site web' },
  { value: 'application_web',   label: 'Application web' },
  { value: 'gestion_site_web',  label: 'Gestion de site web' },
];

const SPECIALITES = [
  { code: '200', label: 'Formations générales' },
  { code: '300', label: 'Sciences, lettres, arts' },
  { code: '400', label: 'Sciences humaines' },
  { code: '413', label: 'Droit, sciences politiques' },
  { code: '414', label: 'Sciences économiques' },
  { code: '415', label: 'Gestion, administration des entreprises' },
  { code: '421', label: 'Journalisme' },
  { code: '422', label: 'Communication, information' },
  { code: '423', label: 'Vie familiale, vie sociale' },
  { code: '431', label: 'Éducation physique, sport' },
  { code: '311', label: 'Santé' },
  { code: '312', label: 'Action sociale, psychologie' },
  { code: '320', label: 'Spécialités pluritechnologiques' },
  { code: '326', label: 'Informatique, traitement de l\'information' },
  { code: '334', label: 'Sécurité des biens et des personnes, police' },
];

export function render() {
  return `
    <div class="view-header">
      <h2>Missions</h2>
      <button class="btn-primary" id="btn-new-mission">+ Nouvelle mission</button>
    </div>
    <div class="filter-bar glass-card">
      <button class="filter-btn active" data-filter="tous">Toutes</button>
      <button class="filter-btn" data-filter="en_cours">En cours</button>
      <button class="filter-btn" data-filter="terminee">Terminées</button>
      <button class="filter-btn" data-filter="annulee">Annulées</button>
    </div>
    <div id="missions-list">
      ${renderMissionsList('tous')}
    </div>`;
}

function typeLabel(type) {
  return MISSION_TYPES.find(t => t.value === type)?.label || type || 'Formation';
}

function renderMissionsList(filter) {
  const list = filter === 'tous'
    ? store.missions
    : store.missions.filter(m => m.statut === filter);

  const sorted = [...list].sort((a, b) => {
    const aDate = (a.sessions?.[0]?.date) || '';
    const bDate = (b.sessions?.[0]?.date) || '';
    return bDate.localeCompare(aDate);
  });

  if (sorted.length === 0) return '<p class="empty-state">Aucune mission.</p>';

  return `<div class="missions-grid">
    ${sorted.map(m => {
      const org = getOrganisme(m.organisme_id);
      const entreprises = getMissionEntreprises(m);
      const facture = getMissionFacture(m.id);
      const sessions = m.sessions || [];
      const firstDate = sessions[0]?.date;
      const lastDate = sessions[sessions.length - 1]?.date;
      const total = missionTotalHT(m);
      const heures = missionHeuresFormateur(m);
      const statutClass = { en_cours: 'info', terminee: 'success', annulee: 'danger' }[m.statut] || 'info';
      const statutLabel = { en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' }[m.statut] || m.statut;

      return `
        <div class="mission-card glass-card" data-id="${m.id}">
          <div class="mission-card-header">
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <span class="badge badge-${statutClass}">${statutLabel}</span>
              <span class="badge badge-info">${escHtml(typeLabel(m.type))}</span>
              ${m.distanciel ? '<span class="badge badge-info">Distanciel</span>' : ''}
            </div>
            <div class="mission-actions">
              <button class="btn-icon btn-edit-mission" data-id="${m.id}" title="Modifier">✏️</button>
              <button class="btn-icon btn-delete-mission" data-id="${m.id}" title="Supprimer">🗑️</button>
            </div>
          </div>
          <h3 class="mission-title">${escHtml(m.intitule || 'Mission sans titre')}</h3>
          <div class="mission-meta">
            <div class="meta-item"><span>🏢</span> ${escHtml(org?.nom || '—')}</div>
            ${entreprises.length > 0
              ? `<div class="meta-item"><span>🏭</span> ${entreprises.map(e => escHtml(e.nom)).join(', ')}</div>`
              : ''}
            <div class="meta-item"><span>👥</span> ${m.participants || 0} participant(s)</div>
            <div class="meta-item"><span>⏱</span> ${heures}h · ${sessions.length} jour(s)</div>
            ${firstDate ? `<div class="meta-item"><span>📅</span> ${formatDate(firstDate)}${lastDate !== firstDate ? ` → ${formatDate(lastDate)}` : ''}</div>` : ''}
          </div>
          <div class="mission-footer">
            <div class="mission-total">${formatCurrency(total)}</div>
            ${facture
              ? `<span class="badge badge-${facture.statut === 'payee' ? 'success' : 'warning'}">${facture.statut === 'payee' ? '✓ Payée' : '⏳ Facturée'}</span>`
              : m.statut === 'terminee'
                ? `<button class="btn-sm btn-primary btn-facturer" data-id="${m.id}">Facturer</button>`
                : ''}
          </div>
        </div>`;
    }).join('')}
  </div>`;
}

export function init() {
  document.getElementById('btn-new-mission')?.addEventListener('click', () => openMissionForm());

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('missions-list').innerHTML = renderMissionsList(btn.dataset.filter);
      attachMissionEvents();
    });
  });

  attachMissionEvents();
}

function attachMissionEvents() {
  document.querySelectorAll('.btn-edit-mission').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); openMissionForm(btn.dataset.id); }));
  document.querySelectorAll('.btn-delete-mission').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); deleteMission(btn.dataset.id); }));
  document.querySelectorAll('.btn-facturer').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); navigate('factures', { action: 'new', missionId: btn.dataset.id }); }));
}

function isFormationType(type) {
  return type === 'animation' || type === 'conception';
}

function missionFormHTML(m = {}) {
  const sessions = m.sessions || [{ date: isoToday(), heures: 7 }];
  const selectedEntreprises = m.entreprises_ids || (m.entreprise_id ? [m.entreprise_id] : []);

  return `
    <form id="form-mission" class="form-grid">
      <div class="form-group">
        <label>Intitulé *</label>
        <input type="text" name="intitule" value="${escHtml(m.intitule || '')}" required placeholder="Ex: Formation SST">
      </div>
      <div class="form-group form-group-half">
        <label>Type de prestation</label>
        <select name="type" id="select-type">
          ${MISSION_TYPES.map(t => `<option value="${t.value}" ${(m.type || 'animation') === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group form-group-half">
        <label>Statut</label>
        <select name="statut" id="select-statut">
          <option value="en_cours" ${(m.statut || 'en_cours') === 'en_cours' ? 'selected' : ''}>En cours</option>
          <option value="terminee" ${m.statut === 'terminee' ? 'selected' : ''}>Terminée</option>
          <option value="annulee" ${m.statut === 'annulee' ? 'selected' : ''}>Annulée</option>
        </select>
      </div>
      <div class="form-group">
        <label>Organisme de formation *</label>
        <select name="organisme_id" required>
          <option value="">— Sélectionner —</option>
          ${store.organismes.map(o => `<option value="${o.id}" ${m.organisme_id === o.id ? 'selected' : ''}>${escHtml(o.nom)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Entreprises formées <span style="color:var(--text-muted);font-weight:400">(sélection multiple possible)</span></label>
        <div class="entreprises-checkboxes">
          ${store.entreprises.length === 0
            ? '<span style="color:var(--text-muted);font-size:0.85rem">Aucune entreprise enregistrée</span>'
            : store.entreprises.map(e => `
              <label class="entreprise-tag">
                <input type="checkbox" name="entreprises_ids" value="${e.id}" ${selectedEntreprises.includes(e.id) ? 'checked' : ''}>
                <span>${escHtml(e.nom)}</span>
              </label>`).join('')}
        </div>
      </div>
      <div class="form-group form-group-half">
        <label>Nombre de participants</label>
        <input type="number" name="participants" value="${m.participants || ''}" min="0">
      </div>
      <div class="form-group form-group-half">
        <label>Tarif journalier HT (€)</label>
        <input type="number" name="tarif_journalier" value="${m.tarif_journalier || ''}" min="0" step="0.01">
      </div>
      <div class="form-group">
        <label>Frais de déplacement HT (€)</label>
        <input type="number" name="frais_deplacement" value="${m.frais_deplacement || 0}" min="0" step="0.01">
      </div>
      <div class="form-group formation-only" id="specialite-group" ${!isFormationType(m.type || 'animation') ? 'style="display:none"' : ''}>
        <label>Spécialité de formation (BPF)</label>
        <select name="specialite">
          <option value="">— Sélectionner —</option>
          ${SPECIALITES.map(s => `<option value="${s.code}" ${m.specialite === s.code ? 'selected' : ''}>${s.code} — ${s.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group form-group-full formation-only" id="distanciel-group" ${!isFormationType(m.type || 'animation') ? 'style="display:none"' : ''}>
        <label>
          <input type="checkbox" name="distanciel" value="true" ${m.distanciel ? 'checked' : ''}>
          Formation en tout ou partie à distance (classe virtuelle, e-learning…)
        </label>
      </div>

      <div class="form-section-title">Sessions / Jours d'intervention</div>
      <div id="sessions-container" class="form-group-full">
        ${sessions.map((s, i) => sessionRow(s, i)).join('')}
      </div>
      <div class="form-group-full">
        <button type="button" class="btn-secondary" id="btn-add-session">+ Ajouter une session</button>
      </div>

      <div class="form-group form-group-full">
        <label>Notes internes</label>
        <textarea name="notes" rows="3">${escHtml(m.notes || '')}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" id="btn-cancel">Annuler</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>`;
}

function sessionRow(s, i) {
  return `
    <div class="session-row" data-idx="${i}">
      <div class="form-group form-group-half">
        <label>Date</label>
        <input type="date" name="sessions[${i}][date]" value="${s.date || ''}" required>
      </div>
      <div class="form-group form-group-half" style="max-width:200px">
        <label>Heures / jour</label>
        <input type="number" name="sessions[${i}][heures]" value="${s.heures || 7}" min="1" max="12" required>
      </div>
      <div class="form-group" style="align-self:flex-end;margin-bottom:16px">
        <button type="button" class="btn-icon btn-remove-session" data-idx="${i}" title="Supprimer">🗑️</button>
      </div>
    </div>`;
}

let sessionCount = 1;

function openMissionForm(id = null) {
  const m = id ? store.missions.find(x => x.id === id) : null;
  sessionCount = m?.sessions?.length || 1;
  showModal(id ? 'Modifier la mission' : 'Nouvelle mission', missionFormHTML(m || {}), 'modal-large');

  document.getElementById('btn-cancel')?.addEventListener('click', closeModal);

  // Afficher/masquer les champs formation selon le type
  document.getElementById('select-type')?.addEventListener('change', e => {
    const isFormation = isFormationType(e.target.value);
    document.getElementById('specialite-group').style.display = isFormation ? '' : 'none';
    document.getElementById('distanciel-group').style.display = isFormation ? '' : 'none';
  });

  document.getElementById('btn-add-session')?.addEventListener('click', () => {
    const container = document.getElementById('sessions-container');
    const div = document.createElement('div');
    div.innerHTML = sessionRow({ date: isoToday(), heures: 7 }, sessionCount++);
    container.appendChild(div.firstElementChild);
    attachRemoveSession();
  });

  attachRemoveSession();

  document.getElementById('form-mission')?.addEventListener('submit', async e => {
    e.preventDefault();
    await saveMissionForm(e.target, id);
  });
}

function attachRemoveSession() {
  document.querySelectorAll('.btn-remove-session').forEach(btn => {
    btn.onclick = () => {
      const row = btn.closest('.session-row');
      if (document.querySelectorAll('.session-row').length > 1) row.remove();
      else toast('Une mission doit avoir au moins une session', 'error');
    };
  });
}

async function saveMissionForm(form, id) {
  const fd = new FormData(form);
  const previousStatut = id ? store.missions.find(x => x.id === id)?.statut : null;

  const sessions = [];
  let i = 0;
  while (fd.has(`sessions[${i}][date]`)) {
    sessions.push({ date: fd.get(`sessions[${i}][date]`), heures: parseInt(fd.get(`sessions[${i}][heures]`)) || 7 });
    i++;
  }
  sessions.sort((a, b) => a.date.localeCompare(b.date));

  const type = fd.get('type');
  const data = {
    intitule: fd.get('intitule'),
    type,
    statut: fd.get('statut'),
    organisme_id: fd.get('organisme_id'),
    entreprises_ids: fd.getAll('entreprises_ids'),
    participants: parseInt(fd.get('participants')) || 0,
    tarif_journalier: parseFloat(fd.get('tarif_journalier')) || 0,
    frais_deplacement: parseFloat(fd.get('frais_deplacement')) || 0,
    specialite: isFormationType(type) ? (fd.get('specialite') || '') : '',
    distanciel: isFormationType(type) ? fd.get('distanciel') === 'true' : false,
    notes: fd.get('notes') || '',
    sessions,
  };

  let savedMissionId;
  if (id) {
    const idx = store.missions.findIndex(x => x.id === id);
    store.missions[idx] = { ...store.missions[idx], ...data };
    savedMissionId = id;
  } else {
    savedMissionId = uuid();
    store.missions.push({ id: savedMissionId, created_at: new Date().toISOString(), ...data });
  }

  await saveMissions();

  // Sync Google Calendar
  try {
    const calendarId = store.settings.calendar_id;
    if (calendarId && calendarId !== 'primary') {
      const mission = store.missions.find(x => x.id === savedMissionId);
      const org = getOrganisme(mission.organisme_id);
      const entreprises = getMissionEntreprises(mission);
      const entLabel = entreprises.map(e => e.nom).join(', ') || 'Entreprise inconnue';
      const fakeEnt = { nom: entLabel };
      for (const session of sessions) {
        if (!session.calendar_event_id) {
          const ev = await createEvent(calendarId, session, mission, org, fakeEnt);
          session.calendar_event_id = ev.id;
        }
      }
      await saveMissions();
    }
  } catch (e) {
    console.warn('Calendar sync failed:', e);
    toast('Mission enregistrée (Google Calendar non synchronisé)', 'warning');
  }

  // Proposer de créer une facture si la mission vient d'être marquée terminée
  if (data.statut === 'terminee' && previousStatut !== 'terminee') {
    const existingFacture = store.factures.find(f => f.mission_id === savedMissionId);
    if (!existingFacture) {
      closeModal();
      const createInvoice = await confirm('Mission terminée. Souhaitez-vous créer la facture maintenant ?');
      if (createInvoice) {
        navigate('factures', { action: 'new', missionId: savedMissionId });
        return;
      }
      navigate('missions');
      toast('Mission enregistrée ✓');
      return;
    }
  }

  toast('Mission enregistrée ✓');
  closeModal();
  navigate('missions');
}

async function deleteMission(id) {
  const facture = getMissionFacture(id);
  if (facture) { toast('Cette mission a une facture associée. Supprimez la facture d\'abord.', 'error'); return; }
  const ok = await confirm('Supprimer cette mission définitivement ?');
  if (!ok) return;
  store.missions = store.missions.filter(m => m.id !== id);
  await saveMissions();
  toast('Mission supprimée');
  navigate('missions');
}
