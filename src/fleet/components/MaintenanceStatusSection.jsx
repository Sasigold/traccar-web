import { useReducer, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, Typography } from '@mui/material';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import FormSection from '../../settings/components/FormSection';
import { loadMaintenanceLinks, useMaintenanceRows } from '../maintenance';
import MaintenanceStatusTable from './MaintenanceStatusTable';

// Maintenance linked to one vehicle: how much is left and "mark as done".
const MaintenanceStatusSection = ({ deviceId }) => {
  const t = useTranslation();
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [links, setLinks] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      const result = await loadMaintenanceLinks([deviceId], signal);
      setLinks(result.links);
    },
    [deviceId, reloadKey],
  );

  const rows = useMaintenanceRows(links);

  return (
    <FormSection
      title={t('sharedMaintenance')}
      description={t('fleetMaintenanceSectionDescription')}
      icon={<BuildRoundedIcon />}
      actions={
        <Button size="small" component={RouterLink} to="/settings/maintenances">
          {t('fleetMaintenanceManage')}
        </Button>
      }
    >
      {rows && rows.length > 0 && <MaintenanceStatusTable rows={rows} onDone={reload} />}
      {rows && rows.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          {t('fleetMaintenanceNone')}
        </Typography>
      )}
    </FormSection>
  );
};

export default MaintenanceStatusSection;
