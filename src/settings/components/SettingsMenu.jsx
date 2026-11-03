import { List, ListSubheader } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../../common/components/LocalizationProvider';
import MenuItem from '../../common/components/MenuItem';
import { useSettingsSections } from './settingsSections';

const SettingsMenu = () => {
  const t = useTranslation();
  const location = useLocation();
  const sections = useSettingsSections();

  return sections.map((section) => (
    <List
      key={section.id}
      dense
      subheader={<ListSubheader disableSticky>{t(section.titleKey)}</ListSubheader>}
    >
      {section.items.map((item) => {
        const Icon = item.icon;
        return (
          <MenuItem
            key={item.id}
            title={t(item.titleKey)}
            link={item.href || item.path}
            icon={<Icon />}
            selected={item.match ? item.match(location.pathname) : false}
            external={Boolean(item.href)}
          />
        );
      })}
    </List>
  ));
};

export default SettingsMenu;
