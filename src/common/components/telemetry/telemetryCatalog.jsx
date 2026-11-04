import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import BatteryChargingFullRoundedIcon from '@mui/icons-material/BatteryChargingFullRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import SensorDoorRoundedIcon from '@mui/icons-material/SensorDoorRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import GpsFixedRoundedIcon from '@mui/icons-material/GpsFixedRounded';
import LocationSearchingRoundedIcon from '@mui/icons-material/LocationSearchingRounded';
import WorkRoundedIcon from '@mui/icons-material/WorkRounded';
import InputRoundedIcon from '@mui/icons-material/InputRounded';
import OutputRoundedIcon from '@mui/icons-material/OutputRounded';
import ToggleOnRoundedIcon from '@mui/icons-material/ToggleOnRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import BatteryStdRoundedIcon from '@mui/icons-material/BatteryStdRounded';
import DeviceThermostatRoundedIcon from '@mui/icons-material/DeviceThermostatRounded';
import LocalGasStationRoundedIcon from '@mui/icons-material/LocalGasStationRounded';
import AvTimerRoundedIcon from '@mui/icons-material/AvTimerRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import AddRoadRoundedIcon from '@mui/icons-material/AddRoadRounded';
import SatelliteAltRoundedIcon from '@mui/icons-material/SatelliteAltRounded';
import SignalCellularAltRoundedIcon from '@mui/icons-material/SignalCellularAltRounded';
import TerrainRoundedIcon from '@mui/icons-material/TerrainRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import ScaleRoundedIcon from '@mui/icons-material/ScaleRounded';
import VibrationRoundedIcon from '@mui/icons-material/VibrationRounded';
import CellTowerRoundedIcon from '@mui/icons-material/CellTowerRounded';
import SimCardRoundedIcon from '@mui/icons-material/SimCardRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import MemoryRoundedIcon from '@mui/icons-material/MemoryRounded';
import LanRoundedIcon from '@mui/icons-material/LanRounded';
import RouterRoundedIcon from '@mui/icons-material/RouterRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import ExploreRoundedIcon from '@mui/icons-material/ExploreRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import DataObjectRoundedIcon from '@mui/icons-material/DataObjectRounded';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import StraightenRoundedIcon from '@mui/icons-material/StraightenRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import DirectionsWalkRoundedIcon from '@mui/icons-material/DirectionsWalkRounded';
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded';
import PercentRoundedIcon from '@mui/icons-material/PercentRounded';
import NumbersRoundedIcon from '@mui/icons-material/NumbersRounded';
import EnergySavingsLeafRoundedIcon from '@mui/icons-material/EnergySavingsLeafRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import PrecisionManufacturingRoundedIcon from '@mui/icons-material/PrecisionManufacturingRounded';
import ElectricMeterRoundedIcon from '@mui/icons-material/ElectricMeterRounded';

// Sections of the telemetry dashboard, in display order.
export const sections = [
  { key: 'power', title: 'telemetryPower', icon: <BoltRoundedIcon /> },
  { key: 'engine', title: 'telemetryEngine', icon: <PrecisionManufacturingRoundedIcon /> },
  { key: 'trip', title: 'telemetryTrip', icon: <RouteRoundedIcon /> },
  { key: 'location', title: 'telemetryLocation', icon: <SatelliteAltRoundedIcon /> },
  { key: 'sensors', title: 'telemetrySensors', icon: <SensorsRoundedIcon /> },
  { key: 'device', title: 'telemetryDevice', icon: <InfoRoundedIcon /> },
  { key: 'other', title: 'telemetryOther', icon: <DataObjectRoundedIcon /> },
];

// Boolean states shown as status chips. `alertWhen` marks the state that needs
// attention (a blocked engine, an invalid fix).
export const states = {
  ignition: { icon: <KeyRoundedIcon /> },
  motion: { icon: <DirectionsCarRoundedIcon /> },
  charge: { icon: <BatteryChargingFullRoundedIcon /> },
  blocked: { icon: <BlockRoundedIcon />, alertWhen: true },
  armed: { icon: <ShieldRoundedIcon /> },
  door: { icon: <SensorDoorRoundedIcon /> },
  lock: { icon: <LockRoundedIcon /> },
  roaming: { icon: <PublicRoundedIcon /> },
  valid: { icon: <GpsFixedRoundedIcon />, alertWhen: false },
  approximate: { icon: <LocationSearchingRoundedIcon /> },
  business: { icon: <WorkRoundedIcon /> },
  archive: { icon: <ArchiveRoundedIcon /> },
  in1: { icon: <InputRoundedIcon /> },
  in2: { icon: <InputRoundedIcon /> },
  in3: { icon: <InputRoundedIcon /> },
  in4: { icon: <InputRoundedIcon /> },
  out1: { icon: <OutputRoundedIcon /> },
  out2: { icon: <OutputRoundedIcon /> },
  out3: { icon: <OutputRoundedIcon /> },
  out4: { icon: <OutputRoundedIcon /> },
};

export const defaultStateIcon = <ToggleOnRoundedIcon />;

// Metric tiles. `kind` picks the visual:
// - percent: level bar 0..100 %
// - battery: battery glyph 0..100 %
// - voltage: level bar against a 12 V or 24 V system
// - temperature: level bar -20..130 °C
// - satellites / signal: signal bars
// - odometer: rolling counter digits
// - value: formatted value only
export const metrics = {
  // Power and energy
  batteryLevel: { section: 'power', kind: 'battery', icon: <BatteryStdRoundedIcon /> },
  power: { section: 'power', kind: 'voltage', icon: <BoltRoundedIcon /> },
  battery: { section: 'power', kind: 'voltage', icon: <BatteryStdRoundedIcon />, cell: true },
  energyLevel: { section: 'power', kind: 'percent', icon: <EnergySavingsLeafRoundedIcon /> },
  energy: { section: 'power', kind: 'value', icon: <ElectricMeterRoundedIcon /> },

  // Engine and fuel
  coolantTemp: { section: 'engine', kind: 'temperature', icon: <DeviceThermostatRoundedIcon /> },
  engineTemp: { section: 'engine', kind: 'temperature', icon: <DeviceThermostatRoundedIcon /> },
  engineLoad: { section: 'engine', kind: 'percent', icon: <PercentRoundedIcon />, high: true },
  throttle: { section: 'engine', kind: 'percent', icon: <SpeedRoundedIcon />, high: true },
  fuel: { section: 'engine', kind: 'value', icon: <LocalGasStationRoundedIcon /> },
  fuelLevel: { section: 'engine', kind: 'percent', icon: <LocalGasStationRoundedIcon /> },
  fuelConsumption: { section: 'engine', kind: 'value', icon: <LocalGasStationRoundedIcon /> },
  fuelUsed: { section: 'engine', kind: 'value', icon: <LocalGasStationRoundedIcon /> },
  obdSpeed: { section: 'engine', kind: 'value', icon: <SpeedRoundedIcon /> },
  hours: { section: 'engine', kind: 'value', icon: <AvTimerRoundedIcon /> },
  dtcs: { section: 'engine', kind: 'value', icon: <BuildRoundedIcon />, small: true },

  // Trip and distance
  totalDistance: { section: 'trip', kind: 'odometer', icon: <AddRoadRoundedIcon /> },
  odometer: { section: 'trip', kind: 'odometer', icon: <AddRoadRoundedIcon /> },
  obdOdometer: { section: 'trip', kind: 'odometer', icon: <AddRoadRoundedIcon /> },
  tripOdometer: { section: 'trip', kind: 'value', icon: <RouteRoundedIcon /> },
  serviceOdometer: { section: 'trip', kind: 'value', icon: <BuildRoundedIcon /> },
  distance: { section: 'trip', kind: 'value', icon: <StraightenRoundedIcon /> },
  drivingTime: { section: 'trip', kind: 'value', icon: <TimerRoundedIcon /> },
  driverUniqueId: { section: 'trip', kind: 'value', icon: <PersonRoundedIcon /> },
  steps: { section: 'trip', kind: 'value', icon: <DirectionsWalkRoundedIcon /> },

  // Location and connectivity
  sat: { section: 'location', kind: 'satellites', icon: <SatelliteAltRoundedIcon /> },
  satVisible: { section: 'location', kind: 'satellites', icon: <SatelliteAltRoundedIcon /> },
  rssi: { section: 'location', kind: 'signal', icon: <SignalCellularAltRoundedIcon /> },
  hdop: { section: 'location', kind: 'value', icon: <GpsFixedRoundedIcon /> },
  vdop: { section: 'location', kind: 'value', icon: <GpsFixedRoundedIcon /> },
  pdop: { section: 'location', kind: 'value', icon: <GpsFixedRoundedIcon /> },
  accuracy: { section: 'location', kind: 'value', icon: <MyLocationRoundedIcon /> },
  altitude: { section: 'location', kind: 'value', icon: <TerrainRoundedIcon /> },
  course: { section: 'location', kind: 'value', icon: <ExploreRoundedIcon /> },
  latitude: { section: 'location', kind: 'value', icon: <PlaceRoundedIcon />, small: true },
  longitude: { section: 'location', kind: 'value', icon: <PlaceRoundedIcon />, small: true },
  operator: { section: 'location', kind: 'value', icon: <CellTowerRoundedIcon />, small: true },
  gps: { section: 'location', kind: 'value', icon: <GpsFixedRoundedIcon /> },

  // Sensors
  temp1: { section: 'sensors', kind: 'temperature', icon: <DeviceThermostatRoundedIcon /> },
  temp2: { section: 'sensors', kind: 'temperature', icon: <DeviceThermostatRoundedIcon /> },
  temp3: { section: 'sensors', kind: 'temperature', icon: <DeviceThermostatRoundedIcon /> },
  temp4: { section: 'sensors', kind: 'temperature', icon: <DeviceThermostatRoundedIcon /> },
  deviceTemp: { section: 'sensors', kind: 'temperature', icon: <DeviceThermostatRoundedIcon /> },
  humidity: { section: 'sensors', kind: 'percent', icon: <WaterDropRoundedIcon /> },
  axleWeight: { section: 'sensors', kind: 'value', icon: <ScaleRoundedIcon /> },
  acceleration: { section: 'sensors', kind: 'value', icon: <VibrationRoundedIcon /> },
  gSensor: { section: 'sensors', kind: 'value', icon: <VibrationRoundedIcon />, small: true },
  heartRate: { section: 'sensors', kind: 'value', icon: <FavoriteRoundedIcon /> },
  input: { section: 'sensors', kind: 'value', icon: <InputRoundedIcon /> },
  output: { section: 'sensors', kind: 'value', icon: <OutputRoundedIcon /> },

  // Device and SIM
  protocol: { section: 'device', kind: 'value', icon: <RouterRoundedIcon />, small: true },
  versionFw: { section: 'device', kind: 'value', icon: <MemoryRoundedIcon />, small: true },
  versionHw: { section: 'device', kind: 'value', icon: <MemoryRoundedIcon />, small: true },
  iccid: { section: 'device', kind: 'value', icon: <SimCardRoundedIcon />, small: true },
  phone: { section: 'device', kind: 'value', icon: <PhoneRoundedIcon />, small: true },
  ip: { section: 'device', kind: 'value', icon: <LanRoundedIcon />, small: true },
  vin: { section: 'device', kind: 'value', icon: <CreditCardRoundedIcon />, small: true },
  card: { section: 'device', kind: 'value', icon: <CreditCardRoundedIcon />, small: true },
  deviceTime: { section: 'device', kind: 'value', icon: <AccessTimeRoundedIcon />, small: true },
  serverTime: { section: 'device', kind: 'value', icon: <AccessTimeRoundedIcon />, small: true },
};

export const genericIcon = (value) =>
  typeof value === 'number' ? <NumbersRoundedIcon /> : <DataObjectRoundedIcon />;

// Keys rendered elsewhere on the dashboard (hero, header, alarm banner) or that
// carry no information for a person.
export const consumed = new Set([
  'id',
  'deviceId',
  'attributes',
  'outdated',
  'speed',
  'course',
  'rpm',
  'address',
  'fixTime',
  'alarm',
  'event',
  'speedLimit',
]);
