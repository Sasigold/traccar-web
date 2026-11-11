import { useState } from 'react';
import { Button, Chip, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import DateField from '../../common/components/pickers/DateField';
import { RULE_KEYS, VEHICLE_CLASSES, rulesFor, validPermit } from '../../common/fleet/hoursRules';
import { formatTime } from '../../common/util/formatter';
import { capitalize } from '../../common/util/stringUtils';

const useStyles = makeStyles()((theme) => ({
  section: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  heading: {
    fontWeight: 700,
  },
  chips: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  fields: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  permit: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.sunken,
  },
  permitText: {
    flex: 1,
    minWidth: 0,
  },
}));

const OVERRIDE_CLASSES = VEHICLE_CLASSES.filter((cls) => cls !== 'light');
const emptyPermit = { name: '', from: '', to: '', classes: [], rules: {} };

// A number field that may stay empty ("as the base rules").
const RuleField = ({ ruleKey, value, placeholder, onChange }) => {
  const t = useTranslation();
  return (
    <TextField
      type="number"
      size="small"
      label={t(`fleetSafetyRule${capitalize(ruleKey)}`)}
      value={value ?? ''}
      placeholder={placeholder != null ? String(placeholder) : undefined}
      onChange={(event) =>
        onChange(event.target.value === '' ? undefined : Number(event.target.value))
      }
      slotProps={{ htmlInput: { dir: 'ltr', min: 0 }, inputLabel: { shrink: true } }}
    />
  );
};

const withValue = (object, key, value) => {
  const next = { ...object };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
};

// ISR-07: rules per kind of vehicle (heavy, bus) over the base rules, and temporary permits.
const HoursRulesEditor = ({ rules, onChange }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [cls, setCls] = useState('heavy');
  const [permit, setPermit] = useState(emptyPermit);

  const base = rulesFor(rules, 'light');
  const overrides = rules.byClass?.[cls] || {};
  const permits = rules.permits || [];

  const setOverride = (key, value) =>
    onChange({
      ...rules,
      byClass: { ...rules.byClass, [cls]: withValue(overrides, key, value) },
    });

  const addPermit = () => {
    onChange({
      ...rules,
      permits: [...permits, { ...permit, id: `${Date.now()}`, name: permit.name.trim() }],
    });
    setPermit(emptyPermit);
  };

  const removePermit = (id) =>
    onChange({ ...rules, permits: permits.filter((item) => item.id !== id) });

  const ruleSummary = (item) =>
    Object.entries(item.rules || {})
      .map(([key, value]) => `${t(`fleetSafetyRule${capitalize(key)}`)} ${value}`)
      .join(' · ');

  return (
    <>
      <div className={classes.section}>
        <Typography className={classes.heading}>{t('hoursRulesByClass')}</Typography>
        <Typography variant="body2" color="textSecondary">
          {t('hoursRulesByClassHelp')}
        </Typography>
        <div className={classes.chips}>
          {OVERRIDE_CLASSES.map((key) => (
            <Chip
              key={key}
              label={t(`hoursRulesClass${capitalize(key)}`)}
              color={cls === key ? 'primary' : 'default'}
              variant={cls === key ? 'filled' : 'outlined'}
              aria-pressed={cls === key}
              onClick={() => setCls(key)}
            />
          ))}
        </div>
        <div className={classes.fields}>
          {RULE_KEYS.map((key) => (
            <RuleField
              key={key}
              ruleKey={key}
              value={overrides[key]}
              placeholder={base[key]}
              onChange={(value) => setOverride(key, value)}
            />
          ))}
        </div>
      </div>

      <div className={classes.section}>
        <Typography className={classes.heading}>{t('hoursRulesPermits')}</Typography>
        <Typography variant="body2" color="textSecondary">
          {t('hoursRulesPermitsHelp')}
        </Typography>
        {permits.map((item) => (
          <div key={item.id} className={classes.permit}>
            <div className={classes.permitText}>
              <Typography variant="body2" fontWeight={600}>
                {item.name}
              </Typography>
              <Typography variant="body2">
                {`${formatTime(item.from, 'date')} – ${formatTime(item.to, 'date')} · ${
                  item.classes?.length
                    ? item.classes.map((key) => t(`hoursRulesClass${capitalize(key)}`)).join(', ')
                    : t('hoursRulesAllVehicles')
                }`}
              </Typography>
              <Typography variant="caption">{ruleSummary(item)}</Typography>
            </div>
            <IconButton
              size="small"
              aria-label={`${t('sharedRemove')} ${item.name}`}
              onClick={() => removePermit(item.id)}
            >
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </div>
        ))}
        <div className={classes.fields}>
          <TextField
            size="small"
            label={t('hoursRulesPermitName')}
            value={permit.name}
            onChange={(event) => setPermit({ ...permit, name: event.target.value })}
          />
          <TextField
            select
            size="small"
            label={t('hoursRulesPermitVehicles')}
            value={permit.classes[0] || 'all'}
            onChange={(event) =>
              setPermit({
                ...permit,
                classes: event.target.value === 'all' ? [] : [event.target.value],
              })
            }
          >
            <MenuItem value="all">{t('hoursRulesAllVehicles')}</MenuItem>
            {VEHICLE_CLASSES.map((key) => (
              <MenuItem key={key} value={key}>
                {t(`hoursRulesClass${capitalize(key)}`)}
              </MenuItem>
            ))}
          </TextField>
          <DateField
            size="small"
            label={t('hoursRulesPermitFrom')}
            value={permit.from}
            onChange={(event) => setPermit({ ...permit, from: event.target.value })}
          />
          <DateField
            size="small"
            label={t('hoursRulesPermitTo')}
            value={permit.to}
            onChange={(event) => setPermit({ ...permit, to: event.target.value })}
          />
          {['maxDailyDriving', 'maxContinuousDriving', 'minDailyRest', 'maxWeeklyDriving'].map(
            (key) => (
              <RuleField
                key={key}
                ruleKey={key}
                value={permit.rules[key]}
                onChange={(value) =>
                  setPermit({ ...permit, rules: withValue(permit.rules, key, value) })
                }
              />
            ),
          )}
        </div>
        <div>
          <Button variant="outlined" onClick={addPermit} disabled={!validPermit(permit)}>
            {t('hoursRulesPermitAdd')}
          </Button>
        </div>
      </div>
    </>
  );
};

export default HoursRulesEditor;
