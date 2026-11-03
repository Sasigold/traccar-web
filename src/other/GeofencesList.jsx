import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import {
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import HexagonRoundedIcon from '@mui/icons-material/HexagonRounded';
import { geofencesActions } from '../store';
import CollectionActions from '../settings/components/CollectionActions';
import EmptyState from '../common/components/table/EmptyState';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useCatchCallback } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minHeight: 0,
  },
  search: {
    padding: theme.spacing(1.5, 2, 0.5),
  },
  list: {
    flexGrow: 1,
    overflow: 'auto',
    paddingBlock: theme.spacing(1),
  },
  item: {
    gap: theme.spacing(1.5),
    borderRadius: theme.tokens.radius.lg,
    marginBlock: 2,
  },
  icon: {
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.primary.main,
    backgroundColor: theme.palette.surface.tint,
  },
}));

const GeofencesList = ({ onGeofenceSelected, selectedId }) => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();

  const items = useSelector((state) => state.geofences.items);

  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return Object.values(items)
      .filter((item) => !needle || item.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, query]);

  const refreshGeofences = useCatchCallback(async () => {
    const response = await fetchOrThrow('api/geofences');
    dispatch(geofencesActions.refresh(await response.json()));
  }, [dispatch]);

  return (
    <div className={classes.root}>
      <div className={classes.search}>
        <TextField
          fullWidth
          size="small"
          placeholder={t('sharedSearchGeofences')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
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
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          compact
          icon={<HexagonRoundedIcon />}
          title={t(query ? 'tableNoMatches' : 'tableEmptyTitle')}
          description={query ? undefined : t('settingsGeofencesDescription')}
        />
      ) : (
        <List className={classes.list}>
          {filtered.map((item) => (
            // The row actions sit beside the select button, not inside it, so screen readers
            // and keyboards see separate controls.
            <ListItem key={item.id} disablePadding sx={{ alignItems: 'center', gap: 0.5 }}>
              <ListItemButton
                className={classes.item}
                selected={selectedId === item.id}
                aria-pressed={selectedId === item.id}
                onClick={() => onGeofenceSelected(item.id)}
              >
                <span className={classes.icon}>
                  <HexagonRoundedIcon fontSize="small" />
                </span>
                <ListItemText
                  primary={item.name}
                  secondary={item.description}
                  slotProps={{ primary: { noWrap: true, fontWeight: 600 } }}
                />
              </ListItemButton>
              <CollectionActions
                itemId={item.id}
                editPath="/settings/geofence"
                endpoint="geofences"
                onReload={refreshGeofences}
              />
            </ListItem>
          ))}
        </List>
      )}
    </div>
  );
};

export default GeofencesList;
