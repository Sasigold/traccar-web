// Site settings. Fill these in before going live.

export const site = {
  // Where "כניסה למערכת" points: the viper fleet web app.
  appUrl: '/',
  // Demo requests from the contact form open an email to this address.
  // TODO: set the real sales address.
  contactEmail: '',
  // Optional phone number shown in the contact section, e.g. '03-0000000'.
  phone: '',
};

// Screenshots. Drop the image files into website/public/screens/ and set `src`
// (for example 'screens/map.png'). An empty src keeps the designed placeholder.
// Recommended sizes are in `size`; export at 2x for sharp results.
export const screens = {
  hero: { src: '', label: 'מפה חיה, מסך ראשי', size: '2880 × 1800', ratio: '16 / 10' },
  map: { src: '', label: 'מפה חיה', size: '2880 × 1800', ratio: '16 / 10' },
  replay: { src: '', label: 'היסטוריה ושחזור מסלול', size: '2880 × 1800', ratio: '16 / 10' },
  alerts: { src: '', label: 'התראות ואירועים', size: '2880 × 1800', ratio: '16 / 10' },
  reports: { src: '', label: 'דוחות', size: '2880 × 1800', ratio: '16 / 10' },
  fleet: { src: '', label: 'ניהול צי, רכבים ומסמכים', size: '2880 × 1800', ratio: '16 / 10' },
  mobileMap: { src: '', label: 'מפה בנייד', size: '1179 × 2556', ratio: '9 / 19.5' },
  mobileDevice: { src: '', label: 'כרטיס רכב בנייד', size: '1179 × 2556', ratio: '9 / 19.5' },
};
