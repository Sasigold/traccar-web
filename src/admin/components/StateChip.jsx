import { Chip } from '@mui/material';

// Status chip for customers, subscriptions and bills. Tones map to the
// operational status colors only.
const tones = {
  active: 'success',
  online: 'success',
  paid: 'success',
  trial: 'info',
  issued: 'info',
  draft: 'default',
  paused: 'warning',
  suspended: 'warning',
  overdue: 'error',
  offline: 'error',
  cancelled: 'default',
  archived: 'default',
  unknown: 'default',
};

const StateChip = ({ state, label }) => (
  <Chip
    size="small"
    variant={tones[state] === 'default' ? 'filled' : 'outlined'}
    color={tones[state] || 'default'}
    label={label}
  />
);

export default StateChip;
