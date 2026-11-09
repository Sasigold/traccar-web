// The app's translation function for code outside React (error messages, exported files).
// LocalizationProvider sets it whenever the language changes.
let current = (key) => key;

export const setTranslator = (t) => {
  current = t;
};

export const translate = (key) => current(key);
