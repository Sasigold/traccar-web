import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Switch,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SellRoundedIcon from '@mui/icons-material/SellRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useLocalization, useTranslation } from '../common/components/LocalizationProvider';
import { useCatch } from '../reactHelper';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import AdminMenu from './components/AdminMenu';
import AdminGate from './components/AdminGate';
import StateChip from './components/StateChip';
import { useAdminAccess, useAdminDirectory } from './useAdmin';
import { deletePlan, savePlan } from './adminApi';
import { cycles, formatMoney } from './billing';
import { capitalize } from './CustomersPage';
import { keepOnBackdrop } from '../common/util/formDialog';

const useStyles = makeStyles()((theme) => ({
  row: {
    cursor: 'pointer',
  },
  name: {
    fontWeight: 600,
  },
  sub: {
    display: 'block',
    color: theme.palette.text.secondary,
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
  },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(2),
    paddingTop: `${theme.spacing(1)} !important`,
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  wide: {
    gridColumn: '1 / -1',
  },
  spacer: {
    flex: 1,
  },
}));

const blankPlan = {
  name: '',
  description: '',
  price_per_device: 0,
  base_price: 0,
  setup_fee: 0,
  cycle: 'monthly',
  active: true,
  sort_order: 0,
};

const PlansPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const { language } = useLocalization();
  const access = useAdminAccess();
  const directory = useAdminDirectory({ billing: true });
  const [editing, setEditing] = useState(null);

  const usage = (planId) => directory.subscriptions.filter((row) => row.plan_id === planId).length;
  const money = (value) => formatMoney(value, language);

  const handleSave = useCatch(async () => {
    await savePlan({
      ...editing,
      name: editing.name.trim(),
      price_per_device: Number(editing.price_per_device) || 0,
      base_price: Number(editing.base_price) || 0,
      setup_fee: Number(editing.setup_fee) || 0,
      sort_order: Number(editing.sort_order) || 0,
    });
    setEditing(null);
    directory.reload();
  });

  const handleDelete = useCatch(async () => {
    await deletePlan(editing.id);
    setEditing(null);
    directory.reload();
  });

  const set = (key) => (event) => setEditing({ ...editing, [key]: event.target.value });

  return (
    <PageLayout
      menu={<AdminMenu />}
      breadcrumbs={['adminTitle', 'adminPlans']}
      description={t('adminPlansDescription')}
    >
      <AdminGate need="billingRead" />
      {access.billingRead && (
        <DataTable
          toolbar={
            <TableToolbar
              count={directory.plans.length}
              actions={
                access.billingManage && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddRoundedIcon />}
                    onClick={() => setEditing(blankPlan)}
                  >
                    {t('adminNewPlan')}
                  </Button>
                )
              }
            />
          }
          empty={directory.loaded && directory.plans.length === 0}
          emptyState={{ icon: <SellRoundedIcon />, title: t('adminNoPlans') }}
        >
          <TableHead>
            <TableRow>
              <TableCell>{t('adminPlan')}</TableCell>
              <TableCell>{t('adminPricePerDevice')}</TableCell>
              <TableCell>{t('adminBasePrice')}</TableCell>
              <TableCell>{t('adminSetupFee')}</TableCell>
              <TableCell>{t('adminCycle')}</TableCell>
              <TableCell>{t('adminCustomers')}</TableCell>
              <TableCell>{t('deviceStatus')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {directory.loaded ? (
              directory.plans.map((plan) => (
                <TableRow
                  key={plan.id}
                  hover
                  className={access.billingManage ? classes.row : undefined}
                  onClick={access.billingManage ? () => setEditing(plan) : undefined}
                >
                  <TableCell>
                    <span className={classes.name}>{plan.name}</span>
                    {plan.description && (
                      <Typography variant="caption" className={classes.sub}>
                        {plan.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell className={classes.number}>{money(plan.price_per_device)}</TableCell>
                  <TableCell className={classes.number}>{money(plan.base_price)}</TableCell>
                  <TableCell className={classes.number}>{money(plan.setup_fee)}</TableCell>
                  <TableCell>{t(`adminCycle${capitalize(plan.cycle)}`)}</TableCell>
                  <TableCell className={classes.number}>{usage(plan.id)}</TableCell>
                  <TableCell>
                    <StateChip
                      state={plan.active ? 'active' : 'archived'}
                      label={t(plan.active ? 'adminPlanActive' : 'adminPlanInactive')}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableShimmer columns={7} />
            )}
          </TableBody>
        </DataTable>
      )}
      {editing && (
        <Dialog open onClose={keepOnBackdrop(() => setEditing(null))} maxWidth="sm" fullWidth>
          <DialogTitle>{editing.id ? editing.name : t('adminNewPlan')}</DialogTitle>
          <DialogContent className={classes.form}>
            <TextField
              className={classes.wide}
              required
              label={t('sharedName')}
              value={editing.name}
              onChange={set('name')}
              autoFocus
            />
            <TextField
              className={classes.wide}
              label={t('sharedDescription')}
              value={editing.description || ''}
              onChange={set('description')}
            />
            <TextField
              type="number"
              label={t('adminPricePerDevice')}
              value={editing.price_per_device}
              onChange={set('price_per_device')}
              helperText={t('adminPerMonthBeforeVat')}
            />
            <TextField
              type="number"
              label={t('adminBasePrice')}
              value={editing.base_price}
              onChange={set('base_price')}
              helperText={t('adminBasePriceHelp')}
            />
            <TextField
              type="number"
              label={t('adminSetupFee')}
              value={editing.setup_fee}
              onChange={set('setup_fee')}
            />
            <TextField select label={t('adminCycle')} value={editing.cycle} onChange={set('cycle')}>
              {cycles.map((cycle) => (
                <MenuItem key={cycle} value={cycle}>
                  {t(`adminCycle${capitalize(cycle)}`)}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              className={classes.wide}
              control={
                <Switch
                  checked={editing.active}
                  onChange={(event) => setEditing({ ...editing, active: event.target.checked })}
                />
              }
              label={t('adminPlanActive')}
            />
          </DialogContent>
          <DialogActions>
            {editing.id && usage(editing.id) === 0 && (
              <Button color="error" onClick={handleDelete}>
                {t('sharedRemove')}
              </Button>
            )}
            <span className={classes.spacer} />
            <Button variant="outlined" color="inherit" onClick={() => setEditing(null)}>
              {t('sharedCancel')}
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={!editing.name.trim()}>
              {t('sharedSave')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </PageLayout>
  );
};

export default PlansPage;
