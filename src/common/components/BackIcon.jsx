import { useTheme } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardIcon from '@mui/icons-material/ArrowForwardRounded';

const BackIcon = () => {
  const theme = useTheme();
  return theme.direction === 'rtl' ? <ArrowForwardIcon /> : <ArrowBackIcon />;
};

export default BackIcon;
