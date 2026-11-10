import { useState } from 'react';
import { useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import BrandLogo from '../../common/components/brand/BrandLogo';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { formatTime } from '../../common/util/formatter';
import { vehicleTitle } from '../common/vehicle';

const useStyles = makeStyles()((theme) => ({
  // REP-16: printed pages only: what this is, for when, for which vehicles, by whom.
  root: {
    display: 'none',
    '@media print': {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing(3),
      paddingBottom: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
      borderBottom: `2px solid ${theme.palette.brand.ink}`,
      color: theme.palette.brand.ink,
    },
  },
  title: {
    margin: 0,
    fontSize: '1.4rem',
    fontWeight: 700,
  },
  meta: {
    margin: theme.spacing(0.5, 0, 0),
    fontSize: '0.8rem',
    lineHeight: 1.6,
  },
}));

// Up to five vehicles by name, then "+N".
export const scopeText = (devices, deviceIds, groups, groupIds, t) => {
  const names = deviceIds.filter((id) => id !== 'all').map((id) => vehicleTitle(devices, id));
  const groupNames = groupIds.map((id) => groups[id]?.name).filter(Boolean);
  const all = [...groupNames, ...names];
  if (!all.length) return t('reportAllVehicles');
  return all.length > 5 ? `${all.slice(0, 5).join(', ')} +${all.length - 5}` : all.join(', ');
};

const PrintHeader = ({ title, from, to, deviceIds, groupIds }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const devices = useSelector((state) => state.devices.items);
  const groups = useSelector((state) => state.groups.items);
  const user = useSelector((state) => state.session.user);
  const [producedAt] = useState(() => new Date());
  if (!from || !to) return null;
  return (
    <header className={`${classes.root} vf-print-header`} aria-hidden="true">
      <div>
        <h1 className={classes.title}>{title}</h1>
        <p className={classes.meta}>
          {`${t('reportPeriod')}: `}
          <bdi dir="ltr">{`${formatTime(from, 'minutes')} – ${formatTime(to, 'minutes')}`}</bdi>
          <br />
          {`${t('deviceTitle')}: ${scopeText(devices, deviceIds, groups, groupIds, t)}`}
          <br />
          {t('reportPrintedBy')
            .replace('{0}', user?.name || '')
            .replace('{1}', '')}
          <bdi dir="ltr">{formatTime(producedAt, 'minutes')}</bdi>
        </p>
      </div>
      <BrandLogo variant="ink" height={40} />
    </header>
  );
};

export default PrintHeader;
