import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Autocomplete, TextField } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import { useTranslation } from './LocalizationProvider';
import { statusColor } from '../theme/surfaces';
import { plateOf } from '../../reports/common/vehicle';

const useStyles = makeStyles()((theme) => ({
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    minWidth: 0,
  },
  tile: {
    position: 'relative',
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: theme.tokens.radius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.primary.main,
    '& svg': {
      fontSize: 18,
    },
  },
  dot: {
    position: 'absolute',
    insetBlockEnd: -2,
    insetInlineEnd: -2,
    width: 10,
    height: 10,
    borderRadius: '50%',
    border: `2px solid ${theme.palette.background.paper}`,
  },
  text: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  name: {
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  plate: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  },
}));

// The text a vehicle is found by: its name and plate (with and without dashes).
export const vehicleSearchText = (device) => {
  const plate = plateOf(device);
  return [device.name, plate, plate.replace(/\D/g, '')].filter(Boolean).join(' ').toLowerCase();
};

export const filterVehicles = (options, input) => {
  const query = input.trim().toLowerCase();
  if (!query) return options;
  const digits = query.replace(/\D/g, '');
  return options.filter((device) => {
    const text = vehicleSearchText(device);
    return text.includes(query) || (digits.length >= 3 && text.includes(digits));
  });
};

// ADM-29: the one vehicle picker of the forms: searchable by name or plate, each option a tile
// with its status dot, the name and the plate. value and onChange use the device id as a string
// ('' for none), like the selects it replaces. `devices` limits the options (default: all).
const VehicleSelect = ({
  value,
  onChange,
  label,
  devices: only,
  disabled,
  required,
  error,
  helperText,
  className,
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const all = useSelector((state) => state.devices.items);
  const options = useMemo(
    () =>
      (only || Object.values(all))
        .filter(Boolean)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [only, all],
  );
  const selected = options.find((device) => String(device.id) === String(value)) || null;

  return (
    <Autocomplete
      className={className}
      options={options}
      value={selected}
      disabled={disabled}
      onChange={(_, device) => onChange(device ? String(device.id) : '')}
      getOptionLabel={(device) => [device.name, plateOf(device)].filter(Boolean).join(' · ')}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      filterOptions={(list, state) => filterVehicles(list, state.inputValue)}
      noOptionsText={t('sharedNoData')}
      renderOption={({ key, ...props }, device) => (
        <li key={key} {...props}>
          <span className={classes.option}>
            <span className={classes.tile}>
              <DirectionsCarRoundedIcon />
              <span
                className={classes.dot}
                style={{ backgroundColor: statusColor(theme, device.status) }}
              />
            </span>
            <span className={classes.text}>
              <span className={classes.name}>{device.name}</span>
              {plateOf(device) && (
                <bdi className={classes.plate} dir="ltr">
                  {plateOf(device)}
                </bdi>
              )}
            </span>
          </span>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label ?? t('fleetEntityVehicle')}
          required={required}
          error={error}
          helperText={helperText}
        />
      )}
    />
  );
};

export default VehicleSelect;
