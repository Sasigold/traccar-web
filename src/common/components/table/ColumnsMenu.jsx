import { useState } from 'react';
import { Button, Checkbox, ListItemText, Menu, MenuItem } from '@mui/material';
import ViewColumnRoundedIcon from '@mui/icons-material/ViewColumnRounded';
import { useTranslation } from '../LocalizationProvider';

// ADM-25: which optional columns a list shows. `columns` is [{ key, label }]; `shown` the keys
// that are on. The caller keeps the choice (usePersistedState).
const ColumnsMenu = ({ columns, shown, onChange }) => {
  const t = useTranslation();
  const [anchor, setAnchor] = useState(null);
  const toggle = (key) =>
    onChange(shown.includes(key) ? shown.filter((item) => item !== key) : [...shown, key]);
  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<ViewColumnRoundedIcon />}
        onClick={(event) => setAnchor(event.currentTarget)}
        aria-haspopup="menu"
      >
        {t('tableColumns')}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {columns.map((column) => (
          <MenuItem
            key={column.key}
            onClick={() => toggle(column.key)}
            role="menuitemcheckbox"
            aria-checked={shown.includes(column.key)}
            dense
          >
            <Checkbox
              size="small"
              edge="start"
              checked={shown.includes(column.key)}
              tabIndex={-1}
              disableRipple
              slotProps={{ input: { 'aria-hidden': true } }}
            />
            <ListItemText>{column.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default ColumnsMenu;
