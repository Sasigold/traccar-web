import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Button,
  Link,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ApiRoundedIcon from '@mui/icons-material/ApiRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import { downloadJson } from '../common/util/downloadFile';
import { useLocalization, useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from '../settings/components/SettingsMenu';
import FormSection from '../settings/components/FormSection';
import { useAsyncTask } from '../reactHelper';
import { fleetConfig } from '../common/fleet/config';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission } from '../common/fleet/useFleet';
import { RESOURCES } from '../../supabase/functions/public-api/resources.js';
import { buildOpenApi } from '../../supabase/functions/public-api/openapi.js';
import { apiBaseUrl, apiLimits, curlExample, powerBiQuery } from './apiDocs';
import CopyButton from '../common/components/CopyButton';

const useStyles = makeStyles()((theme) => ({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(0, 3, 3),
    maxWidth: 960,
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(0, 2, 2),
    },
  },
  row: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  code: {
    margin: 0,
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.text.primary,
    fontFamily: theme.tokens.font.mono,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 13,
    lineHeight: 1.6,
    overflowX: 'auto',
    whiteSpace: 'pre',
    // "start" is not flipped by the RTL plugin and, with dir="ltr", means left.
    textAlign: 'start',
  },
  inline: {
    fontFamily: theme.tokens.font.mono,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 13,
    wordBreak: 'break-all',
  },
  steps: {
    margin: 0,
    paddingInlineStart: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
  },
  table: {
    overflowX: 'auto',
  },
  figures: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(1.5),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  figure: {
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.tint,
  },
  figureLabel: {
    color: theme.palette.surface.textSecondaryOnTint,
  },
  figureValue: {
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
}));

// A block of code, left to right, with a copy button.
const CodeBlock = ({ code, label }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className={classes.row} style={{ justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">{label}</Typography>
        <Button
          size="small"
          startIcon={<ContentCopyRoundedIcon />}
          onClick={async () => {
            await navigator.clipboard?.writeText(code);
            setCopied(true);
          }}
        >
          {t(copied ? 'apiDocsCopied' : 'sharedCopy')}
        </Button>
      </div>
      <pre className={classes.code} dir="ltr" tabIndex={0} role="region" aria-label={label}>
        {code}
      </pre>
    </div>
  );
};

const download = downloadJson;

// /fleet/integrations/api (INT-01): how to read the fleet data from Power BI, Excel or another
// system with an API key, the resources, the limits and the OpenAPI document.
const ApiDocsPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const { language } = useLocalization();
  const canManage = useFleetPermission('integrations.manage');
  const lang = language === 'he' ? 'he' : 'en';
  const base = apiBaseUrl(fleetConfig.url);
  const [resource, setResource] = useState('vehicles');
  const [usage, setUsage] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      if (!canManage) {
        return;
      }
      const since = new Date(Date.now() - 24 * 3600000).toISOString();
      const [limits, rows] = await Promise.all([
        getFleetClient().from('api_limits').select('per_minute, per_day').abortSignal(signal),
        getFleetClient()
          .from('api_usage')
          .select('count')
          .gte('minute', since)
          .limit(5000)
          .abortSignal(signal),
      ]);
      setUsage({
        limits: apiLimits(unwrap(limits)?.[0]),
        today: (unwrap(rows) || []).reduce((sum, row) => sum + row.count, 0),
      });
    },
    [canManage],
  );

  const resources = useMemo(
    () => RESOURCES.map((item) => ({ name: item.name, ...(item[lang] ?? item.en) })),
    [lang],
  );
  const number = (value) => Number(value).toLocaleString(language);

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetIntegrationsPage', 'apiDocsTitle']}
      description={t('apiDocsDescription')}
    >
      <div className={classes.page}>
        <FormSection
          title={t('apiDocsStart')}
          description={t('apiDocsStartHelp')}
          icon={<ApiRoundedIcon />}
        >
          <ol className={classes.steps}>
            <li>
              {t('apiDocsStepKey')}{' '}
              <Link component={RouterLink} to="/fleet/integrations">
                {t('apiDocsStepKeyLink')}
              </Link>
            </li>
            <li>{t('apiDocsStepHeader')}</li>
            <li>{t('apiDocsStepPages')}</li>
          </ol>
          <div>
            <Typography variant="subtitle2">{t('apiDocsBaseUrl')}</Typography>
            <div className={classes.row}>
              <Typography className={classes.inline} dir="ltr">
                {base}
              </Typography>
              <CopyButton icon text={base} />
            </div>
          </div>
          <CodeBlock label={t('apiDocsExample')} code={curlExample(base, resource)} />
        </FormSection>

        <FormSection
          title={t('apiDocsResources')}
          description={t('apiDocsResourcesHelp')}
          icon={<TableChartRoundedIcon />}
        >
          <div className={classes.table}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('apiDocsResource')}</TableCell>
                  <TableCell>{t('sharedName')}</TableCell>
                  <TableCell>{t('sharedDescription')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {resources.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell className={classes.inline} dir="ltr">
                      {`/${item.name}`}
                    </TableCell>
                    <TableCell>{item.title}</TableCell>
                    <TableCell>{item.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className={classes.row}>
            <Button
              variant="outlined"
              startIcon={<FileDownloadRoundedIcon />}
              onClick={() =>
                download(
                  'viper-fleet-openapi.he.json',
                  buildOpenApi({ lang: 'he', serverUrl: base }),
                )
              }
            >
              {t('apiDocsOpenApiHe')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileDownloadRoundedIcon />}
              onClick={() =>
                download(
                  'viper-fleet-openapi.en.json',
                  buildOpenApi({ lang: 'en', serverUrl: base }),
                )
              }
            >
              {t('apiDocsOpenApiEn')}
            </Button>
          </div>
        </FormSection>

        <FormSection
          title={t('apiDocsPowerBi')}
          description={t('apiDocsPowerBiHelp')}
          icon={<InsightsRoundedIcon />}
        >
          <TextField
            select
            label={t('apiDocsResource')}
            value={resource}
            onChange={(event) => setResource(event.target.value)}
            sx={{ maxWidth: 320 }}
          >
            {resources.map((item) => (
              <MenuItem key={item.name} value={item.name}>
                {item.title}
              </MenuItem>
            ))}
          </TextField>
          <ol className={classes.steps}>
            <li>{t('apiDocsPowerBiStep1')}</li>
            <li>{t('apiDocsPowerBiStep2')}</li>
            <li>{t('apiDocsPowerBiStep3')}</li>
          </ol>
          <CodeBlock label={t('apiDocsPowerBiQuery')} code={powerBiQuery(base, resource)} />
        </FormSection>

        {canManage && usage && (
          <FormSection
            title={t('apiDocsLimits')}
            description={t('apiDocsLimitsHelp')}
            icon={<SpeedRoundedIcon />}
          >
            <div className={classes.figures}>
              {[
                ['apiDocsPerMinute', usage.limits.perMinute],
                ['apiDocsPerDay', usage.limits.perDay],
                ['apiDocsUsedToday', usage.today],
              ].map(([key, value]) => (
                <div key={key} className={classes.figure}>
                  <Typography variant="body2" className={classes.figureLabel}>
                    {t(key)}
                  </Typography>
                  <Typography variant="h6" className={classes.figureValue}>
                    {number(value)}
                  </Typography>
                </div>
              ))}
            </div>
          </FormSection>
        )}
      </div>
    </PageLayout>
  );
};

export default ApiDocsPage;
