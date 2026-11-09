// Removes personal data before anything leaves the browser for an error or analytics service
// (FND-06). Pure, unit-tested. Applied to error messages, stack frame addresses and page addresses.
//
// What goes: tokens and API keys, e-mail addresses, Israeli phone numbers, national ID numbers,
// licence plates, coordinates, and every query string and fragment (share tokens, search terms).
// Numeric and opaque segments of a page address become :id or :token, so "/settings/device/42"
// and "/settings/device/43" are the same page.

const MAX_TEXT = 1000;

const RULES = [
  // JWTs (the fleet session, Traccar tokens).
  [/eyJ[\w-]{4,}\.[\w-]{4,}\.[\w-]{4,}/g, '[token]'],
  // Public API keys (INT-01).
  [/\bvf_[0-9a-f]{40}\b/gi, '[key]'],
  [/\b(bearer|basic)\s+[\w.~+/=-]{8,}/gi, '$1 [token]'],
  // Addresses keep their path, never the query or fragment.
  [/(https?:\/\/[^\s?#"'<>]+)[?#][^\s"'<>]*/gi, '$1'],
  [/\b(token|key|password|secret|code|session|apikey|api_key)=[^\s&"']+/gi, '$1=[redacted]'],
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]'],
  // Coordinates before plain numbers: "32.08531, 34.78177".
  [/-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/g, '[coords]'],
  // Israeli phone numbers: 050-1234567, +972 50 123 4567, 03-1234567.
  [/(?:\+972[\s-]?|\b0)(?:5\d|7\d|[23489])[\s-]?\d{3}[\s-]?\d{4}\b/g, '[phone]'],
  // Licence plates: 12-345-67, 123-45-678, 12-345-678.
  [/\b\d{2,3}-\d{2,3}-\d{2,3}\b/g, '[plate]'],
  // National ID numbers (and any other long number that could identify someone).
  [/\b\d{8,10}\b/g, '[number]'],
];

export const scrubText = (value) => {
  if (value == null) {
    return '';
  }
  let text = String(value);
  RULES.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const templateSegment = (segment) => {
  // Empty, or already a placeholder (the template of a template is the same).
  if (!segment || /^:(id|token|value)$/.test(segment)) {
    return segment;
  }
  if (/^\d+$/.test(segment) || UUID.test(segment)) {
    return ':id';
  }
  // Share links, tracking links, file names with hashes: anything long and opaque.
  if (
    segment.length >= 16 ||
    (/\d/.test(segment) && /[a-z]/i.test(segment) && segment.length >= 8)
  ) {
    return ':token';
  }
  if (!/^[a-z][a-z0-9-]*$/i.test(segment)) {
    return ':value';
  }
  return segment;
};

// "/settings/device/42?tab=x#y" -> "/settings/device/:id"
export const routeTemplate = (pathname) => {
  const path = String(pathname || '/').split(/[?#]/)[0];
  const template = path.split('/').map(templateSegment).join('/').replace(/\/+$/, '');
  return (template.startsWith('/') ? template : `/${template}`).slice(0, 120) || '/';
};

// A frame's script address: no query or fragment, nothing personal.
export const scrubUrl = (url) => scrubText(String(url || '').split(/[?#]/)[0]);
