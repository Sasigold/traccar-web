// Vector map styles (OpenFreeMap, LocationIQ) label places with their Latin / English name
// (`name:latin`, `name_en`). The tiles also carry the names in each language, so before a
// style is handed to MapLibre we point every text label at the UI language instead.

// OpenMapTiles-based tiles use `name:xx`, LocationIQ uses `name_xx`; `get` on a missing
// property yields null, which `coalesce` skips, so one expression covers both conventions.
export const localizedNameExpression = (language) => [
  'coalesce',
  ['get', `name:${language}`],
  ['get', `name_${language}`],
  ['get', 'name'],
  ['get', 'name:latin'],
  ['get', 'name_en'],
];

const nameToken = /\{name[^}]*\}/;

const referencesName = (textField) => {
  if (typeof textField === 'string') {
    return nameToken.test(textField);
  }
  if (Array.isArray(textField)) {
    if (
      textField[0] === 'get' &&
      typeof textField[1] === 'string' &&
      /^name([:_]|$)/.test(textField[1])
    ) {
      return true;
    }
    return textField.some(referencesName);
  }
  return false;
};

export const localizeStyle = (style, language) => {
  if (!style?.layers || !language) {
    return style;
  }
  const expression = localizedNameExpression(language);
  return {
    ...style,
    layers: style.layers.map((layer) => {
      const textField = layer.layout?.['text-field'];
      if (layer.type !== 'symbol' || !referencesName(textField)) {
        return layer;
      }
      return { ...layer, layout: { ...layer.layout, 'text-field': expression } };
    }),
  };
};
