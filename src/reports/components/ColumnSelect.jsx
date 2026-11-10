import { use, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import ReportColumnsContext from './reportColumns';
import { useTranslation } from '../../common/components/LocalizationProvider';
import useReportStyles from '../common/useReportStyles';

const ColumnSelect = ({ columns, setColumns, columnsArray, rawValues, disabled }) => {
  const { classes } = useReportStyles();
  const t = useTranslation();
  const columnsRef = use(ReportColumnsContext);
  const [searchParams, setSearchParams] = useSearchParams();

  // REP-09: the columns a saved view opens with (?columns=a,b), then the address is clean again.
  const wanted = searchParams.get('columns');
  useEffect(() => {
    if (!wanted) return;
    const known = new Set(columnsArray.map(([key]) => key));
    const chosen = wanted.split(',').filter((key) => known.has(key));
    if (chosen.length) setColumns(chosen);
    const next = new URLSearchParams(searchParams);
    next.delete('columns');
    setSearchParams(next, { replace: true });
  }, [wanted]); // eslint-disable-line @eslint-react/exhaustive-deps

  useEffect(() => {
    if (columnsRef) columnsRef.current = columns;
  }, [columnsRef, columns]);

  return (
    <div className={classes.filterItem}>
      <FormControl fullWidth>
        <InputLabel id="column-select-shared-columns-label">{t('reportColumnsLabel')}</InputLabel>
        <Select
          labelId="column-select-shared-columns-label"
          label={t('reportColumnsLabel')}
          value={columns}
          onChange={(e) => setColumns(e.target.value)}
          multiple
          disabled={disabled}
        >
          {columnsArray.map(([key, string]) => (
            <MenuItem key={key} value={key}>
              {rawValues ? string : t(string)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
};

export default ColumnSelect;
