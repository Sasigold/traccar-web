import { useState } from 'react';
import { useSelector } from 'react-redux';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import CountryFlag from 'react-country-flag';
import { useLocalization, useTranslation } from '../LocalizationProvider';

const LanguageMenu = () => {
  const t = useTranslation();
  const { languages, language, setLocalLanguage } = useLocalization();

  const remoteLanguage = useSelector(
    (state) =>
      state.session.user?.attributes?.language || state.session.server?.attributes?.language,
  );

  const [anchorEl, setAnchorEl] = useState(null);

  if (remoteLanguage) {
    return null;
  }

  const languageList = Object.entries(languages).map(([code, values]) => ({
    code,
    country: values.country,
    name: values.name,
  }));

  return (
    <>
      <Tooltip title={t('loginLanguage')}>
        <IconButton onClick={(event) => setAnchorEl(event.currentTarget)}>
          <TranslateRoundedIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { maxHeight: 420, minWidth: 220 } } }}
      >
        {languageList.map((it) => (
          <MenuItem
            key={it.code}
            selected={it.code === language}
            onClick={() => {
              setLocalLanguage(it.code);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon>
              <CountryFlag countryCode={it.country} svg />
            </ListItemIcon>
            <ListItemText>{it.name}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default LanguageMenu;
