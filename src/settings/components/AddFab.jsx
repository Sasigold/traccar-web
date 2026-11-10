import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../common/components/LocalizationProvider';
import BaseFab from '../../common/components/BaseFab';
import { useRestriction } from '../../common/util/permissions';

// Floating "add" button for phones; on desktop the table toolbar has the button.
const AddFab = ({ editPath, disabled, label }) => {
  const navigate = useNavigate();
  const t = useTranslation();
  const theme = useTheme();

  const readonly = useRestriction('readonly');
  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  if (!readonly && !disabled && !desktop) {
    return (
      <BaseFab onClick={() => navigate(editPath)} label={label || t('sharedAdd')}>
        <AddRoundedIcon />
      </BaseFab>
    );
  }
  return null;
};

export default AddFab;
