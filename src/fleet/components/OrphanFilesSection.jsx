import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import FolderDeleteRoundedIcon from '@mui/icons-material/FolderDeleteRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useCatch } from '../../reactHelper';
import FormSection from '../../settings/components/FormSection';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { FILES_BUCKET } from '../fleetData';
import { formatGrouped, formatTime } from '../../common/util/formatter';

// Storage removes at most this many paths per request.
const BATCH = 100;

const megabytes = (bytes) => formatGrouped(bytes / (1024 * 1024), 1);

// SEC-17: files no row points to any more (a deleted record, an upload whose save failed), older
// than 30 days. Found on demand, removed through Storage after a confirmation.
const OrphanFilesSection = () => {
  const t = useTranslation();
  const [orphans, setOrphans] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removed, setRemoved] = useState(null);

  const find = useCatch(async () => {
    setRemoved(null);
    setOrphans(unwrap(await getFleetClient().rpc('fleet_orphan_files')) || []);
  });

  const remove = useCatch(async () => {
    setRemoving(true);
    try {
      const names = orphans.map((file) => file.name);
      for (let index = 0; index < names.length; index += BATCH) {
        unwrap(
          await getFleetClient()
            .storage.from(FILES_BUCKET)
            .remove(names.slice(index, index + BATCH)),
        );
      }
      setRemoved(names.length);
      setOrphans([]);
      setConfirming(false);
    } finally {
      setRemoving(false);
    }
  });

  const total = (orphans || []).reduce((sum, file) => sum + Number(file.size || 0), 0);

  return (
    <FormSection
      title={t('orphanFilesTitle')}
      description={t('orphanFilesHelp')}
      icon={<FolderDeleteRoundedIcon />}
      actions={
        <Button size="small" onClick={find}>
          {t('orphanFilesFind')}
        </Button>
      }
    >
      {orphans && (
        <Typography variant="body2" role="status">
          {orphans.length
            ? t('orphanFilesFound')
                .replace('{0}', String(orphans.length))
                .replace('{1}', megabytes(total))
                .replace('{2}', formatTime(orphans[0].created_at, 'date'))
            : t('orphanFilesNone')}
        </Typography>
      )}
      {removed != null && (
        <Typography variant="body2" role="status">
          {t('orphanFilesRemoved').replace('{0}', String(removed))}
        </Typography>
      )}
      {orphans?.length > 0 && (
        <div>
          <Button variant="outlined" color="error" onClick={() => setConfirming(true)}>
            {t('orphanFilesRemove').replace('{0}', String(orphans.length))}
          </Button>
        </div>
      )}
      <Dialog open={confirming} onClose={() => !removing && setConfirming(false)}>
        <DialogTitle>{t('orphanFilesTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('orphanFilesConfirm').replace('{0}', String(orphans?.length || 0))}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(false)} disabled={removing}>
            {t('sharedCancel')}
          </Button>
          <Button variant="contained" color="error" onClick={remove} loading={removing}>
            {t('sharedRemove')}
          </Button>
        </DialogActions>
      </Dialog>
    </FormSection>
  );
};

export default OrphanFilesSection;
