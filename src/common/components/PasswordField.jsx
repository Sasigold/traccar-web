import { useState } from 'react';
import { TextField, IconButton, InputAdornment } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useTranslation } from './LocalizationProvider';

const PasswordField = ({ slotProps, ...others }) => {
  const t = useTranslation();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <TextField
      {...others}
      type={showPassword ? 'text' : 'password'}
      slotProps={{
        ...slotProps,
        input: {
          ...slotProps?.input,
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setShowPassword(!showPassword)}
                edge="end"
                size="small"
                aria-label={t(showPassword ? 'a11yHidePassword' : 'a11yShowPassword')}
                aria-pressed={showPassword}
              >
                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
};

export default PasswordField;
