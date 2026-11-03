import { useState } from 'react';
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';

const useStyles = makeStyles()((theme) => ({
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    opacity: 0,
    transition: 'opacity 140ms ease',
    'tr:hover &, tr:focus-within &, .MuiListItemButton-root:hover &, .MuiListItemButton-root:focus-within &':
      {
        opacity: 1,
      },
    '@media (hover: none)': {
      opacity: 1,
    },
    '@media print': {
      display: 'none',
    },
  },
  button: {
    color: theme.palette.text.secondary,
    '&:hover': {
      color: theme.palette.primary.main,
    },
  },
  danger: {
    '&:hover': {
      color: theme.palette.error.main,
    },
  },
}));

// Per-row actions: inline icon buttons revealed on hover (desktop) or an
// overflow menu (phones). actions: [{ key, title, icon, onClick, color, disabled }]
const RowActions = ({ actions }) => {
  const { classes, cx } = useStyles();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));

  const [anchorEl, setAnchorEl] = useState(null);

  if (!actions.length) {
    return null;
  }

  if (phone) {
    return (
      <>
        <IconButton size="small" onClick={(event) => setAnchorEl(event.currentTarget)}>
          <MoreVertRoundedIcon fontSize="small" />
        </IconButton>
        <Menu open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
          {actions.map((action) => (
            <MenuItem
              key={action.key}
              disabled={action.disabled}
              onClick={() => {
                setAnchorEl(null);
                action.onClick();
              }}
            >
              {action.icon && <ListItemIcon>{action.icon}</ListItemIcon>}
              <ListItemText>{action.title}</ListItemText>
            </MenuItem>
          ))}
        </Menu>
      </>
    );
  }

  return (
    <div className={classes.row}>
      {actions.map((action) => (
        <Tooltip title={action.title} key={action.key}>
          <span>
            <IconButton
              size="small"
              className={cx(classes.button, action.color === 'error' && classes.danger)}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.icon}
            </IconButton>
          </span>
        </Tooltip>
      ))}
    </div>
  );
};

export default RowActions;
