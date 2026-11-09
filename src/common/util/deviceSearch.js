// Vehicle search shared by the live list and the quick search (Ctrl+K).
//
// Dispatchers look a vehicle up by its plate number, its driver or its group as often as by its
// name, so every one of those is searched. Text is compared after normalization: letter case,
// Hebrew final letters (ם/מ), niqqud and accents do not count, and a plate matches on its digits
// alone ("1234567" finds "12-345-67").

const FINALS = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const PUNCTUATION = { '׳': "'", '״': '"' };
// Latin combining accents, and Hebrew cantillation marks and niqqud.
const MARK = /[̀-֑ͯ-ׇֽֿׁׂׅׄ]/;

const normalizeChar = (char) => {
  let out = '';
  for (const part of char.normalize('NFKD')) {
    if (!MARK.test(part)) {
      out += FINALS[part] || PUNCTUATION[part] || part.toLowerCase();
    }
  }
  return out;
};

export const normalizeSearch = (value) => {
  let out = '';
  for (const char of String(value ?? '')) {
    out += normalizeChar(char);
  }
  return out;
};

export const tokenizeSearch = (query) =>
  normalizeSearch(query)
    .split(/\s+/)
    .filter((token) => token.length > 0);

const DIGIT_TOKEN = /^[\d\-./]+$/;
const digitsOf = (value) => value.replace(/\D/g, '');

// Normalized text with, for every normalized character, the index of the original character it
// came from; used to map a match back for highlighting.
const indexed = (text) => {
  let normalized = '';
  const origin = [];
  let index = 0;
  for (const char of text) {
    const part = normalizeChar(char);
    for (let i = 0; i < part.length; i += 1) {
      origin.push(index);
    }
    normalized += part;
    index += char.length;
  }
  origin.push(index);
  return { normalized, origin };
};

const isWordStart = (text, at) => at === 0 || !/[\p{L}\p{N}]/u.test(text[at - 1]);

// Where a token matches inside a text: { start, end, rank } in original character offsets, or
// null. rank 3: the text starts with it, 2: a word starts with it, 1: anywhere inside.
export const locateToken = (text, token, digits = false) => {
  if (!text || !token) {
    return null;
  }
  const value = String(text);
  const { normalized, origin } = indexed(value);
  const at = normalized.indexOf(token);
  if (at >= 0) {
    const span = (i, rank) => ({ start: origin[i], end: origin[i + token.length], rank });
    if (at === 0) {
      return span(0, 3);
    }
    // A later word start ranks above an earlier hit inside a word.
    for (let i = at; i >= 0; i = normalized.indexOf(token, i + 1)) {
      if (isWordStart(normalized, i)) {
        return span(i, 2);
      }
    }
    return span(at, 1);
  }
  if (digits && DIGIT_TOKEN.test(token)) {
    const wanted = digitsOf(token);
    if (wanted.length < 2) {
      return null;
    }
    const positions = [];
    for (let i = 0; i < value.length; i += 1) {
      if (value[i] >= '0' && value[i] <= '9') {
        positions.push(i);
      }
    }
    const found = digitsOf(value).indexOf(wanted);
    if (found < 0) {
      return null;
    }
    return {
      start: positions[found],
      end: positions[found + wanted.length - 1] + 1,
      rank: found === 0 ? 3 : 1,
    };
  }
  return null;
};

// The searchable fields of a vehicle, the most telling first. weight breaks ties between equal
// ranks: a hit in the name or the plate beats one in the phone number.
export const deviceSearchFields = (device, { groups = {}, drivers = {}, position } = {}) => {
  const fields = [
    { key: 'name', value: device.name, weight: 3 },
    { key: 'plate', value: device.attributes?.plateNumber, weight: 3, digits: true },
  ];
  const driverUniqueId = position?.attributes?.driverUniqueId;
  if (driverUniqueId) {
    fields.push({ key: 'driver', value: drivers[driverUniqueId]?.name, weight: 2 });
    fields.push({ key: 'driver', value: driverUniqueId, weight: 1 });
  }
  let { groupId } = device;
  const seen = new Set();
  while (groupId && !seen.has(groupId)) {
    seen.add(groupId);
    fields.push({ key: 'group', value: groups[groupId]?.name, weight: 1 });
    groupId = groups[groupId]?.groupId || 0;
  }
  fields.push(
    { key: 'uniqueId', value: device.uniqueId, weight: 1, digits: true },
    { key: 'phone', value: device.phone, weight: 1, digits: true },
    { key: 'model', value: device.model, weight: 0 },
    { key: 'contact', value: device.contact, weight: 0 },
  );
  return fields.filter((field) => field.value);
};

// Every token has to match some field. Returns null when the vehicle does not match, otherwise
// { score, fields }: a higher score sorts first, fields lists the keys and values that matched.
export const matchDevice = (tokens, fields) => {
  if (!tokens.length) {
    return { score: 0, fields: [] };
  }
  let score = 0;
  const matched = [];
  for (const token of tokens) {
    let best = null;
    for (const field of fields) {
      const hit = locateToken(field.value, token, field.digits);
      if (hit) {
        const value = hit.rank * 10 + field.weight;
        if (!best || value > best.value) {
          best = { value, field };
        }
      }
    }
    if (!best) {
      return null;
    }
    score += best.value;
    if (!matched.some((item) => item.key === best.field.key && item.value === best.field.value)) {
      matched.push({ key: best.field.key, value: best.field.value });
    }
  }
  return { score, fields: matched };
};

// The parts of a text to highlight for a query: [{ text, match }], adjacent matches merged.
export const highlightParts = (text, tokens, digits = false) => {
  const value = String(text ?? '');
  const ranges = tokens
    .map((token) => locateToken(value, token, digits))
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
  const merged = [];
  ranges.forEach(({ start, end }) => {
    const last = merged.at(-1);
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
    } else {
      merged.push({ start, end });
    }
  });
  const parts = [];
  let cursor = 0;
  merged.forEach(({ start, end }) => {
    if (start > cursor) {
      parts.push({ text: value.slice(cursor, start), match: false });
    }
    parts.push({ text: value.slice(start, end), match: true });
    cursor = end;
  });
  if (cursor < value.length) {
    parts.push({ text: value.slice(cursor), match: false });
  }
  return parts;
};
