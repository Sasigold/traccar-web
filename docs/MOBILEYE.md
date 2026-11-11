# Mobileye in the safety score (ISR-08)

Many Israeli fleets already have Mobileye installed. Its warnings count in the driver's safety
score and show in the safety inbox once they reach Traccar as **alarm events** with one of
these names (`MOBILEYE_ALARMS` in `src/common/fleet/safety.js`):

| Warning | Alarm names accepted | Default weight |
|---|---|---|
| Forward collision (FCW) | `forwardCollision`, `fcw` | 25 |
| Pedestrian collision (PCW) | `pedestrianCollision`, `pcw` | 30 |
| Headway monitoring (HMW) | `headwayWarning`, `headway`, `hmw` | 8 |
| Lane departure (LDW) | `laneDeparture`, `ldw`, Traccar's `laneChange` | 5 |

Weights are per event per 100 km, like the other events, and each organization can change them
on the safety screen (the numbers are parameters, not law).

## Getting the warnings into Traccar

How the warnings arrive depends on the tracker:

- **Trackers that decode Mobileye themselves** (for example over the CAN or a Mobileye port)
  report an alarm or an IO element per warning.
- **Otherwise**, wire the Mobileye outputs to the tracker's digital inputs, and turn them into
  alarms with a Traccar **computed attribute** on the device (or its group): attribute `alarm`,
  type string, and an expression that names the warning, for example
  `in2 ? "fcw" : (in3 ? "ldw" : (in4 ? "hmw" : null))` (the input numbers follow the
  installation). Traccar then creates an `alarm` event for each, and the safety score counts it.

Check one installation in the vehicle's live screen (the event list) before rolling out.

## Left for later

- Using the government registry of vehicles eligible for an insurance discount with Mobileye, to
  offer the customer the discount.
