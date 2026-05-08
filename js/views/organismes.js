import { store, saveOrganismes } from '../data.js';
import { uuid, toast, escHtml, confirm } from '../utils.js';
import { showModal, closeModal } from '../app.js';

export function render() {
  return `
    <div class="view-header">
      <h2>Organismes de formation</h2>
      <button class="btn-primary" id="btn-new-organisme">+ Nouvel organisme</button>
    </div>
    <div class="glass-card">
      ${store.organismes.length === 0
        ? '<p class="empty-state">Aucun organisme. Ajoutez votre premier partenaire.</p>'
        : `<div class="table-wrapper"><table class="data-table">
            <thead><tr>
              <th>Nom</th><th>Correspondant</th><th>Email</th><th>Téléphone</th><th>SIRET</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${store.organismes.map(o => `
                <tr>
                  <td><strong>${escHtml(o.nom)}</strong></td>
                  <td>${escHtml(o.correspondant || '—')}</td>
                  <td>${o.email ? `<a href="mailto:${escHtml(o.email)}">${escHtml(o.email)}</a>` : '—'}</td>
                  <td>${escHtml(o.tel || '—')}</td>
                  <td>${escHtml(o.siret || '—')}</td>
                  <td class="actions">
                    <button class="btn-icon btn-edit" data-id="${o.id}" title="Modifier">✏️</button>
                    <button class="btn-icon btn-delete" data-id="${o.id}" title="Supprimer">🗑️</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table></div>`}
    </div>`;
}

export function init() {
  document.getElementById('btn-new-organisme')?.addEventListener('click', () => openForm());
  document.querySelectorAll('.btn-edit[data-id]').forEach(btn =>
    btn.addEventListener('click', () => openForm(btn.dataset.id)));
  document.querySelectorAll('.btn-delete[data-id]').forEach(btn =>
    btn.addEventListener('click', () => deleteOrganisme(btn.dataset.id)));
}

function organisme_form(o = {}) {
  return `
    <form id="form-organisme" class="form-grid">
      <div class="form-group">
        <label>Nom de l'organisme *</label>
        <input type="text" name="nom" value="${escHtml(o.nom || '')}" required>
      </div>
      <div class="form-group">
        <label>Correspondant</label>
        <input type="text" name="correspondant" value="${escHtml(o.correspondant || '')}">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" value="${escHtml(o.email || '')}">
      </div>
      <div class="form-group">
        <label>Téléphone</label>
        <input type="tel" name="tel" value="${escHtml(o.tel || '')}">
      </div>
      <div class="form-group">
        <label>Adresse</label>
        <input type="text" name="adresse" value="${escHtml(o.adresse || '')}">
      </div>
      <div class="form-group form-group-half">
        <label>Code postal</label>
        <input type="text" name="cp" value="${escHtml(o.cp || '')}">
      </div>
      <div class="form-group form-group-half">
        <label>Ville</label>
        <input type="text" name="ville" value="${escHtml(o.ville || '')}">
      </div>
      <div class="form-group">
        <label>SIRET</label>
        <input type="text" name="siret" value="${escHtml(o.siret || '')}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" id="btn-cancel">Annuler</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>`;
}

function openForm(id = null) {
  const o = id ? store.organismes.find(x => x.id === id) : {};
  showModal(id ? 'Modifier l\'organisme' : 'Nouvel organisme', organisme_form(o || {}));

  document.getElementById('btn-cancel')?.addEventListener('click', closeModal);
  document.getElementById('form-organisme')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());

    if (id) {
      const idx = store.organismes.findIndex(x => x.id === id);
      store.organismes[idx] = { ...store.organismes[idx], ...data };
    } else {
      store.organismes.push({ id: uuid(), ...data });
    }
    await saveOrganismes();
    toast('Organisme enregistré');
    closeModal();
    import('../app.js').then(app => app.navigate('organismes'));
  });
}

async function deleteOrganisme(id) {
  const used = store.missions.some(m => m.organisme_id === id);
  if (used) { toast('Cet organisme est utilisé dans une mission', 'error'); return; }
  const ok = await confirm('Supprimer cet organisme ?');
  if (!ok) return;
  store.organismes = store.organismes.filter(o => o.id !== id);
  await saveOrganismes();
  toast('Organisme supprimé');
  import('../app.js').then(app => app.navigate('organismes'));
}
