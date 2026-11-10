import { useMemo, useState } from 'react';
import {
  ButtonBase,
  Chip,
  Drawer,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { CATEGORIES, PRESETS } from '../widgets/catalog';
import { CATEGORY_ICONS, PresetIcon, VizIcon } from '../widgets/icons';
import { allowedViz } from '../widgets/vizRules';
import { measureOf } from '../data/datasets';

const useStyles = makeStyles()((theme) => ({
  paper: {
    width: 400,
    maxWidth: '100vw',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(2, 2, 1, 2.5),
  },
  title: {
    flex: 1,
    ...theme.typography.h5,
  },
  search: {
    margin: theme.spacing(0, 2.5, 1),
  },
  categories: {
    display: 'flex',
    gap: theme.spacing(0.75),
    flexWrap: 'wrap',
    padding: theme.spacing(0, 2.5, 1.5),
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing(0, 1.5, 3),
  },
  group: {
    ...theme.typography.sectionLabel,
    color: theme.palette.text.secondary,
    padding: theme.spacing(1.5, 1, 0.75),
  },
  item: {
    width: '100%',
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25),
    borderRadius: theme.tokens.radius.lg,
    textAlign: 'start',
    border: '1px solid transparent',
    '&:hover, &:focus-visible': {
      backgroundColor: theme.palette.surface.tint,
      borderColor: theme.palette.surface.border,
    },
    '&.Mui-disabled': {
      opacity: 0.55,
    },
  },
  icon: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: theme.tokens.radius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    color: theme.palette.primary.main,
  },
  text: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  name: {
    ...theme.typography.subtitle2,
    color: theme.palette.text.primary,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  added: {
    fontSize: 16,
    color: theme.palette.success.main,
  },
  description: {
    ...theme.typography.caption,
    fontWeight: 400,
    color: theme.palette.text.secondary,
  },
  forms: {
    display: 'flex',
    gap: 2,
    marginTop: 2,
    color: theme.palette.text.secondary,
    '& svg': {
      fontSize: 16,
    },
  },
  reason: {
    ...theme.typography.caption,
    fontStyle: 'italic',
    color: theme.palette.text.secondary,
  },
}));

// Widget library: categories, search, and for each widget what it shows and which
// forms it can take. Clicking adds it at the end of the dashboard.
const CatalogDrawer = ({ open, onClose, onAdd, availability, singletonsUsed }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [added, setAdded] = useState(null);

  const items = useMemo(() => {
    const search = query.trim().toLowerCase();
    return PRESETS.filter((preset) => !category || preset.category === category).filter(
      (preset) => {
        if (!search) {
          return true;
        }
        return `${t(preset.titleKey)} ${t(`${preset.titleKey}Desc`)}`
          .toLowerCase()
          .includes(search);
      },
    );
  }, [query, category, t]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { className: classes.paper } }}
    >
      <div className={classes.header}>
        <Typography component="h2" className={classes.title}>
          {t('dashboardAddWidget')}
        </Typography>
        <IconButton aria-label={t('sharedHide')} onClick={onClose}>
          <CloseRoundedIcon />
        </IconButton>
      </div>
      <TextField
        className={classes.search}
        size="small"
        placeholder={t('sharedSearch')}
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
          htmlInput: { 'aria-label': t('sharedSearch') },
        }}
      />
      <div className={classes.categories}>
        <Chip
          label={t('dashboardAll')}
          color={category ? 'default' : 'primary'}
          variant={category ? 'outlined' : 'filled'}
          onClick={() => setCategory(null)}
        />
        {CATEGORIES.map((key) => {
          const Icon = CATEGORY_ICONS[key];
          return (
            <Chip
              key={key}
              icon={<Icon fontSize="small" />}
              label={t(`dashboardCategory${key[0].toUpperCase()}${key.slice(1)}`)}
              color={category === key ? 'primary' : 'default'}
              variant={category === key ? 'filled' : 'outlined'}
              onClick={() => setCategory(key)}
            />
          );
        })}
      </div>
      <div className={classes.list}>
        {CATEGORIES.filter((key) => items.some((preset) => preset.category === key)).map((key) => (
          <div key={key}>
            <div className={classes.group}>
              {t(`dashboardCategory${key[0].toUpperCase()}${key.slice(1)}`)}
            </div>
            {items
              .filter((preset) => preset.category === key)
              .map((preset) => {
                const reason =
                  availability(preset) ??
                  (preset.singleton && singletonsUsed.has(preset.id)
                    ? 'dashboardAlreadyOnBoard'
                    : null);
                const forms =
                  preset.kind === 'chart'
                    ? allowedViz(preset.query, measureOf(preset.query.ds, preset.query.m)).filter(
                        (viz) => viz !== 'table',
                      )
                    : [];
                return (
                  <ButtonBase
                    key={preset.id}
                    className={classes.item}
                    disabled={Boolean(reason)}
                    focusRipple
                    onClick={() => {
                      onAdd(preset.id);
                      setAdded(preset.id);
                    }}
                  >
                    <span className={classes.icon}>
                      <PresetIcon preset={preset} />
                    </span>
                    <span className={classes.text}>
                      <span className={classes.name}>
                        {t(preset.titleKey)}
                        {added === preset.id && (
                          <CheckCircleRoundedIcon className={classes.added} />
                        )}
                      </span>
                      <span className={classes.description}>{t(`${preset.titleKey}Desc`)}</span>
                      {forms.length > 0 && (
                        <span className={classes.forms}>
                          {forms.map((viz) => (
                            <Tooltip
                              key={viz}
                              title={t(`dashboardViz${viz[0].toUpperCase()}${viz.slice(1)}`)}
                            >
                              <span>
                                <VizIcon viz={viz} />
                              </span>
                            </Tooltip>
                          ))}
                        </span>
                      )}
                      {reason && <span className={classes.reason}>{t(reason)}</span>}
                    </span>
                  </ButtonBase>
                );
              })}
          </div>
        ))}
      </div>
    </Drawer>
  );
};

export default CatalogDrawer;
