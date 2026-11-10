import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Button, Chip, Stack, TextField, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import BookmarkAddRoundedIcon from '@mui/icons-material/BookmarkAddRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import usePersistedState from '../../common/util/usePersistedState';
import { messagesActions } from '../../store';
import { encodeView, sanitizeView, upsertView } from '../savedViews';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    paddingTop: theme.spacing(1.5),
    borderTop: `1px solid ${theme.palette.surface.border}`,
  },
  chips: {
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
  },
}));

// The map area of a view, read when saving (the map module loads with the map).
const currentBounds = async () => {
  try {
    const { map } = await import('../../map/core/MapView');
    return map.getBounds().toArray();
  } catch {
    return null;
  }
};

export const fitView = async (view) => {
  if (!view.bounds) return;
  const { map } = await import('../../map/core/MapView');
  const fit = () => map.fitBounds(view.bounds, { duration: 0 });
  if (map.loaded()) fit();
  else map.once('load', fit);
};

// LIV-22: named views: what is filtered, how it is sorted and which part of the map is shown.
const SavedViews = ({ filter, setFilter, filterSort, setFilterSort, filterMap, setFilterMap }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const dispatch = useDispatch();
  const [views, setViews] = usePersistedState('savedViews', []);
  const [naming, setNaming] = useState(null);

  const snapshot = async (name) =>
    sanitizeView({ name, filter, sort: filterSort, filterMap, bounds: await currentBounds() });

  const save = async () => {
    const view = await snapshot(naming);
    if (!view) return;
    setViews(upsertView(views, view));
    setNaming(null);
  };

  const apply = (view) => {
    setFilter(view.filter);
    setFilterSort(view.sort);
    setFilterMap(view.filterMap);
    fitView(view);
  };

  const share = async (view) => {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ view: encodeView(view) }).toString();
    try {
      await navigator.clipboard.writeText(url.href);
      dispatch(messagesActions.push({ message: t('viewLinkCopied'), severity: 'success' }));
    } catch {
      dispatch(messagesActions.push(url.href));
    }
  };

  return (
    <div className={classes.root}>
      <Typography variant="subtitle2">{t('viewSaved')}</Typography>
      {views.length > 0 && (
        <Stack direction="row" className={classes.chips} role="list" aria-label={t('viewSaved')}>
          {views.map((view) => (
            <span key={view.name} role="listitem">
              <Chip
                label={view.name}
                onClick={() => apply(view)}
                onDelete={() => setViews(views.filter((item) => item.name !== view.name))}
                variant="outlined"
              />
            </span>
          ))}
        </Stack>
      )}
      {naming !== null ? (
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            autoFocus
            fullWidth
            label={t('viewName')}
            value={naming}
            onChange={(event) => setNaming(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              }
            }}
          />
          <Button onClick={save} disabled={!naming.trim()}>
            {t('sharedSave')}
          </Button>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<BookmarkAddRoundedIcon />} onClick={() => setNaming('')}>
            {t('viewSaveCurrent')}
          </Button>
          <Button
            size="small"
            startIcon={<LinkRoundedIcon />}
            onClick={async () => share(await snapshot(t('viewShared')))}
          >
            {t('viewCopyLink')}
          </Button>
        </Stack>
      )}
    </div>
  );
};

export default SavedViews;
