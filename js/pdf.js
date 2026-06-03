import { store } from './data.js';
import { formatDate, formatCurrency } from './utils.js';

// ── Correctif caractères : Intl 'fr-FR' insère   (espace fine insécable)
// comme séparateur de milliers. La police Roboto embarquée dans pdfmake ne
// contient pas ce glyphe → rendu \x00 dans le PDF généré.
// On remplace tous les espaces insécables par une espace normale avant usage.
function pdfCurrency(n) {
  return formatCurrency(n)
    .replace(/ /g, ' ')  // espace fine insécable → espace normale
    .replace(/ /g, ' '); // espace insécable → espace normale
}

async function getLogoDataUrl() {
  if (store.settings.logo_base64) return store.settings.logo_base64;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = 'assets/logo.png';
  });
}

export async function generateInvoicePDF(facture, mission) {
  const s    = store.settings;
  const org  = store.organismes.find(o => o.id === mission.organisme_id) || {};
  const logo = await getLogoDataUrl();

  // ── Palette ────────────────────────────────────────────────────────────────
  const navy      = '#1B3A8C';
  const navyMid   = '#22469E';
  const orange    = '#F5A623';
  const lightGrey = '#F4F6FB';
  const darkText  = '#1A2340';
  const mutedText = '#6B7280';
  const white     = '#FFFFFF';
  // Couleurs claires pour texte sur fond navy (hex pur — pdfmake n'accepte pas rgba)
  const onNavy    = '#FFFFFF';
  const onNavySub = '#B8CCF0';
  const onNavyMut = '#7A9ACA';

  const lignes  = buildLignes(facture, mission);
  const totalHT = lignes.reduce((sum, l) => sum + l.total, 0);
  const isPaid  = facture.statut === 'payee';

  // ══════════════════════════════════════════════════════════════════════════
  // 1. BANDE HEADER navy pleine largeur
  // ══════════════════════════════════════════════════════════════════════════
  const logoContent = logo
    ? { image: logo, width: 70, margin: [0, 0, 0, 0] }
    : { text: s.nom_commercial || 'AVRILA FORMATION', fontSize: 14, bold: true, color: onNavy };

  const headerBand = {
    table: {
      widths: ['*', 'auto'],
      body: [[
        {
          stack: [logoContent],
          fillColor: navy,
          border: [false, false, false, false],
          margin: [0, 20, 20, 20],
        },
        {
          stack: [
            { text: 'FACTURE', fontSize: 36, bold: true, color: onNavy, alignment: 'right', characterSpacing: 3 },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 195, y2: 0, lineWidth: 2.5, lineColor: orange }], margin: [0, 5, 0, 9], alignment: 'right' },
            {
              columns: [
                { text: 'N° :', fontSize: 8, color: onNavySub, width: 50, alignment: 'right' },
                { text: facture.numero, fontSize: 8, bold: true, color: onNavy, width: '*', alignment: 'right' },
              ],
            },
            {
              columns: [
                { text: 'Emis le :', fontSize: 8, color: onNavySub, width: 50, alignment: 'right' },
                { text: formatDate(facture.date_emission), fontSize: 8, bold: true, color: onNavy, width: '*', alignment: 'right' },
              ],
              margin: [0, 3, 0, 0],
            },
            {
              columns: [
                { text: 'Echeance :', fontSize: 8, color: onNavySub, width: 50, alignment: 'right' },
                { text: formatDate(facture.date_echeance), fontSize: 8, bold: true, color: orange, width: '*', alignment: 'right' },
              ],
              margin: [0, 3, 0, 0],
            },
          ],
          fillColor: navy,
          border: [false, false, false, false],
          margin: [0, 20, 0, 20],
          alignment: 'right',
        },
      ]],
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 0],
  };

  // ── Filet orange sous le header ───────────────────────────────────────────
  const orangeBar = {
    canvas: [{ type: 'rect', x: 0, y: 0, w: 505, h: 3.5, r: 0, color: orange }],
    margin: [0, 0, 0, 24],
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 2. BLOCS ÉMETTEUR / FACTURÉ À
  // ══════════════════════════════════════════════════════════════════════════
  const emetteurLines = [
    { text: 'EMETTEUR', fontSize: 7, bold: true, color: orange, characterSpacing: 1.2, margin: [12, 12, 12, 7] },
    { text: s.nom_commercial || 'AVRILA FORMATION', bold: true, fontSize: 11, color: navy, margin: [12, 0, 12, 3] },
    ...[
      s.dirigeant          ? { text: s.dirigeant,                                   fontSize: 8.5, color: darkText, margin: [12, 0, 12, 0] } : null,
      s.adresse            ? { text: s.adresse,                                     fontSize: 8.5, color: darkText, margin: [12, 0, 12, 0] } : null,
      (s.cp || s.ville)    ? { text: `${s.cp || ''} ${s.ville || ''}`.trim(),       fontSize: 8.5, color: darkText, margin: [12, 0, 12, 5] } : null,
      s.email              ? { text: s.email,                                        fontSize: 8.5, color: navy,    margin: [12, 0, 12, 0] } : null,
      s.tel                ? { text: s.tel,                                          fontSize: 8.5, color: darkText, margin: [12, 0, 12, 0] } : null,
      s.siret              ? { text: `SIRET : ${s.siret}`,                          fontSize: 7.5, color: mutedText, margin: [12, 6, 12, 0] } : null,
      s.naf                ? { text: `Code NAF : ${s.naf}`,                         fontSize: 7.5, color: mutedText, margin: [12, 0, 12, 0] } : null,
      s.nda                ? { text: `N° DA : ${s.nda}`,                       fontSize: 7.5, color: mutedText, margin: [12, 0, 12, 14] } : null,
    ].filter(Boolean),
  ].filter(Boolean);

  const clientLines = [
    { text: 'FACTURE A', fontSize: 7, bold: true, color: onNavyMut, characterSpacing: 1.2, margin: [14, 12, 14, 7] },
    { text: org.nom || '', bold: true, fontSize: 11, color: onNavy, margin: [14, 0, 14, 3] },
    ...[
      org.adresse                  ? { text: org.adresse,                                         fontSize: 8.5, color: onNavySub, margin: [14, 0, 14, 0] } : null,
      (org.cp || org.ville)        ? { text: `${org.cp || ''} ${org.ville || ''}`.trim(),         fontSize: 8.5, color: onNavySub, margin: [14, 0, 14, 5] } : null,
      org.correspondant            ? { text: `A l'att. de ${org.correspondant}`,                  fontSize: 8.5, color: onNavySub, margin: [14, 0, 14, 0] } : null,
      org.email                    ? { text: org.email,                                            fontSize: 8.5, color: onNavySub, margin: [14, 0, 14, 0] } : null,
      org.siret                    ? { text: `SIRET : ${org.siret}`,                              fontSize: 7.5, color: onNavyMut, margin: [14, 6, 14, 14] } : null,
      !org.siret                   ? { text: '',                                                   margin: [14, 0, 14, 14] } : null,
    ].filter(Boolean),
  ].filter(Boolean);

  const addressSection = {
    columns: [
      {
        table: {
          widths: ['*'],
          body: [[{ stack: emetteurLines, border: [true, false, false, false], borderColor: [orange, null, null, null] }]],
        },
        layout: { hLineWidth: () => 0, vLineWidth: (i) => (i === 0 ? 3 : 0), vLineColor: () => orange },
        width: '47%',
      },
      { width: '6%', text: '' },
      {
        table: {
          widths: ['*'],
          body: [[{ stack: clientLines, fillColor: navy, border: [false, false, false, false] }]],
        },
        layout: 'noBorders',
        width: '47%',
      },
    ],
    margin: [0, 0, 0, 22],
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 3. BANDE OBJET (fond navy clair)
  // ══════════════════════════════════════════════════════════════════════════
  const refLine = facture.reference_formation
    ? [{
        columns: [
          { text: 'Ref. formation :', fontSize: 8, color: onNavyMut, width: 110 },
          { text: facture.reference_formation, fontSize: 8, bold: true, color: onNavy },
        ],
        margin: [0, 3, 0, 0],
      }]
    : [];

  const objetBand = {
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          {
            text: `OBJET : ${mission.intitule || 'Formation'}${org.nom ? '  —  ' + org.nom : ''}`,
            bold: true, fontSize: 9.5, color: onNavy,
          },
          ...refLine,
        ],
        fillColor: navyMid,
        border: [false, false, false, false],
        margin: [14, 11, 14, 11],
      }]],
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 18],
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 4. TABLEAU PRESTATIONS
  // ══════════════════════════════════════════════════════════════════════════
  const tableRows = lignes.map((l, i) => {
    const bg = i % 2 === 0 ? lightGrey : white;
    return [
      {
        stack: [
          { text: l.description, bold: true, fontSize: 9.5, color: navy },
          l.subtitle ? { text: l.subtitle, fontSize: 7.5, color: mutedText, margin: [0, 2, 0, 0] } : null,
        ].filter(Boolean),
        fillColor: bg, margin: [8, 10, 8, 10],
      },
      { text: pdfCurrency(l.prix_unitaire), alignment: 'right', fontSize: 9, color: darkText,  fillColor: bg, margin: [4, 10, 8, 10] },
      { text: `${l.quantite} ${l.unite}`,   alignment: 'center', fontSize: 9, color: darkText, fillColor: bg, margin: [4, 10, 4, 10] },
      { text: pdfCurrency(l.total),         alignment: 'right', bold: true, fontSize: 9.5, color: navy, fillColor: bg, margin: [4, 10, 8, 10] },
    ];
  });

  const prestationsTable = {
    table: {
      widths: ['*', 100, 80, 90],
      body: [
        [
          { text: 'DESCRIPTION',   bold: true, fillColor: navy, color: white, fontSize: 8.5, margin: [8, 9, 8, 9] },
          { text: 'PRIX UNITAIRE', bold: true, fillColor: navy, color: white, fontSize: 8.5, alignment: 'right',  margin: [4, 9, 8, 9] },
          { text: 'QUANTITE',      bold: true, fillColor: navy, color: white, fontSize: 8.5, alignment: 'center', margin: [4, 9, 4, 9] },
          { text: 'TOTAL',         bold: true, fillColor: navy, color: white, fontSize: 8.5, alignment: 'right',  margin: [4, 9, 8, 9] },
        ],
        ...tableRows,
      ],
    },
    layout: {
      hLineWidth: (i) => (i === 0 || i === 1) ? 0 : 0.5,
      vLineWidth: () => 0,
      hLineColor: () => '#DDE2EE',
    },
    margin: [0, 0, 0, 0],
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 5. RÈGLEMENT + TOTAUX
  // ══════════════════════════════════════════════════════════════════════════
  const reglement = [
    { text: 'REGLEMENT', fontSize: 7, bold: true, color: orange, characterSpacing: 1.2, margin: [0, 0, 0, 9] },
    { text: s.mode_paiement || 'Par virement bancaire', fontSize: 9, color: darkText },
  ];
  if (s.banque) reglement.push({ text: `Banque : ${s.banque}`,   fontSize: 8.5, color: mutedText, margin: [0, 5, 0, 0] });
  if (s.iban)   reglement.push({ text: `IBAN : ${s.iban}`,       fontSize: 8.5, color: mutedText });
  if (s.bic)    reglement.push({ text: `BIC : ${s.bic}`,         fontSize: 8.5, color: mutedText });
  reglement.push({ text: '', margin: [0, 9, 0, 0] });
  reglement.push({
    text: s.facturation?.mention_tva || 'TVA non applicable — Art. 293 B du CGI',
    fontSize: 8, color: mutedText, italics: true,
  });
  reglement.push({
    text: `Penalites de retard : ${s.facturation?.penalites_taux || 'taux BCE + 10 points'}`,
    fontSize: 7.5, color: mutedText, margin: [0, 4, 0, 0],
  });
  reglement.push({
    text: `Indemnite forfaitaire de recouvrement : ${s.facturation?.indemnite_recouvrement || 40} EUR`,
    fontSize: 7.5, color: mutedText,
  });

  const totaux = {
    table: {
      widths: ['*', 115],
      body: [
        [
          { text: 'TOTAL HT',       fontSize: 9,  color: mutedText, alignment: 'right', fillColor: lightGrey, border: [false, false, false, true], borderColor: [null, null, null, '#D1D5DB'], margin: [8, 11, 8, 11] },
          { text: pdfCurrency(totalHT), fontSize: 9, bold: true, color: darkText, alignment: 'right', fillColor: lightGrey, border: [false, false, false, true], borderColor: [null, null, null, '#D1D5DB'], margin: [4, 11, 10, 11] },
        ],
        [
          { text: 'TVA',            fontSize: 9,  color: mutedText, alignment: 'right', fillColor: lightGrey, border: [false, false, false, true], borderColor: [null, null, null, '#D1D5DB'], margin: [8, 11, 8, 11] },
          { text: 'Non applicable', fontSize: 8,  color: mutedText, alignment: 'right', italics: true, fillColor: lightGrey, border: [false, false, false, true], borderColor: [null, null, null, '#D1D5DB'], margin: [4, 11, 10, 11] },
        ],
        [
          { text: 'NET A PAYER', bold: true, fontSize: 11, color: white, alignment: 'right', fillColor: navy, border: [false, false, false, false], margin: [8, 15, 8, 15] },
          { text: pdfCurrency(totalHT), bold: true, fontSize: 16, color: orange, alignment: 'right', fillColor: navy, border: [false, false, false, false], margin: [4, 15, 10, 15] },
        ],
      ],
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0 : 0.5,
      vLineWidth: () => 0,
      hLineColor: () => '#D1D5DB',
    },
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 6. DOCUMENT
  // ══════════════════════════════════════════════════════════════════════════
  const docDefinition = {
    pageSize: 'A4',
    // Marge top = 0 pour que la bande navy arrive au bord de la page
    pageMargins: [45, 0, 45, 55],
    defaultStyle: { font: 'Roboto', fontSize: 9.5, color: darkText, lineHeight: 1.35 },

    // Tampon "PAYEE" en filigrane
    ...(isPaid ? {
      watermark: {
        text: 'PAYEE',
        color: '#27ae60',
        opacity: 0.07,
        bold: true,
        fontSize: 80,
        angle: -45,
      },
    } : {}),

    footer: () => ({
      stack: [
        { canvas: [{ type: 'line', x1: 45, y1: 0, x2: 550, y2: 0, lineWidth: 0.5, lineColor: '#DDE2EE' }] },
        {
          text: `${s.nom_commercial || 'AVRILA FORMATION'} — SIRET : ${s.siret || ''} — NDA : ${s.nda || ''} — Conditions generales de vente disponibles sur le site de l'organisme.`,
          alignment: 'center', fontSize: 7, color: mutedText, margin: [45, 6, 45, 0],
        },
      ],
    }),

    content: [
      // ① Bande navy header (pleine largeur, commence au bord top)
      headerBand,

      // ② Filet orange
      orangeBar,

      // ③ Émetteur / Facturé à
      addressSection,

      // ④ Bande objet
      objetBand,

      // ⑤ Tableau des prestations
      prestationsTable,

      // ⑥ Séparateur
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 505, y2: 0, lineWidth: 0.5, lineColor: '#DDE2EE' }], margin: [0, 18, 0, 18] },

      // ⑦ Règlement + Totaux
      {
        columns: [
          { stack: reglement, width: '52%' },
          { stack: [totaux],  width: '48%' },
        ],
      },
    ],
  };

  return new Promise((resolve) => {
    pdfMake.createPdf(docDefinition).getBlob(resolve);
  });
}

// ── Construction des lignes de facturation ────────────────────────────────────
function buildLignes(facture, mission) {
  const lignes   = [];
  const sessions = mission.sessions || [];
  const nb       = sessions.length;
  const tarif    = mission.tarif_journalier || 0;

  const sessionDates = sessions
    .map(s => new Date(s.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))
    .join(', ');

  if (nb > 0 && tarif > 0) {
    lignes.push({
      description:   `Animation de formation : ${mission.intitule || 'Formation'}`,
      subtitle:      sessionDates ? `Sessions : ${sessionDates}` : '',
      quantite:      nb,
      unite:         nb > 1 ? 'jours' : 'jour',
      prix_unitaire: tarif,
      total:         nb * tarif,
    });
  }

  if (mission.frais_deplacement > 0) {
    lignes.push({
      description:   'Frais de deplacement',
      subtitle:      'Remboursement forfaitaire',
      quantite:      1,
      unite:         'forfait',
      prix_unitaire: mission.frais_deplacement,
      total:         mission.frais_deplacement,
    });
  }

  return lignes;
}
