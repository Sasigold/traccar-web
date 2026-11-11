import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  useTheme,
  Popover,
  TextField,
  List,
  ListItem,
  ListItemButton,
  IconButton,
  Tooltip,
  ListItemText,
  ListItemIcon,
  Skeleton,
  Box,
  InputAdornment,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { createRoot } from 'react-dom/client';
import TravelExploreIcon from '@mui/icons-material/TravelExploreRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import NearMeRoundedIcon from '@mui/icons-material/NearMeRounded';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { glass } from '../../common/theme/surfaces';
import { map } from '../core/MapView';
import { toMapCoordinates } from '../core/mapUtil';
import { messagesActions } from '../../store';
import { useTranslation } from '../../common/components/LocalizationProvider';
import {
  DEFAULT_GEOCODER,
  formatAddress,
  geocodeAddress,
  searchStreets,
} from '../../common/util/addressSearch';

const useStyles = makeStyles()((theme) => ({
  button: {
    '&&': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.palette.text.primary,
    },
  },
  paper: {
    ...glass(theme, 0.94),
    borderRadius: theme.tokens.radius.xl,
  },
  panel: {
    width: theme.spacing(42),
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: theme.spacing(50),
    display: 'flex',
    flexDirection: 'column',
  },
  input: {
    padding: theme.spacing(1.5),
  },
  results: {
    overflowY: 'auto',
    paddingBottom: theme.spacing(1),
    '& .MuiListItemButton-root': {
      borderRadius: theme.tokens.radius.md,
    },
  },
}));

const MapGeocoder = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const t = useTranslation();
  const { classes, cx } = useStyles();
  const [anchorEl, setAnchorEl] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  // ISR-10: while typing, streets from the official list; the geocoder only runs on a choice.
  const [streets, setStreets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(null);
  const geocoderUrl = useSelector((state) => state.session.server?.attributes?.['web.geocoderUrl']);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setStreets([]);
      return undefined;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        setStreets(await searchStreets(text, { signal: controller.signal }));
      } catch {
        // no suggestions this time
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [query]);

  // A free search (a place, a business, a city) on Enter or from the first row: one geocoder
  // request per search, as Nominatim's usage policy asks, through `web.geocoderUrl` when set.
  const search = async (text = query) => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: text,
        format: 'geojson',
        addressdetails: '1',
        // LIV-12: Hebrew names first, and places in Israel.
        'accept-language': 'he,en',
        countrycodes: 'il',
      });
      const response = await fetch(`${geocoderUrl || DEFAULT_GEOCODER}?${params}`);
      const data = await response.json();
      setResults(data.features || []);
      setSearched(text);
    } catch (e) {
      dispatch(messagesActions.push(e.message));
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setAnchorEl(null);
    setQuery('');
    setResults([]);
    setStreets([]);
    setSearched(null);
  };

  // A street from the list: its coordinates from the geocoder, else a free search for it.
  const onStreet = async (street) => {
    const address = formatAddress(street);
    setLoading(true);
    try {
      const point = await geocodeAddress(address, { url: geocoderUrl });
      if (point) {
        map.flyTo({ center: toMapCoordinates(point.longitude, point.latitude), zoom: 16 });
        close();
        return;
      }
    } catch {
      // fall back to a free search
    } finally {
      setLoading(false);
    }
    setQuery(address);
    search(address);
  };

  useEffect(() => {
    let element;
    let iconRoot;
    const control = {
      onAdd: () => {
        element = document.createElement('div');
        element.className = 'maplibregl-ctrl maplibregl-ctrl-group';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = cx('maplibregl-ctrl-icon', classes.button);
        button.title = t('sharedSearch');
        button.setAttribute('aria-label', t('sharedSearch'));
        button.setAttribute('aria-haspopup', 'true');
        button.onclick = () => setAnchorEl(button);
        element.appendChild(button);
        iconRoot = createRoot(button);
        iconRoot.render(<TravelExploreIcon fontSize="small" />);
        return element;
      },
      onRemove: () => {
        queueMicrotask(() => iconRoot.unmount());
        element.remove();
      },
    };
    map.addControl(control, theme.direction === 'rtl' ? 'top-left' : 'top-right');
    return () => map.removeControl(control);
  }, [theme.direction, classes.button, cx, t]);

  const onSelect = (feature) => {
    if (feature.bbox) {
      const [minX, minY, maxX, maxY] = feature.bbox;
      map.fitBounds([toMapCoordinates(minX, minY), toMapCoordinates(maxX, maxY)], {
        padding: 40,
      });
    } else {
      const [longitude, latitude] = feature.geometry.coordinates;
      map.flyTo({ center: toMapCoordinates(longitude, latitude), zoom: 16 });
    }
    close();
  };

  const showResults = searched != null && searched === query;

  return (
    <Popover
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={close}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: theme.direction === 'rtl' ? 'left' : 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: theme.direction === 'rtl' ? 'left' : 'right',
      }}
      slotProps={{ paper: { className: classes.paper } }}
    >
      <Box className={classes.panel}>
        <Box className={classes.input}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder={t('sharedSearch')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                search();
              }
            }}
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
        </Box>
        <List className={classes.results} dense disablePadding>
          {loading
            ? Array.from({ length: 3 }, (_, i) => (
                <ListItemButton key={i} disabled>
                  <ListItemText primary={<Skeleton width="100%" />} />
                </ListItemButton>
              ))
            : !showResults
              ? query.trim().length > 1 && (
                  <>
                    <ListItemButton onClick={() => search()}>
                      <ListItemIcon>
                        <SearchRoundedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={t('mapSearchFor').replace('{0}', query.trim())} />
                    </ListItemButton>
                    {streets.map((street) => (
                      <ListItemButton
                        key={`${street.street}|${street.city}`}
                        onClick={() => onStreet(street)}
                      >
                        <ListItemIcon>
                          <PlaceOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={formatAddress(street)} />
                      </ListItemButton>
                    ))}
                  </>
                )
              : results.map((feature) => (
                  <ListItem
                    key={feature.properties.place_id}
                    disablePadding
                    secondaryAction={
                      // LIV-21: who is closest to this address.
                      <Tooltip title={t('mapNearbyVehicles')}>
                        <IconButton
                          edge="end"
                          size="small"
                          aria-label={`${t('mapNearbyVehicles')}: ${feature.properties.display_name}`}
                          onClick={() => {
                            const [longitude, latitude] = feature.geometry.coordinates;
                            onSelect(feature);
                            map.fire('vf-nearby', {
                              latitude,
                              longitude,
                              name: feature.properties.display_name,
                            });
                          }}
                        >
                          <NearMeRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemButton onClick={() => onSelect(feature)}>
                      <ListItemText primary={feature.properties.display_name} />
                    </ListItemButton>
                  </ListItem>
                ))}
          {/* LIV-12: a search that found nothing says so. */}
          {!loading && showResults && !results.length && (
            <ListItemText
              role="status"
              sx={{ px: 2, py: 1, color: 'text.secondary' }}
              primary={t('mapSearchNotFound')}
            />
          )}
        </List>
      </Box>
    </Popover>
  );
};

export default MapGeocoder;
