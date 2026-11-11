import { FormControlLabel, Switch } from '@mui/material';
import { useTranslation } from '../../common/components/LocalizationProvider';
import useReportStyles from '../common/useReportStyles';

// REP-09: "compare with the previous period" in a report's filter.
const CompareSwitch = ({ checked, onChange }) => {
  const { classes } = useReportStyles();
  const t = useTranslation();
  return (
    <div className={classes.filterItem}>
      <FormControlLabel
        control={<Switch checked={checked} onChange={(e) => onChange(e.target.checked)} />}
        label={t('reportComparePrevious')}
      />
    </div>
  );
};

export default CompareSwitch;
