import { useTheme } from '@mui/material/styles';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';

// One rule for every "previous / next period" pair: previous sits on the start side and points
// back in the reading direction (right in Hebrew), next on the end side.
export const PreviousPeriodIcon = (props) =>
  useTheme().direction === 'rtl' ? (
    <ChevronRightRoundedIcon {...props} />
  ) : (
    <ChevronLeftRoundedIcon {...props} />
  );

export const NextPeriodIcon = (props) =>
  useTheme().direction === 'rtl' ? (
    <ChevronLeftRoundedIcon {...props} />
  ) : (
    <ChevronRightRoundedIcon {...props} />
  );
