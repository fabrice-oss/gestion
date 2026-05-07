// ⚠️ Remplacez CLIENT_ID par votre Client ID Google Cloud Console
// URL de production : https://fabrice-oss.github.io/avrila-formation
export const CONFIG = {
  CLIENT_ID: '764252678223-p9b5s3c4q5f100sqv7gkiee3ffs8mefn.apps.googleusercontent.com',
  SCOPES: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.profile',
  ].join(' '),
  DRIVE_FOLDER_NAME: 'AVRILA FORMATION',
  CALENDAR_ID: 'primary', // Sera remplacé par l'ID du calendrier formations dans Paramètres

  ORGANISME: {
    nom_commercial: 'AVRILA FORMATION',
    dirigeant: 'Fabrice Avrila',
    adresse: '41 Rue George Sand',
    cp: '95310',
    ville: 'Saint-Ouen-l\'Aumône',
    tel: '07 44 82 75 24',
    email: 'fabriceformation@avrila.fr',
    siret: '825 032 212 00011',
    naf: '8559A',
    nda: '11950816395',
    forme_juridique: 'Auto-entrepreneur',
    iban: '',
    bic: '',
    banque: '',
  },

  FACTURATION: {
    prefixe: 'AF',
    delai_paiement_jours: 45,
    penalites_taux: 'taux directeur de la BCE majoré de 10 points',
    indemnite_recouvrement: 40,
    mention_tva: 'TVA non applicable, art. 293 B du CGI',
  },
};

