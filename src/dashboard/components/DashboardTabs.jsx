import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Tooltip,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SpaceDashboardRoundedIcon from '@mui/icons-material/SpaceDashboardRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { MAX_DASHBOARDS } from '../layout/model';
import { TEMPLATES, TEMPLATE_KEYS } from '../model/templates';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    minWidth: 0,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  tabs: {
    minHeight: 40,
    minWidth: 0,
    '& .MuiTab-root': {
      minHeight: 40,
      paddingInline: theme.spacing(1.75),
      ...theme.typography.subtitle2,
    },
  },
}));

export const dashboardName = (dashboard, t) =>
  dashboard.name || t(dashboard.nameKey ?? 'dashboardTitle');

export const NameDialog = ({ open, title, initial = '', onClose, onSave }) => {
  const t = useTranslation();
  const [value, setValue] = useState(initial);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ transition: { onEnter: () => setValue(initial) } }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label={t('sharedName')}
          value={value}
          slotProps={{ htmlInput: { maxLength: 40 } }}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && value.trim()) {
              onSave(value.trim());
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" disabled={!value.trim()} onClick={() => onSave(value.trim())}>
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// The user's dashboards as tabs, and "+" for a new one (empty or from a template).
const DashboardTabs = ({ doc, activeId, disabled, onSelect, onAdd, templateAvailable }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [anchor, setAnchor] = useState(null);
  const [naming, setNaming] = useState(false);
  const full = doc.dashboards.length >= MAX_DASHBOARDS;

  return (
    <div className={classes.root}>
      <Tabs
        className={classes.tabs}
        value={activeId}
        onChange={(_, value) => onSelect(value)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={t('dashboardTabs')}
      >
        {doc.dashboards.map((dashboard) => (
          <Tab
            key={dashboard.id}
            value={dashboard.id}
            label={dashboardName(dashboard, t)}
            disabled={disabled && dashboard.id !== activeId}
          />
        ))}
      </Tabs>
      <Tooltip title={full ? t('dashboardLimitReached') : t('dashboardNew')}>
        <span>
          <IconButton
            size="small"
            aria-label={t('dashboardNew')}
            aria-haspopup="menu"
            disabled={disabled || full}
            onClick={(event) => setAnchor(event.currentTarget)}
          >
            <AddRoundedIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            setNaming(true);
          }}
        >
          <ListItemIcon>
            <AddRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('dashboardNewEmpty')}</ListItemText>
        </MenuItem>
        <Divider />
        {TEMPLATE_KEYS.filter(templateAvailable).map((key) => (
          <MenuItem
            key={key}
            onClick={() => {
              setAnchor(null);
              onAdd(key);
            }}
          >
            <ListItemIcon>
              <SpaceDashboardRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={t(TEMPLATES[key].nameKey)}
              secondary={t(`${TEMPLATES[key].nameKey}Desc`)}
            />
          </MenuItem>
        ))}
      </Menu>
      <NameDialog
        open={naming}
        title={t('dashboardNewEmpty')}
        onClose={() => setNaming(false)}
        onSave={(name) => {
          setNaming(false);
          onAdd(null, name);
        }}
      />
    </div>
  );
};

export default DashboardTabs;
