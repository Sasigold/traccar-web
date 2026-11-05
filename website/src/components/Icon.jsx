// Material Symbols Rounded, weight 600 (BRAND.md, section 6). Only the icons
// the site uses are bundled, as inline SVG that takes the current text color.
import speed from '@material-symbols/svg-600/rounded/speed.svg?raw';
import gas from '@material-symbols/svg-600/rounded/local_gas_station.svg?raw';
import warning from '@material-symbols/svg-600/rounded/warning.svg?raw';
import fence from '@material-symbols/svg-600/rounded/fence.svg?raw';
import key from '@material-symbols/svg-600/rounded/key.svg?raw';
import build from '@material-symbols/svg-600/rounded/build.svg?raw';
import flag from '@material-symbols/svg-600/rounded/flag.svg?raw';
import person from '@material-symbols/svg-600/rounded/person.svg?raw';
import pin from '@material-symbols/svg-600/rounded/location_on.svg?raw';
import route from '@material-symbols/svg-600/rounded/route.svg?raw';
import bell from '@material-symbols/svg-600/rounded/notifications.svg?raw';
import chart from '@material-symbols/svg-600/rounded/bar_chart.svg?raw';
import history from '@material-symbols/svg-600/rounded/history.svg?raw';
import doc from '@material-symbols/svg-600/rounded/description.svg?raw';
import badge from '@material-symbols/svg-600/rounded/badge.svg?raw';
import share from '@material-symbols/svg-600/rounded/share.svg?raw';
import lock from '@material-symbols/svg-600/rounded/lock.svg?raw';
import phone from '@material-symbols/svg-600/rounded/mobile.svg?raw';
import devices from '@material-symbols/svg-600/rounded/devices.svg?raw';
import send from '@material-symbols/svg-600/rounded/send.svg?raw';
import satellite from '@material-symbols/svg-600/rounded/satellite_alt.svg?raw';
import thermo from '@material-symbols/svg-600/rounded/thermostat.svg?raw';
import check from '@material-symbols/svg-600/rounded/check.svg?raw';
import arrow from '@material-symbols/svg-600/rounded/arrow_back.svg?raw';
import south from '@material-symbols/svg-600/rounded/south.svg?raw';
import bolt from '@material-symbols/svg-600/rounded/bolt.svg?raw';
import shield from '@material-symbols/svg-600/rounded/admin_panel_settings.svg?raw';
import timer from '@material-symbols/svg-600/rounded/timer.svg?raw';
import plus from '@material-symbols/svg-600/rounded/add.svg?raw';

const icons = {
  speed,
  gas,
  warning,
  fence,
  key,
  build,
  flag,
  person,
  pin,
  route,
  bell,
  chart,
  history,
  doc,
  badge,
  share,
  lock,
  phone,
  devices,
  send,
  satellite,
  thermo,
  check,
  arrow,
  south,
  bolt,
  shield,
  timer,
  plus,
};

// The raw files are a single path on Material's 0 -960 960 960 canvas.
const pathOf = (raw) => raw.match(/ d="([^"]+)"/)[1];

const Icon = ({ name, size = 20, className = '' }) => (
  <span className={`ico ${className}`} style={{ width: size, height: size }} aria-hidden="true">
    <svg viewBox="0 -960 960 960" focusable="false">
      <path d={pathOf(icons[name])} />
    </svg>
  </span>
);

export default Icon;
