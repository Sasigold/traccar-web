import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Chip, InputAdornment, TextField, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { useTranslation } from '../LocalizationProvider';
import { useRestriction } from '../../util/permissions';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.surface.border}`,
    '@media print': {
      display: 'none',
    },
  },
  search: {
    width: 300,
    maxWidth: '100%',
    [theme.breakpoints.down('sm')]: {
      flex: '1 1 100%',
      width: 'auto',
    },
    '& .MuiOutlinedInput-root': {
      backgroundColor: theme.palette.surface.sunken,
      '&.Mui-focused': {
        backgroundColor: theme.palette.background.paper,
      },
    },
  },
  spacer: {
    flex: 1,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
}));

// Toolbar row for data tables: debounced search, count, filters, export and add.
const TableToolbar = ({
  search,
  count,
  filters,
  actions,
  addPath,
  addLabel,
  addDisabled = false,
  exportHandler,
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const navigate = useNavigate();
  const t = useTranslation();

  const readonly = useRestriction('readonly');
  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const [input, setInput] = useState(search?.value ?? '');
  const timerRef = useRef();
  const onChange = search?.onChange;

  useEffect(() => {
    if (!onChange) return undefined;
    timerRef.current = setTimeout(() => onChange(input), 500);
    return () => clearTimeout(timerRef.current);
  }, [input, onChange]);

  return (
    <div className={classes.root}>
      {search && (
        <TextField
          className={classes.search}
          size="small"
          placeholder={search.placeholder || t('sharedSearch')}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
      {count != null && <Chip size="small" label={count} />}
      {filters}
      <div className={classes.spacer} />
      <div className={classes.actions}>
        {exportHandler && (
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            startIcon={<DownloadRoundedIcon />}
            onClick={exportHandler}
          >
            {t('reportExport')}
          </Button>
        )}
        {actions}
        {addPath && desktop && !readonly && !addDisabled && (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddRoundedIcon />}
            onClick={() => navigate(addPath)}
          >
            {addLabel || t('sharedAdd')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default TableToolbar;
