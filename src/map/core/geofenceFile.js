import { stringify } from 'wellknown';

// LIV-19: a geofence from a file: GPX (track or route), KML (polygon or line) or GeoJSON.
// Returns { name, area } in Traccar's WKT ("lat lon"), or throws an Error whose message is a
// translation key: 'geofenceFileEmpty' when nothing in the file is a shape,
// 'geofenceFileUnsupported' for another format.

const toLatLon = (geometry) => {
  const swap = (it) =>
    typeof it[0] === 'number' ? [Number(it[1]), Number(it[0])] : it.map((inner) => swap(inner));
  return { ...geometry, coordinates: swap(geometry.coordinates) };
};

const fail = (key) => {
  throw new Error(key);
};

const baseName = (fileName) => fileName.replace(/\.[^.]+$/, '');

const parseXml = (text) => {
  const xml = new DOMParser().parseFromString(text, 'text/xml');
  if (xml.getElementsByTagName('parsererror').length) fail('geofenceFileEmpty');
  return xml;
};

const firstText = (node, tag) => node.getElementsByTagName(tag)[0]?.textContent?.trim() || null;

const fromGpx = (text) => {
  const xml = parseXml(text);
  const points = [
    ...Array.from(xml.getElementsByTagName('trkpt')),
    ...(xml.getElementsByTagName('trkpt').length
      ? []
      : Array.from(xml.getElementsByTagName('rtept'))),
  ];
  const coordinates = points
    .map((point) => [Number(point.getAttribute('lon')), Number(point.getAttribute('lat'))])
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  if (coordinates.length < 2) fail('geofenceFileEmpty');
  const track = xml.getElementsByTagName('trk')[0] || xml.getElementsByTagName('rte')[0];
  return { name: track && firstText(track, 'name'), geometry: { type: 'LineString', coordinates } };
};

const kmlCoordinates = (node) =>
  (node?.getElementsByTagName('coordinates')[0]?.textContent || '')
    .trim()
    .split(/\s+/)
    .map((tuple) => tuple.split(',').slice(0, 2).map(Number))
    .filter((pair) => pair.length === 2 && pair.every(Number.isFinite));

const fromKml = (text) => {
  const xml = parseXml(text);
  const placemark = xml.getElementsByTagName('Placemark')[0] || xml;
  const name = firstText(placemark, 'name');
  const polygon = placemark.getElementsByTagName('Polygon')[0];
  if (polygon) {
    const ring = kmlCoordinates(polygon.getElementsByTagName('outerBoundaryIs')[0] || polygon);
    if (ring.length >= 4) return { name, geometry: { type: 'Polygon', coordinates: [ring] } };
  }
  const line = kmlCoordinates(placemark.getElementsByTagName('LineString')[0]);
  if (line.length >= 2) return { name, geometry: { type: 'LineString', coordinates: line } };
  return fail('geofenceFileEmpty');
};

const stripAltitude = (it) =>
  typeof it[0] === 'number' ? it.slice(0, 2) : it.map((inner) => stripAltitude(inner));

const fromGeoJson = (text) => {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return fail('geofenceFileEmpty');
  }
  const feature =
    json.type === 'FeatureCollection'
      ? json.features?.find((item) => ['Polygon', 'LineString'].includes(item.geometry?.type))
      : json.type === 'Feature'
        ? json
        : { geometry: json };
  const geometry = feature?.geometry;
  if (!geometry || !['Polygon', 'LineString'].includes(geometry.type)) fail('geofenceFileEmpty');
  return {
    name: feature.properties?.name || null,
    geometry: { type: geometry.type, coordinates: stripAltitude(geometry.coordinates) },
  };
};

export const GEOFENCE_FILE_TYPES = '.gpx,.kml,.geojson,.json';

export const parseGeofenceFile = (fileName, text) => {
  const extension = fileName.split('.').pop().toLowerCase();
  const parser = { gpx: fromGpx, kml: fromKml, geojson: fromGeoJson, json: fromGeoJson }[extension];
  if (!parser) fail('geofenceFileUnsupported');
  const { name, geometry } = parser(text);
  return { name: name || baseName(fileName), area: stringify(toLatLon(geometry)) };
};
