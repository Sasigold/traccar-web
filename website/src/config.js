// Site settings. Fill these in before going live.

export const site = {
  // Where "כניסה למערכת" points: the viper fleet web app.
  appUrl: 'https://traccar-ovjj.srv2122641.hstgr.cloud/',
  // Demo requests. The form tries, in this order:
  //   leadEndpoint: an HTTPS URL that accepts a JSON POST and answers 2xx (a Supabase edge
  //     function, Make / Zapier webhook or form service). This is the only channel that delivers
  //     the lead without the visitor doing anything more.
  //   whatsapp: a sales number (05X-XXXXXXX); the visitor's WhatsApp opens with the details.
  //   contactEmail: opens the visitor's mail app (does nothing for webmail users).
  // With none set the form says it can't send, instead of pretending it did.
  leadEndpoint: '',
  whatsapp: '',
  contactEmail: '',
  // Optional phone number shown in the contact section, e.g. '03-0000000'.
  phone: '',
  // The accessibility coordinator, shown in the accessibility statement (A11-07). Required by the
  // service accessibility regulations: fill in before going live.
  accessibility: { name: '', phone: '', email: '' },
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
