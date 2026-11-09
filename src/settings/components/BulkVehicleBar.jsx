import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { DateField } from '../../common/components/pickers';
import { useCatch } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { runLimited } from '../../common/util/runLimited';
import { vehicleExpiryFields } from '../../common/fleet/fleetFields';
import { keepOnBackdrop } from '../../common/util/formDialog';

const useStyles = makeStyles()((theme) => ({
  bar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    backgroundColor: theme.palette.surface.sunken,
    borderBlockEnd: `1px solid ${theme.palette.divider}`,
  },
  count: {
    fontWeight: 600,
    marginInlineEnd: 'auto',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
}));

// Each device is saved whole (Traccar's PUT replaces it), a few at a time.
export const updateDevices = (devices, change) =>
  runLimited(
    devices.map((device) => () => {
      const next = change(device);
      return fetchOrThrow(`api/devices/${device.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
    }),
    4,
  );

// ADM-13: what can be done to many vehicles at once: move them to a group, set a validity date,
// export them. `devices` are the full device objects of the chosen rows.
const BulkVehicleBar = ({ devices, onDone, onClear, onExport }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const groups = useSelector((state) => state.groups.items);
  const [dialog, setDialog] = useState(null);
  const [groupId, setGroupId] = useState('');
  const [expiryField, setExpiryField] = useState(vehicleExpiryFields[0]?.key || '');
  const [expiryDate, setExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);

  const apply = useCatch(async () => {
    setSaving(true);
    try {
      if (dialog === 'group') {
        await updateDevices(devices, (device) => ({ ...device, groupId: Number(groupId) || 0 }));
      } else {
        await updateDevices(devices, (device) => ({
          ...device,
          attributes: { ...device.attributes, [expiryField]: expiryDate },
        }));
      }
      setDialog(null);
      onDone();
    } finally {
      setSaving(false);
    }
  });

  return (
    <div className={classes.bar} role="region" aria-label={t('bulkSelected')}>
      <Typography variant="body2" className={classes.count} role="status">
        {t('bulkCount').replace('{0}', devices.length)}
      </Typography>
      <Button size="small" variant="outlined" onClick={() => setDialog('group')}>
        {t('bulkMoveToGroup')}
      </Button>
      <Button size="small" variant="outlined" onClick={() => setDialog('expiry')}>
        {t('bulkSetExpiry')}
      </Button>
      <Button size="small" variant="outlined" onClick={onExport}>
        {t('reportExport')}
      </Button>
      <Button size="small" onClick={onClear}>
        {t('bulkClear')}
      </Button>
      {dialog && (
        <Dialog open onClose={keepOnBackdrop(() => setDialog(null))} fullWidth maxWidth="xs">
          <DialogTitle>{t(dialog === 'group' ? 'bulkMoveToGroup' : 'bulkSetExpiry')}</DialogTitle>
          <DialogContent>
            <div className={classes.form}>
              <Typography variant="body2" color="textSecondary">
                {t('bulkAppliesTo').replace('{0}', devices.length)}
              </Typography>
              {dialog === 'group' ? (
                <TextField
                  select
                  label={t('groupParent')}
                  value={groupId}
                  onChange={(event) => setGroupId(event.target.value)}
                >
                  <MenuItem value="0">{t('groupNoGroup')}</MenuItem>
                  {Object.values(groups)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((group) => (
                      <MenuItem key={group.id} value={String(group.id)}>
                        {group.name}
                      </MenuItem>
                    ))}
                </TextField>
              ) : (
                <>
                  <TextField
                    select
                    label={t('bulkExpiryField')}
                    value={expiryField}
                    onChange={(event) => setExpiryField(event.target.value)}
                  >
                    {vehicleExpiryFields.map((field) => (
                      <MenuItem key={field.key} value={field.key}>
                        {t(field.labelKey)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <DateField
                    label={t('bulkExpiryDate')}
                    value={expiryDate}
                    onChange={(event) => setExpiryDate(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialog(null)}>{t('sharedCancel')}</Button>
            <Button
              variant="contained"
              onClick={apply}
              disabled={saving || (dialog === 'group' ? groupId === '' : !expiryDate)}
            >
              {t('bulkApply').replace('{0}', devices.length)}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
};

export default BulkVehicleBar;
