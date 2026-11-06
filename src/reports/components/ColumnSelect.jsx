import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { useTranslation } from '../../common/components/LocalizationProvider';
import useReportStyles from '../common/useReportStyles';

const ColumnSelect = ({ columns, setColumns, columnsArray, rawValues, disabled }) => {
  const { classes } = useReportStyles();
  const t = useTranslation();

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
