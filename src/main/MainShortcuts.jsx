import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { devicesActions } from '../store';
import { shortcutAllowed } from '../common/util/keyboard';
import { useRestriction } from '../common/util/permissions';

const CommandDialog = lazy(() => import('../common/components/commands/CommandDialog'));

// The next or previous vehicle in the list's order (wrapping), or the first one.
export const nextVehicle = (devices, selectedId, step) => {
  if (!devices.length) return null;
  const index = devices.findIndex((device) => device.id === selectedId);
  if (index < 0) return devices[step > 0 ? 0 : devices.length - 1].id;
  return devices[(index + step + devices.length) % devices.length].id;
};

// LIV-15: single keys on the map (by physical key, so a Hebrew layout works too): J and K the
// next and previous vehicle in the list, R today's replay of the selected one, C a command to
// it. F (follow) and 0 (whole fleet) live with the map; "?" lists them all.
const MainShortcuts = ({ devices }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const readonly = useRestriction('readonly');
  const selectedId = useSelector((state) => state.devices.selectedId);
  const [commandFor, setCommandFor] = useState(null);
  const latestRef = useRef({ devices, selectedId });
  latestRef.current = { devices, selectedId };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.shiftKey || !shortcutAllowed(event)) return;
      const { devices: list, selectedId: current } = latestRef.current;
      switch (event.code) {
        case 'KeyJ':
        case 'KeyK': {
          const id = nextVehicle(list, current, event.code === 'KeyJ' ? 1 : -1);
          if (id != null) {
            event.preventDefault();
            dispatch(devicesActions.selectId(id));
          }
          break;
        }
        case 'KeyR':
          if (current) {
            event.preventDefault();
            navigate(`/replay?deviceId=${current}`);
          }
          break;
        case 'KeyC':
          if (current && !readonly) {
            event.preventDefault();
            setCommandFor(current);
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, navigate, readonly]);

  return commandFor ? (
    <Suspense fallback={null}>
      <CommandDialog deviceId={commandFor} onClose={() => setCommandFor(null)} />
    </Suspense>
  ) : null;
};

export default MainShortcuts;
