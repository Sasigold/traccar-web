## Speeding against the road's limit (SAF-06)

Traccar can look up each position's road speed limit and attach it as `speedLimit`; the overspeed
event then compares against the road, not one fixed threshold. In `traccar.xml`:

```xml
<entry key='speedLimit.type'>overpass</entry>
<entry key='speedLimit.url'>https://overpass-api.de/api/interpreter</entry>
<entry key='speedLimit.accuracy'>100</entry>
<entry key='event.overspeed.minimalDuration'>15</entry>
<entry key='event.overspeed.preferLowest'>true</entry>
```

The public Overpass server has usage limits: for a fleet of more than a few dozen vehicles, run
an own Overpass instance with the Israel extract (or use a commercial speed-limit service), and
point `speedLimit.url` at it. Without it, set `speedLimit` per geofence (school zones, depots) or
per device as before.

The app reads the limit from the event (`speedLimit`) and grades it: up to 10 km/h over is minor,
10–20 medium, more than 20 severe. The safety score and the inbox use the grade.
