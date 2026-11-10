export const prefixString = (prefix, value) =>
  prefix + value.charAt(0).toUpperCase() + value.slice(1);

export const unprefixString = (prefix, value) =>
  value.charAt(prefix.length).toLowerCase() + value.slice(prefix.length + 1);

// ARC-10: the one copy of each name conversion (they were written inline about 50 times).
// "fuel" -> "Fuel"
export const capitalize = (value) => String(value ?? '').replace(/^\w/, (c) => c.toUpperCase());

// "on_road" -> "OnRoad" (a translation key part from a database value)
export const pascalCase = (value) =>
  String(value ?? '').replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase());

// "on_road" -> "onRoad"
export const camelCase = (value) =>
  String(value ?? '').replace(/_(\w)/g, (_, c) => c.toUpperCase());
