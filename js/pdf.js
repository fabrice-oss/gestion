import { store } from './data.js';
import { formatDate, formatCurrency } from './utils.js';

async function getLogoDataUrl() {
  // 1. Logo personnalisé du formateur (stocké en base64 dans ses settings Drive)
  if (store.settings.logo_base64) return store.settings.logo_base64;

  // 2. Fallback : logo de l'application (assets/logo.png)
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = 'assets/logo.png';
  });
}

export async function generateInvoicePDF(facture, mission) {
  const s = store.settings;
  const org = store.organismes.find(o => o.id === mission.organisme_id) || {};
  const logo = await getLogoDataUrl();

  const navy      = '#1B3A8C';
  const orange    = '#F5A623';
  const lightGrey = '#F5F7FB';
  const darkText  = '#1A2340';
  const mutedText = '#6B7280';

  const lignes = buildLignes(facture, mission);
  const totalHT = lignes.reduce((sum, l) => sum + l.total, 0);

  // ── Header : Logo gauche + FACTURE droite ────────────────────────────────
  const headerLeft = logo
    ? { image: logo, width: 72, margin: [0, 0, 0, 0] }
    : {
        stack: [
          { text: s.nom_commercial || 'AVRILA FORMATION', bold: true, fontSize: 16, color: navy },
        ],
      };

  const headerRight = {
    stack: [
      { text: 'FACTURE', fontSize: 32, bold: true, color: navy, alignment: 'right' },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 2, lineColor: orange }], margin: [0, 6, 0, 8] },
      {
        columns: [
          { text: 'FACTURE N° :', fontSize: 9, color: mutedText, width: 95 },
          { text: facture.numero, fontSize: 9, bold: true, color: darkText },
        ],
        alignment: 'right',
      },
      {
        columns: [
          { text: "DATE D'ÉMISSION :", fontSize: 9, color: mutedText, width: 95 },
          { text: formatDate(facture.date_emission), fontSize: 9, bold: true, color: darkText },
        ],
        alignment: 'right',
        margin: [0, 3, 0, 0],
      },
      {
        columns: [
          { text: 'ÉCHÉANCE :', fontSize: 9, color: mutedText, width: 95 },
          { text: formatDate(facture.date_echeance), fontSize: 9, bold: true, color: '#c0392b' },
        ],
        alignment: 'right',
        margin: [0, 3, 0, 0],
      },
    ],
    alignment: 'right',
  };

  // ── Blocs Émetteur / Facturé à ───────────────────────────────────────────
  const emetteurLines = [
    { text: 'ÉMETTEUR', fontSize: 8, bold: true, color: mutedText, margin: [10, 10, 10, 6] },
    { text: s.nom_commercial || 'AVRILA FORMATION', bold: true, fontSize: 12, color: navy, margin: [10, 0, 10, 2] },
    s.dirigeant ? { text: s.dirigeant, fontSize: 9, margin: [10, 0, 10, 0] } : {},
    s.adresse   ? { text: s.adresse, fontSize: 9, margin: [10, 0, 10, 0] } : {},
    (s.cp || s.ville) ? { text: `${s.cp || ''} ${s.ville || ''}`.trim(), fontSize: 9, margin: [10, 0, 10, 6] } : {},
    s.email ? { text: s.email, fontSize: 9, color: navy, margin: [10, 0, 10, 0] } : {},
    s.tel   ? { text: s.tel, fontSize: 9, margin: [10, 0, 10, 0] } : {},
    s.siret ? { text: `SIRET : ${s.siret}`, fontSize: 8, color: mutedText, margin: [10, 6, 10, 0] } : {},
    s.naf   ? { text: `Code NAF : ${s.naf}`, fontSize: 8, color: mutedText, margin: [10, 0, 10, 0] } : {},
    s.nda   ? { text: `N° Déclaration d'activité : ${s.nda}`, fontSize: 8, color: mutedText, margin: [10, 0, 10, 10] } : {},
  ].filter(x => x && Object.keys(x).length > 0);

  const clientLines = [
    { text: 'FACTURÉ À', fontSize: 8, bold: true, color: mutedText, margin: [12, 10, 12, 6] },
    { text: org.nom || '', bold: true, fontSize: 12, color: navy, margin: [12, 0, 12, 2] },
    org.adresse ? { text: org.adresse, fontSize: 9, margin: [12, 0, 12, 0] } : {},
    (org.cp || org.ville) ? { text: `${org.cp || ''} ${org.ville || ''}`.trim(), fontSize: 9, margin: [12, 0, 12, 6] } : {},
    org.correspondant ? { text: `À l'attention de ${org.correspondant}`, fontSize: 9, margin: [12, 0, 12, 0] } : {},
    org.email ? { text: org.email, fontSize: 9, color: navy, margin: [12, 0, 12, 0] } : {},
    org.siret ? { text: `SIRET : ${org.siret}`, fontSize: 8, color: mutedText, margin: [12, 6, 12, 0] } : {},
    { text: '', margin: [12, 0, 12, 10] },
  ].filter(x => x && Object.keys(x).length > 0);

  // ── Référence formation / PIPE ID ─────────────────────────────────────────
  const refLine = facture.reference_formation ? [{
    columns: [
      { text: 'Référence formation :', fontSize: 9, color: mutedText, width: 130 },
      { text: facture.reference_formation, fontSize: 9, bold: true, color: navy },
    ],
    margin: [0, 0, 0, 0],
  }] : [];

  // ── Objet ─────────────────────────────────────────────────────────────────
  const objetContent = {
    stack: [
      { text: `OBJET : ${mission.intitule || 'Formation'}${org.nom ? ' — ' + org.nom : ''}`, bold: true, fontSize: 9, color: navy },
      ...refLine,
    ],
    fillColor: lightGrey,
    margin: [10, 8, 10, 8],
  };

  // ── Tableau des prestations ───────────────────────────────────────────────
  const tableRows = lignes.map((l, i) => [
    {
      stack: [
        { text: l.description, bold: true, fontSize: 9.5, color: navy },
        l.subtitle ? { text: l.subtitle, fontSize: 8, color: mutedText, margin: [0, 2, 0, 0] } : {},
      ].filter(x => x && Object.keys(x).length > 0),
      fillColor: i % 2 === 0 ? '#FAFBFD' : 'white',
      margin: [6, 8, 6, 8],
    },
    {
      text: formatCurrency(l.prix_unitaire),
      alignment: 'right',
      fontSize: 9,
      fillColor: i % 2 === 0 ? '#FAFBFD' : 'white',
      margin: [4, 8, 6, 8],
    },
    {
      text: `${l.quantite} ${l.unite}`,
      alignment: 'center',
      fontSize: 9,
      fillColor: i % 2 === 0 ? '#FAFBFD' : 'white',
      margin: [4, 8, 4, 8],
    },
    {
      text: formatCurrency(l.total),
      alignment: 'right',
      bold: true,
      fontSize: 9.5,
      fillColor: i % 2 === 0 ? '#FAFBFD' : 'white',
      margin: [4, 8, 6, 8],
    },
  ]);

  const prestationsTable = {
    table: {
      widths: ['*', 100, 80, 90],
      body: [
        [
          { text: 'DESCRIPTION', bold: true, fillColor: navy, color: 'white', fontSize: 9, margin: [6, 8, 6, 8] },
          { text: 'PRIX UNITAIRE', bold: true, fillColor: navy, color: 'white', fontSize: 9, alignment: 'right', margin: [4, 8, 6, 8] },
          { text: 'QUANTITÉ', bold: true, fillColor: navy, color: 'white', fontSize: 9, alignment: 'center', margin: [4, 8, 4, 8] },
          { text: 'TOTAL', bold: true, fillColor: navy, color: 'white', fontSize: 9, alignment: 'right', margin: [4, 8, 6, 8] },
        ],
        ...tableRows,
      ],
    },
    layout: {
      hLineWidth: (i) => i === 0 || i === 1 ? 0 : 0.5,
      vLineWidth: () => 0,
      hLineColor: () => '#E5E8F0',
    },
    margin: [0, 0, 0, 0],
  };

  // ── Section bas : Règlement (gauche) + Totaux (droite) ────────────────────
  const reglement = [
    { text: 'RÈGLEMENT :', bold: true, fontSize: 9, color: darkText, margin: [0, 0, 0, 6] },
    { text: s.mode_paiement || 'Par virement bancaire', fontSize: 9, color: darkText },
  ];
  if (s.banque) reglement.push({ text: `Banque : ${s.banque}`, fontSize: 8.5, color: mutedText, margin: [0, 4, 0, 0] });
  if (s.iban)   reglement.push({ text: `IBAN : ${s.iban}`, fontSize: 8.5, color: mutedText });
  if (s.bic)    reglement.push({ text: `BIC : ${s.bic}`, fontSize: 8.5, color: mutedText });
  reglement.push({ text: '', margin: [0, 8, 0, 0] });
  reglement.push({ text: s.facturation?.mention_tva || 'TVA non applicable — Art. 293 B du CGI', fontSize: 8, color: mutedText, italics: true });
  reglement.push({ text: `Pénalités de retard : ${s.facturation?.penalites_taux || 'taux BCE + 10 points'}`, fontSize: 7.5, color: mutedText, margin: [0, 3, 0, 0] });
  reglement.push({ text: `Indemnité forfaitaire de recouvrement : ${s.facturation?.indemnite_recouvrement || 40} €`, fontSize: 7.5, color: mutedText });

  const totaux = {
    table: {
      widths: ['*', 100],
      body: [
        [
          { text: 'TOTAL HT', fontSize: 9, color: mutedText, alignment: 'right', border: [false, false, false, true], borderColor: [null, null, null, '#E5E8F0'], margin: [4, 8, 4, 8] },
          { text: formatCurrency(totalHT), fontSize: 9, bold: true, alignment: 'right', border: [false, false, false, true], borderColor: [null, null, null, '#E5E8F0'], margin: [4, 8, 8, 8] },
        ],
        [
          { text: 'TVA', fontSize: 9, color: mutedText, alignment: 'right', border: [false, false, false, true], borderColor: [null, null, null, '#E5E8F0'], margin: [4, 8, 4, 8] },
          { text: 'Non applicable', fontSize: 8, color: mutedText, alignment: 'right', italics: true, border: [false, false, false, true], borderColor: [null, null, null, '#E5E8F0'], margin: [4, 8, 8, 8] },
        ],
        [
          { text: 'NET À PAYER', bold: true, fontSize: 11, color: navy, alignment: 'right', fillColor: lightGrey, border: [false, false, false, false], margin: [4, 12, 4, 12] },
          { text: formatCurrency(totalHT), bold: true, fontSize: 14, color: navy, alignment: 'right', fillColor: lightGrey, border: [false, false, false, false], margin: [4, 12, 8, 12] },
        ],
      ],
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0 : 0.5,
      vLineWidth: () => 0,
      hLineColor: () => '#E5E8F0',
    },
  };

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [45, 45, 45, 55],
    defaultStyle: { font: 'Roboto', fontSize: 9.5, color: darkText, lineHeight: 1.35 },

    footer: () => ({
      stack: [
        { canvas: [{ type: 'line', x1: 45, y1: 0, x2: 550, y2: 0, lineWidth: 0.5, lineColor: '#E0E4EF' }] },
        {
          text: `${s.nom_commercial || 'AVRILA FORMATION'} — N° de SIRET : ${s.siret || ''} — NDA : ${s.nda || ''} — Conditions générales de vente disponibles sur le site de l'organisme.`,
          alignment: 'center', fontSize: 7.5, color: mutedText, margin: [45, 6, 45, 0],
        },
      ],
    }),

    content: [
      // 1. Header
      {
        columns: [
          { stack: [headerLeft], width: '45%' },
          { stack: [headerRight], width: '55%' },
        ],
        margin: [0, 0, 0, 22],
      },

      // 2. Séparateur orange
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 505, y2: 0, lineWidth: 2.5, lineColor: orange }], margin: [0, 0, 0, 20] },

      // 3. Blocs Émetteur / Client
      {
        columns: [
          {
            table: {
              widths: ['*'],
              body: [[{ stack: emetteurLines, border: [true, false, false, false], borderColor: [orange, null, null, null] }]],
            },
            layout: { hLineWidth: () => 0, vLineWidth: (i) => i === 0 ? 3 : 0, vLineColor: () => orange },
            width: '47%',
          },
          { width: '6%', text: '' },
          {
            table: {
              widths: ['*'],
              body: [[{ stack: clientLines, fillColor: lightGrey, border: [false, false, false, false] }]],
            },
            layout: 'noBorders',
            width: '47%',
          },
        ],
        margin: [0, 0, 0, 20],
      },

      // 4. Objet
      {
        table: { widths: ['*'], body: [[objetContent]] },
        layout: 'noBorders',
        margin: [0, 0, 0, 16],
      },

      // 5. Tableau prestations
      prestationsTable,

      // 6. Séparateur
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 505, y2: 0, lineWidth: 0.5, lineColor: '#E0E4EF' }], margin: [0, 16, 0, 16] },

      // 7. Règlement + Totaux
      {
        columns: [
          { stack: reglement, width: '55%' },
          { stack: [totaux], width: '45%' },
        ],
      },
    ],
  };

  return new Promise((resolve) => {
    pdfMake.createPdf(docDefinition).getBlob(resolve);
  });
}

function buildLignes(facture, mission) {
  const lignes = [];
  const sessions = mission.sessions || [];
  const nb = sessions.length;
  const tarif = mission.tarif_journalier || 0;

  // Dates des sessions comme subtitle
  const sessionDates = sessions.map(s => {
    const d = new Date(s.date + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }).join(', ');

  if (nb > 0 && tarif > 0) {
    lignes.push({
      description: `Animation de formation : ${mission.intitule || 'Formation'}`,
      subtitle: sessionDates ? `Sessions : ${sessionDates}` : '',
      quantite: nb,
      unite: nb > 1 ? 'jours' : 'jour',
      prix_unitaire: tarif,
      total: nb * tarif,
    });
  }

  if (mission.frais_deplacement > 0) {
    lignes.push({
      description: 'Frais de déplacement',
      subtitle: 'Remboursement forfaitaire',
      quantite: 1,
      unite: 'forfait',
      prix_unitaire: mission.frais_deplacement,
      total: mission.frais_deplacement,
    });
  }

  return lignes;
}
