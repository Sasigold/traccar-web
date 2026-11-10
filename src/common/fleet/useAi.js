import { useSelector } from 'react-redux';

// AI is offered only when this fleet database has it (fleet_features lists 'ai') and the fleet
// session is up. Unlike other areas, unknown means no: a call would only fail.
export const useAiAvailable = () =>
  useSelector(
    (state) => state.fleet.status === 'ready' && Boolean(state.fleet.features?.includes('ai')),
  );
