import { useReducer, useState } from 'react';
import MaskedValue from '../common/components/MaskedValue';
import { useParams } from 'react-router-dom';
import {
  Button,
  Paper,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ResponsiveTable from '../common/components/table/ResponsiveTable';
import { makeStyles } from 'tss-react/mui';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import BrandLogo from '../common/components/brand/BrandLogo';
import { useAsyncTask } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { formatTime } from '../common/util/formatter';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetLabel, useFleetPermission } from '../common/fleet/useFleet';
import FleetNotice from './components/FleetNotice';
import ExpiryBadge from './components/ExpiryBadge';
import SafetyRecordDialog from './components/SafetyRecordDialog';
import { violationKey } from './components/ViolationDialog';
import { incidentKey } from './IncidentsPage';
import { money } from './fleetData';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(1, 3, 4),
    maxWidth: 960,
    width: '100%',
    marginInline: 'auto',
    '@media print': {
      padding: 0,
      maxWidth: 'none',
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  section: {
    padding: theme.spacing(2, 2.5),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    breakInside: 'avoid',
    '@media print': {
      border: 'none',
      padding: theme.spacing(1, 0),
    },
  },
  details: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(1, 2),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
  },
  label: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
  },
  actions: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    '@media print': {
      display: 'none',
    },
  },
  nowrap: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
}));

const Section = ({ title, children }) => {
  const { classes } = useStyles();
  return (
    <Paper elevation={0} className={classes.section} component="section">
      <Typography variant="subtitle1" fontWeight={700}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
};

const capital = (value) => value.replace(/^\w/, (c) => c.toUpperCase());

// Roadmap 4.7: the driver file for the transport safety officer, printable as a PDF.
const DriverFilePage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const label = useFleetLabel();
  const { id } = useParams();
  const canRead = useFleetPermission('safety.read');
  const canWrite = useFleetPermission('safety.write');
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [file, setFile] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [producedAt] = useState(() => new Date());

  useAsyncTask(async () => {
    void reloadKey;
    if (!canRead) {
      return;
    }
    const traccar = await (await fetchOrThrow(`api/drivers/${id}`)).json();
    const client = getFleetClient();
    const row = unwrap(
      await client.from('drivers').select('*').eq('traccar_driver_id', id).maybeSingle(),
    );
    if (!row) {
      setFile({ traccar, row: null });
      return;
    }
    const by = (table, order, select = '*') =>
      client.from(table).select(select).eq('driver_id', row.id).order(order, { ascending: false });
    const [documents, assignment, trainings, checks, reviews, violations, incidents] =
      await Promise.all([
        by('documents_expiring', 'expires_at'),
        client.from('current_assignments').select('*').eq('driver_id', row.id).limit(1),
        by('driver_trainings', 'held_at'),
        by('driver_license_checks', 'checked_at'),
        by('safety_reviews', 'held_at'),
        by('driver_violations', 'occurred_at', '*, vehicles(plate_number)'),
        by(
          'incidents',
          'occurred_at',
          'id, number, occurred_at, type, fault, status, vehicles(plate_number)',
        ),
      ]);
    setFile({
      traccar,
      row,
      documents: unwrap(documents) || [],
      assignment: (unwrap(assignment) || [])[0] || null,
      trainings: unwrap(trainings) || [],
      checks: unwrap(checks) || [],
      reviews: unwrap(reviews) || [],
      violations: unwrap(violations) || [],
      incidents: incidents.error ? [] : incidents.data || [],
    });
  }, [id, canRead, reloadKey]);

  const attributes = file?.traccar?.attributes || {};
  const detail = (labelKey, value, ltr) =>
    value ? (
      <div key={labelKey}>
        <div className={classes.label}>{t(labelKey)}</div>
        <Typography variant="body2" component="div" dir={ltr ? 'ltr' : undefined}>
          {value}
        </Typography>
      </div>
    ) : null;

  const table = (headers, rows) => (
    <ResponsiveTable size="small">
      <TableHead>
        <TableRow>
          {headers.map((header) => (
            <TableCell key={header}>{t(header)}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>{rows}</TableBody>
    </ResponsiveTable>
  );

  const empty = (
    <Typography variant="body2" color="textSecondary">
      {t('fleetHistoryEmpty')}
    </Typography>
  );

  return (
    <PageLayout breadcrumbs={['fleetTitle', 'fleetDriverFile']} backTo={`/settings/driver/${id}`}>
      <FleetNotice permission="safety.read" />
      {file && (
        <div className={classes.root}>
          <div className={classes.header}>
            <div>
              <Typography variant="h5" component="h1" fontWeight={700}>
                {t('fleetDriverFile')}: {file.traccar.name}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {t('fleetDriverFilePrinted').replace('{0}', formatTime(producedAt, 'minutes'))}
              </Typography>
            </div>
            <BrandLogo height={28} />
          </div>
          <div className={classes.actions}>
            <Button
              variant="contained"
              startIcon={<PrintRoundedIcon />}
              onClick={() => window.print()}
            >
              {t('fleetDriverFilePrint')}
            </Button>
            {canWrite &&
              ['check', 'training', 'review'].map((kind) => (
                <Button key={kind} variant="outlined" onClick={() => setDialog(kind)}>
                  {t(`fleetSafetyAdd${capital(kind)}`)}
                </Button>
              ))}
          </div>

          <Section title={t('fleetDriverDetails')}>
            <div className={classes.details}>
              {detail(
                'fleetNationalId',
                (file.row?.national_id || attributes.nationalId) && (
                  <MaskedValue value={file.row?.national_id || attributes.nationalId} />
                ),
              )}
              {detail('sharedPhone', file.row?.phone || attributes.phone, true)}
              {detail(
                'fleetHireDate',
                formatTime(file.row?.hire_date || attributes.hireDate, 'date'),
              )}
              {detail(
                'fleetLicenseNumber',
                (file.row?.license_number || attributes.licenseNumber) && (
                  <MaskedValue value={file.row?.license_number || attributes.licenseNumber} />
                ),
                true,
              )}
              {detail(
                'fleetLicenseClasses',
                (file.row?.license_classes?.length
                  ? file.row.license_classes
                  : attributes.licenseClasses || []
                ).join(', '),
                true,
              )}
              {detail(
                'fleetLicenseExpiry',
                formatTime(file.row?.license_expiry || attributes.licenseExpiry, 'date'),
              )}
              {detail('fleetAssignedVehicle', file.assignment?.plate_number, true)}
              {detail('deviceIdentifier', file.traccar.uniqueId, true)}
            </div>
          </Section>

          {file.row ? (
            <>
              <Section title={t('fleetDriverPortalMyDocuments')}>
                {file.documents.length === 0
                  ? empty
                  : table(
                      ['fleetDocumentType', 'fleetExpiresAt', 'deviceStatus'],
                      file.documents.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{label(row)}</TableCell>
                          <TableCell className={classes.nowrap}>
                            {formatTime(row.expires_at, 'date')}
                          </TableCell>
                          <TableCell>
                            <ExpiryBadge date={row.expires_at} />
                          </TableCell>
                        </TableRow>
                      )),
                    )}
              </Section>
              <Section title={t('fleetSafetyChecks')}>
                {file.checks.length === 0
                  ? empty
                  : table(
                      [
                        'fleetExpenseDate',
                        'fleetCheckLicenseValid',
                        'fleetCheckFindings',
                        'fleetSafetyNextCheck',
                      ],
                      file.checks.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className={classes.nowrap}>
                            {formatTime(row.checked_at, 'date')}
                          </TableCell>
                          <TableCell>
                            {t(
                              row.license_valid
                                ? 'fleetIncidentPreventableYes'
                                : 'fleetIncidentPreventableNo',
                            )}
                          </TableCell>
                          <TableCell>
                            {[row.findings, row.recommendation].filter(Boolean).join(' · ')}
                          </TableCell>
                          <TableCell className={classes.nowrap}>
                            {formatTime(row.next_check_at, 'date')}
                          </TableCell>
                        </TableRow>
                      )),
                    )}
              </Section>
              <Section title={t('fleetSafetyTrainings')}>
                {file.trainings.length === 0
                  ? empty
                  : table(
                      [
                        'fleetExpenseDate',
                        'fleetTrainingTopic',
                        'fleetTrainingHours',
                        'fleetTrainingTrainer',
                      ],
                      file.trainings.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className={classes.nowrap}>
                            {formatTime(row.held_at, 'date')}
                          </TableCell>
                          <TableCell>{row.topic}</TableCell>
                          <TableCell>{row.hours ?? ''}</TableCell>
                          <TableCell>{row.trainer}</TableCell>
                        </TableRow>
                      )),
                    )}
              </Section>
              <Section title={t('fleetSafetyReviews')}>
                {file.reviews.length === 0
                  ? empty
                  : table(
                      [
                        'fleetExpenseDate',
                        'sharedType',
                        'fleetReviewSummary',
                        'fleetReviewDecisions',
                      ],
                      file.reviews.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className={classes.nowrap}>
                            {formatTime(row.held_at, 'date')}
                          </TableCell>
                          <TableCell>{t(`fleetReviewKind${capital(row.kind)}`)}</TableCell>
                          <TableCell>{row.summary}</TableCell>
                          <TableCell>{row.decisions}</TableCell>
                        </TableRow>
                      )),
                    )}
              </Section>
              <Section title={t('fleetSafetyViewViolations')}>
                {file.violations.length === 0
                  ? empty
                  : table(
                      [
                        'fleetIncidentOccurred',
                        'fleetEntityVehicle',
                        'sharedType',
                        'fleetViolationFine',
                        'fleetViolationPoints',
                        'deviceStatus',
                      ],
                      file.violations.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className={classes.nowrap}>
                            {formatTime(row.occurred_at, 'date')}
                          </TableCell>
                          <TableCell>
                            <span dir="ltr">{row.vehicles?.plate_number}</span>
                          </TableCell>
                          <TableCell>{t(violationKey('Type', row.type))}</TableCell>
                          <TableCell className={classes.nowrap}>{money(row.fine_amount)}</TableCell>
                          <TableCell>{row.points ?? ''}</TableCell>
                          <TableCell>{t(violationKey('Status', row.status))}</TableCell>
                        </TableRow>
                      )),
                    )}
              </Section>
              <Section title={t('fleetIncidentsPage')}>
                {file.incidents.length === 0
                  ? empty
                  : table(
                      [
                        'fleetIncidentOccurred',
                        'fleetEntityVehicle',
                        'sharedType',
                        'fleetIncidentFault',
                        'deviceStatus',
                      ],
                      file.incidents.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className={classes.nowrap}>
                            {formatTime(row.occurred_at, 'date')}
                          </TableCell>
                          <TableCell>
                            <span dir="ltr">{row.vehicles?.plate_number}</span>
                          </TableCell>
                          <TableCell>{t(incidentKey('Type', row.type))}</TableCell>
                          <TableCell>{t(incidentKey('Fault', row.fault))}</TableCell>
                          <TableCell>{t(incidentKey('Status', row.status))}</TableCell>
                        </TableRow>
                      )),
                    )}
              </Section>
            </>
          ) : (
            <Typography color="textSecondary">{t('fleetDriverFileNotInDatabase')}</Typography>
          )}
        </div>
      )}
      {dialog && file && (
        <SafetyRecordDialog
          kind={dialog}
          driver={file.traccar}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
    </PageLayout>
  );
};

export default DriverFilePage;
