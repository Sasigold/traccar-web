import { List, ListSubheader } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../../common/components/LocalizationProvider';
import MenuItem from '../../common/components/MenuItem';
import { adminSections } from './adminSections';

const AdminMenu = () => {
  const t = useTranslation();
  const location = useLocation();

  return adminSections.map((section) => (
    <List
      key={section.id}
      component="nav"
      aria-label={t(section.titleKey)}
      dense
      subheader={
        <ListSubheader component="div" disableSticky>
          {t(section.titleKey)}
        </ListSubheader>
      }
    >
      {section.items.map((item) => {
        const Icon = item.icon;
        return (
          <MenuItem
            key={item.id}
            title={t(item.titleKey)}
            link={item.path}
            icon={<Icon />}
            selected={item.match(location.pathname)}
          />
        );
      })}
    </List>
  ));
};

export default AdminMenu;
