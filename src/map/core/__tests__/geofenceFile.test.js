// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseGeofenceFile } from '../geofenceFile';

// LIV-19: geofences from GPX, KML and GeoJSON files.
const gpx = `<?xml version="1.0"?>
<gpx><trk><name>מסלול חלוקה</name><trkseg>
<trkpt lat="32.1" lon="34.8"/><trkpt lat="32.2" lon="34.9"/>
</trkseg></trk></gpx>`;

describe('a geofence from a file', () => {
  it('reads a GPX track as a line, in lat-lon order, with its name', () => {
    expect(parseGeofenceFile('route.gpx', gpx)).toEqual({
      name: 'מסלול חלוקה',
      area: 'LINESTRING (32.1 34.8, 32.2 34.9)',
    });
  });

  it('reads a GPX route when there is no track, named after the file', () => {
    const route = '<gpx><rte><rtept lat="31" lon="35"/><rtept lat="31.5" lon="35.5"/></rte></gpx>';
    expect(parseGeofenceFile('north.gpx', route)).toEqual({
      name: 'north',
      area: 'LINESTRING (31 35, 31.5 35.5)',
    });
  });

  it('says a GPX without a track or route has no path', () => {
    expect(() => parseGeofenceFile('empty.gpx', '<gpx><wpt lat="1" lon="2"/></gpx>')).toThrow(
      'geofenceFileEmpty',
    );
    expect(() => parseGeofenceFile('broken.gpx', '<gpx><trk>')).toThrow('geofenceFileEmpty');
  });

  it('reads a KML polygon, dropping the altitude', () => {
    const kml = `<kml><Placemark><name>מחסן</name><Polygon><outerBoundaryIs><LinearRing><coordinates>
      34.8,32.1,0 34.9,32.1,0 34.9,32.2,0 34.8,32.1,0
    </coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`;
    expect(parseGeofenceFile('depot.kml', kml)).toEqual({
      name: 'מחסן',
      area: 'POLYGON ((32.1 34.8, 32.1 34.9, 32.2 34.9, 32.1 34.8))',
    });
  });

  it('reads a GeoJSON feature collection', () => {
    const json = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [1, 2] } },
        {
          type: 'Feature',
          properties: { name: 'אזור' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [34.8, 32.1, 5],
                [34.9, 32.1, 5],
                [34.9, 32.2, 5],
                [34.8, 32.1, 5],
              ],
            ],
          },
        },
      ],
    });
    expect(parseGeofenceFile('zone.geojson', json)).toEqual({
      name: 'אזור',
      area: 'POLYGON ((32.1 34.8, 32.1 34.9, 32.2 34.9, 32.1 34.8))',
    });
  });

  it('refuses other formats and files without a shape', () => {
    expect(() => parseGeofenceFile('notes.txt', 'x')).toThrow('geofenceFileUnsupported');
    expect(() => parseGeofenceFile('x.geojson', '{"type":"Point","coordinates":[1,2]}')).toThrow(
      'geofenceFileEmpty',
    );
    expect(() => parseGeofenceFile('x.json', 'not json')).toThrow('geofenceFileEmpty');
  });
});
