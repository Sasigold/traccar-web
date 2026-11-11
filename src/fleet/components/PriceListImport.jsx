import { useMemo, useState } from 'react';
import { Alert, Button, MenuItem, TextField, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useCatch } from '../../reactHelper';
import FileInput from '../../common/components/FileInput';
import readSheet from '../../common/util/readSheet';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { guessPriceColumns, parsePriceList } from '../../common/fleet/priceListImport';
import { capitalize } from '../../common/util/stringUtils';

const MAPPED = ['description', 'unit_price', 'kind'];

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
}));

// ISR-13: a supplier's whole price list from a CSV or Excel file. Known descriptions update their
// price; new ones are added.
const PriceListImport = ({ vendor, orgId, existing, onDone }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState(null);
  const [mapping, setMapping] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  const choose = useCatch(async (chosen) => {
    setFile(chosen);
    setDone(null);
    if (!chosen) {
      setRows(null);
      return;
    }
    const read = await readSheet(chosen);
    setRows(read);
    setMapping(guessPriceColumns(read[0] || []));
  });

  const result = useMemo(
    () =>
      rows && mapping.description != null && mapping.unit_price != null
        ? parsePriceList(rows, mapping, existing)
        : null,
    [rows, mapping, existing],
  );

  const save = useCatch(async () => {
    setSaving(true);
    try {
      const client = getFleetClient();
      const added = result.lines
        .filter((line) => !line.id)
        .map((line) => {
          const row = { ...line, org_id: orgId, vendor_id: vendor.id };
          delete row.id;
          return row;
        });
      if (added.length) {
        unwrap(await client.from('vendor_prices').insert(added));
      }
      for (const { id, ...line } of result.lines.filter((row) => row.id)) {
        unwrap(
          await client
            .from('vendor_prices')
            .update({ ...line, updated_at: new Date().toISOString() })
            .eq('id', id),
        );
      }
      setDone({ added: result.added, updated: result.updated });
      setFile(null);
      setRows(null);
      onDone();
    } finally {
      setSaving(false);
    }
  });

  const headers = rows?.[0] || [];

  return (
    <div className={classes.root}>
      <Typography variant="subtitle2" component="h3">
        {t('vendorPricesImport')}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        {t('vendorPricesImportHelp')}
      </Typography>
      <FileInput
        placeholder={t('vendorPricesImportChoose')}
        value={file}
        onChange={choose}
        slotProps={{ htmlInput: { accept: '.csv,.xlsx' } }}
      />
      {rows && (
        <>
          <div className={classes.columns}>
            {MAPPED.map((field) => (
              <TextField
                key={field}
                select
                size="small"
                label={t(
                  `vendorPricesColumn${capitalize(field === 'unit_price' ? 'price' : field)}`,
                )}
                value={mapping[field] ?? ''}
                onChange={(event) =>
                  setMapping({
                    ...mapping,
                    [field]: event.target.value === '' ? undefined : Number(event.target.value),
                  })
                }
              >
                {field === 'kind' && <MenuItem value="">{t('vendorPricesColumnNone')}</MenuItem>}
                {headers.map((header, index) => (
                  <MenuItem key={index} value={index}>
                    {String(header ?? '') || `#${index + 1}`}
                  </MenuItem>
                ))}
              </TextField>
            ))}
          </div>
          {result && (
            <Typography variant="body2" role="status">
              {t('vendorPricesImportSummary')
                .replace('{0}', String(result.added))
                .replace('{1}', String(result.updated))
                .replace('{2}', String(result.errors.length))}
            </Typography>
          )}
          {result?.errors.length > 0 && (
            <Alert severity="warning">
              {result.errors
                .slice(0, 5)
                .map((error) =>
                  t('vendorPricesImportError')
                    .replace('{0}', String(error.line))
                    .replace('{1}', t(`vendorPricesImportError${capitalize(error.error)}`)),
                )
                .join(' · ')}
            </Alert>
          )}
          <div className={classes.row}>
            <Button
              variant="outlined"
              onClick={save}
              disabled={saving || !result || result.lines.length === 0}
            >
              {t('vendorPricesImportSave').replace('{0}', String(result?.lines.length || 0))}
            </Button>
          </div>
        </>
      )}
      {done && (
        <Alert severity="success" role="status">
          {t('vendorPricesImportDone')
            .replace('{0}', String(done.added))
            .replace('{1}', String(done.updated))}
        </Alert>
      )}
    </div>
  );
};

export default PriceListImport;
