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
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useCatch } from '../reactHelper';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import { formatTime } from '../common/util/formatter';
import { useInvalidateFleet } from '../common/data/fleetQuery';
import { keepOnBackdrop } from '../common/util/formDialog';
import { DateField } from '../common/components/pickers';
import FleetListPage from './components/FleetListPage';
import { FUEL_PROVIDERS } from './components/FuelImportDialog';
import { ensureVehicle, money } from './fleetData';
import { pascalCase } from '../common/util/stringUtils';
import VehicleSelect from '../common/components/VehicleSelect';

const useStyles = makeStyles()((theme) => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
}));

// The number is not shown whole on the screen: the last four digits are enough to tell cards
// apart, and a screenshot does not hand out a card. Pure.
export const maskCard = (number) => {
  const digits = String(number || '').replace(/\s/g, '');
  return digits.length > 4 ? `•••• ${digits.slice(-4)}` : digits;
};

const CardDialog = ({ card, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const devices = useSelector((state) => state.devices.items);
  const [form, setForm] = useState(card);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const save = useCatch(async () => {
    const vehicleId = form.deviceId ? await ensureVehicle(devices[form.deviceId], profile) : null;
    const payload = {
      provider: form.provider,
      card_number: form.card_number.replace(/\s/g, ''),
      vehicle_id: vehicleId,
      valid_until: form.valid_until || null,
      limit_liters_day: Number(form.limit_liters_day) || null,
      limit_amount_month: Number(form.limit_amount_month) || null,
      notes: form.notes?.trim() || null,
    };
    const client = getFleetClient();
    unwrap(
      form.id
        ? await client.from('vehicle_fuel_cards').update(payload).eq('id', form.id)
        : await client.from('vehicle_fuel_cards').insert({ ...payload, org_id: profile.org_id }),
    );
    onSaved();
  });

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="xs">
      <DialogTitle>{t(form.id ? 'fuelCardEdit' : 'fuelCardAdd')}</DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          <TextField
            select
            required
            label={t('fleetFuelProvider')}
            value={form.provider}
            onChange={set('provider')}
          >
            {FUEL_PROVIDERS.map((company) => (
              <MenuItem key={company} value={company}>
                {t(`fleetFuelProvider${pascalCase(company)}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            required
            label={t('fuelCardNumber')}
            value={form.card_number}
            onChange={set('card_number')}
            slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric', autoComplete: 'off' } }}
          />
          <VehicleSelect
            value={form.deviceId}
            onChange={(deviceId) => set('deviceId')({ target: { value: deviceId } })}
          />
          <DateField
            label={t('fuelCardValidUntil')}
            value={form.valid_until || ''}
            onChange={set('valid_until')}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            type="number"
            label={t('fuelCardLimitDay')}
            value={form.limit_liters_day ?? ''}
            onChange={set('limit_liters_day')}
            slotProps={{ htmlInput: { min: 0, dir: 'ltr' } }}
          />
          <TextField
            type="number"
            label={t('fuelCardLimitMonth')}
            value={form.limit_amount_month ?? ''}
            onChange={set('limit_amount_month')}
            slotProps={{ htmlInput: { min: 0, dir: 'ltr' } }}
          />
          <TextField
            label={t('fleetNotes')}
            value={form.notes || ''}
            onChange={set('notes')}
            multiline
            minRows={2}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={!form.provider || form.card_number.replace(/\s/g, '').length < 4}
        >
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ADM-31: the organization's fuel cards: company, the number (masked), the vehicle, until when,
// and the limits.
const FuelCardsPage = () => {
  const t = useTranslation();
  const canWrite = useFleetPermission('vehicles.write');
  const invalidate = useInvalidateFleet();
  const [editing, setEditing] = useState(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <>
      <FleetListPage
        title="fuelCardsTitle"
        description="fuelCardsDescription"
        permission="vehicles.read"
        table="vehicle_fuel_cards"
        query={(client) =>
          client
            .from('vehicle_fuel_cards')
            .select('*, vehicles(plate_number, traccar_device_id)')
            .order('provider')
        }
        filters={[
          { key: 'all' },
          { key: 'expired', test: (row) => row.valid_until && row.valid_until < today },
          { key: 'unassigned', test: (row) => !row.vehicle_id },
        ].map((item) => ({ ...item, label: t(`fuelCardsFilter${pascalCase(item.key)}`) }))}
        searchOf={(row) => [row.card_number, row.vehicles?.plate_number, row.provider, row.notes]}
        columns={[
          {
            key: 'provider',
            label: t('fleetFuelProvider'),
            value: (row) => t(`fleetFuelProvider${pascalCase(row.provider)}`),
          },
          {
            key: 'card_number',
            label: t('fuelCardNumber'),
            ltr: true,
            render: (row) => maskCard(row.card_number),
            value: (row) => maskCard(row.card_number),
          },
          {
            key: 'vehicle',
            label: t('fleetEntityVehicle'),
            ltr: true,
            value: (row) => row.vehicles?.plate_number || '',
          },
          {
            key: 'valid_until',
            label: t('fuelCardValidUntil'),
            nowrap: true,
            value: (row) => (row.valid_until ? formatTime(row.valid_until, 'date') : ''),
          },
          {
            key: 'limits',
            label: t('fuelCardLimits'),
            sort: false,
            value: (row) =>
              [
                row.limit_liters_day
                  ? t('fuelCardLitersDay').replace('{0}', row.limit_liters_day)
                  : null,
                row.limit_amount_month
                  ? `${money(row.limit_amount_month)} / ${t('fuelCardMonth')}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · '),
          },
        ]}
        rowLink={null}
        add={
          canWrite
            ? {
                label: t('fuelCardAdd'),
                onClick: () =>
                  setEditing({ provider: '', card_number: '', deviceId: '', valid_until: '' }),
              }
            : undefined
        }
        emptyState={{
          icon: <CreditCardRoundedIcon />,
          title: t('fuelCardsNone'),
          description: t('fuelCardsNoneDescription'),
        }}
        exportFile="fuel-cards.xlsx"
        onRowClick={
          canWrite
            ? (row) =>
                setEditing({
                  ...row,
                  deviceId: row.vehicles?.traccar_device_id
                    ? String(row.vehicles.traccar_device_id)
                    : '',
                })
            : undefined
        }
      />
      {editing && (
        <CardDialog
          card={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate('vehicle_fuel_cards');
          }}
        />
      )}
    </>
  );
};

export default FuelCardsPage;
