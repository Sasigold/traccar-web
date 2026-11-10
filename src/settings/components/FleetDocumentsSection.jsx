import { useCallback, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogTitle,
  IconButton,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ResponsiveTable from '../../common/components/table/ResponsiveTable';
import { makeStyles } from 'tss-react/mui';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import FileInput from '../../common/components/FileInput';
import SelectField from '../../common/components/SelectField';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { fleetConfig } from '../../common/fleet/config';
import {
  daysUntil,
  documentExpiryStatus,
  useFleetError,
  useFleetLabel,
  useFleetPermission,
  useFleetProfile,
  useFleetStatus,
} from '../../common/fleet/useFleet';
import FormSection from './FormSection';
import { DateField } from '../../common/components/pickers';
import { formatTime } from '../../common/util/formatter';
import { formatDays } from '../../common/util/plural';
import { shrinkImage } from '../../common/fleet/outbox';
import { isImagePath } from '../../fleet/fleetData';

const useStyles = makeStyles()((theme) => ({
  table: {
    '& .MuiTableCell-root': {
      paddingInline: theme.spacing(1),
    },
  },
  form: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  fullRow: {
    gridColumn: '1 / -1',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
  },
  rowActions: {
    whiteSpace: 'nowrap',
    width: '1%',
  },
}));

const statusColor = { expired: 'error', expiring: 'warning', valid: 'success', none: 'default' };

export const ExpiryChip = ({ expiresAt, reminderDays }) => {
  const t = useTranslation();
  const status = documentExpiryStatus(expiresAt, reminderDays);
  const days = expiresAt ? daysUntil(expiresAt) : null;
  const labelKey = {
    expired: 'fleetStatusExpired',
    expiring: 'fleetStatusExpiring',
    valid: 'fleetStatusValid',
    none: 'fleetStatusNoExpiry',
  }[status];
  const detail =
    days == null
      ? null
      : days < 0
        ? t('fleetDaysOverdue').replace('{0}', formatDays(-days, t))
        : t('fleetDaysLeft').replace('{0}', formatDays(days, t));
  return (
    <Tooltip title={detail || ''}>
      <Chip
        size="small"
        color={statusColor[status]}
        variant={status === 'none' ? 'outlined' : 'filled'}
        label={t(labelKey)}
      />
    </Tooltip>
  );
};

const formatDate = (value) => formatTime(value, 'date');

const safeFileName = (name) => name.replace(/[^\w.\-֐-׿]+/g, '_');

const emptyForm = { document_type: null, title: '', issued_at: '', expires_at: '', file: null };

// Documents attached to a Traccar device (vehicle) or driver, stored in the
// Viper Fleet database. The matching vehicle/driver row is created on first upload.
const FleetDocumentsSection = ({ entity, traccarId, name, identifier }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const label = useFleetLabel();

  const status = useFleetStatus();
  const fleetError = useFleetError();
  const profile = useFleetProfile();
  const canWrite = useFleetPermission('documents.write');

  const [types, setTypes] = useState([]);
  const [record, setRecord] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(null);

  const table = entity === 'vehicle' ? 'vehicles' : 'drivers';
  const idColumn = entity === 'vehicle' ? 'traccar_device_id' : 'traccar_driver_id';
  const fkColumn = entity === 'vehicle' ? 'vehicle_id' : 'driver_id';
  const folder = entity === 'vehicle' ? 'vehicles' : 'drivers';

  const loadDocuments = useCallback(
    async (recordId) => {
      const client = getFleetClient();
      const rows = unwrap(
        await client
          .from('documents')
          .select('*, document_types(label_he, label_en)')
          .eq(fkColumn, recordId)
          .order('expires_at', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false }),
      );
      setDocuments(rows || []);
    },
    [fkColumn],
  );

  useAsyncTask(async () => {
    if (status !== 'ready' || !traccarId) {
      return;
    }
    setLoading(true);
    try {
      const client = getFleetClient();
      const [typeRows, existing] = await Promise.all([
        client.from('document_types').select('*').eq('entity', entity).order('sort_order'),
        client.from(table).select('id, org_id').eq(idColumn, traccarId).maybeSingle(),
      ]);
      setTypes(unwrap(typeRows) || []);
      const row = unwrap(existing);
      setRecord(row);
      if (row) {
        await loadDocuments(row.id);
      } else {
        setDocuments([]);
      }
    } finally {
      setLoading(false);
    }
  }, [status, traccarId, entity, table, idColumn, loadDocuments]);

  const ensureRecord = async () => {
    if (record) {
      return record;
    }
    const client = getFleetClient();
    const payload =
      entity === 'vehicle'
        ? { org_id: profile.org_id, traccar_device_id: traccarId, plate_number: identifier || name }
        : { org_id: profile.org_id, traccar_driver_id: traccarId, full_name: name || identifier };
    const created = unwrap(await client.from(table).insert(payload).select('id, org_id').single());
    setRecord(created);
    return created;
  };

  const handleUpload = useCatch(async () => {
    setUploading(true);
    try {
      const client = getFleetClient();
      const target = await ensureRecord();
      // SEC-17: a photo is drawn again before upload (without its GPS position).
      const file = await shrinkImage(form.file, 2400);
      const path = `${target.org_id}/${folder}/${target.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      unwrap(
        await client.storage.from(fleetConfig.bucket).upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        }),
      );
      unwrap(
        await client.from('documents').insert({
          org_id: target.org_id,
          entity,
          [fkColumn]: target.id,
          document_type: form.document_type,
          title: form.title || null,
          file_path: path,
          file_name: form.file.name,
          mime_type: form.file.type || null,
          size_bytes: form.file.size,
          issued_at: form.issued_at || null,
          expires_at: form.expires_at || null,
          uploaded_by: profile.id,
        }),
      );
      setForm(emptyForm);
      await loadDocuments(target.id);
    } finally {
      setUploading(false);
    }
  });

  const handleOpen = useCatch(async (document) => {
    const client = getFleetClient();
    const { signedUrl } = unwrap(
      await client.storage
        .from(fleetConfig.bucket)
        .createSignedUrl(
          document.file_path,
          120,
          isImagePath(document.file_path) ? undefined : { download: true },
        ),
    );
    window.open(signedUrl, '_blank', 'noopener');
  });

  const handleRemove = useCatch(async () => {
    const document = removing;
    setRemoving(null);
    const client = getFleetClient();
    if (document.file_path) {
      unwrap(await client.storage.from(fleetConfig.bucket).remove([document.file_path]));
    }
    unwrap(await client.from('documents').delete().eq('id', document.id));
    await loadDocuments(record.id);
  });

  const selectedType = types.find((type) => type.key === form.document_type);
  const canSubmit =
    Boolean(form.file && form.document_type) &&
    !(selectedType?.requires_expiry && !form.expires_at);

  if (status === 'disabled' || status === 'idle') {
    return null;
  }

  return (
    <FormSection
      title={t('fleetDocuments')}
      description={t('fleetDocumentsDescription')}
      icon={<DescriptionRoundedIcon />}
    >
      {status === 'error' && (
        <Alert severity="warning">
          {t('fleetConnectionError').replace('{0}', fleetError || '')}
        </Alert>
      )}
      {status === 'loading' && <Typography color="textSecondary">{t('sharedLoading')}</Typography>}
      {status === 'ready' && !traccarId && (
        <Typography color="textSecondary">{t('fleetSaveFirst')}</Typography>
      )}
      {status === 'ready' && traccarId && (
        <>
          {!loading && documents.length === 0 && (
            <Typography color="textSecondary">{t('fleetNoDocuments')}</Typography>
          )}
          {documents.length > 0 && (
            <ResponsiveTable size="small" className={classes.table}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('fleetDocumentType')}</TableCell>
                  <TableCell>{t('fleetDocumentTitle')}</TableCell>
                  <TableCell>{t('fleetExpiresAt')}</TableCell>
                  <TableCell />
                  <TableCell className={classes.rowActions} />
                </TableRow>
              </TableHead>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>{label(document.document_types)}</TableCell>
                    <TableCell>{document.title || document.file_name}</TableCell>
                    <TableCell>{formatDate(document.expires_at)}</TableCell>
                    <TableCell>
                      <ExpiryChip
                        expiresAt={document.expires_at}
                        reminderDays={document.reminder_days}
                      />
                    </TableCell>
                    <TableCell className={classes.rowActions} padding="none">
                      <IconButton
                        size="small"
                        aria-label={t('fleetOpenFile')}
                        onClick={() => handleOpen(document)}
                      >
                        <OpenInNewRoundedIcon fontSize="small" />
                      </IconButton>
                      {canWrite && (
                        <IconButton
                          size="small"
                          aria-label={t('sharedRemove')}
                          onClick={() => setRemoving(document)}
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </ResponsiveTable>
          )}
          {canWrite && (
            <>
              <div className={classes.form}>
                <SelectField
                  label={t('fleetDocumentType')}
                  value={form.document_type}
                  onChange={(event) => setForm({ ...form, document_type: event.target.value })}
                  data={types}
                  keyGetter={(type) => type.key}
                  titleGetter={label}
                />
                <TextField
                  label={t('fleetDocumentTitle')}
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
                <DateField
                  label={t('fleetIssuedAt')}
                  value={form.issued_at}
                  onChange={(event) => setForm({ ...form, issued_at: event.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <DateField
                  renewal
                  label={t('fleetExpiresAt')}
                  value={form.expires_at}
                  min={form.issued_at}
                  onChange={(event) => setForm({ ...form, expires_at: event.target.value })}
                  required={Boolean(selectedType?.requires_expiry)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <div className={classes.fullRow}>
                  <FileInput
                    placeholder={t('fleetFile')}
                    value={form.file}
                    onChange={(file) => setForm({ ...form, file })}
                    slotProps={{ htmlInput: { accept: '.pdf,image/*,.doc,.docx,.xls,.xlsx' } }}
                  />
                </div>
              </div>
              <div className={classes.actions}>
                <Button
                  variant="contained"
                  startIcon={<UploadFileRoundedIcon />}
                  disabled={!canSubmit || uploading}
                  onClick={handleUpload}
                >
                  {t(uploading ? 'fleetUploading' : 'fleetUpload')}
                </Button>
              </div>
            </>
          )}
        </>
      )}
      <Dialog open={Boolean(removing)} onClose={() => setRemoving(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('fleetDeleteDocument')}</DialogTitle>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setRemoving(null)} autoFocus>
            {t('sharedCancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            startIcon={<DeleteOutlineRoundedIcon />}
            onClick={handleRemove}
          >
            {t('sharedRemove')}
          </Button>
        </DialogActions>
      </Dialog>
    </FormSection>
  );
};

export default FleetDocumentsSection;
