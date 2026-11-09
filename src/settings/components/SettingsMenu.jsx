import { useState } from 'react';
import { Collapse, List, ListItemButton, ListItemText, ListSubheader } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../../common/components/LocalizationProvider';
import MenuItem from '../../common/components/MenuItem';
import { isFleetPath } from '../../common/components/shell/navItems';
import { useFleetSections, useSettingsSections } from './settingsSections';

const matches = (sections, pathname) =>
  sections.some((section) => section.items.some((item) => item.match?.(pathname)));

// The side menu of the settings and fleet areas (ADM-02): a fleet page shows the fleet menu, so
// the rail, the breadcrumbs and the menu agree. Fleet pages that are configuration (users,
// integrations, privacy) keep the settings menu, where they are listed.
export const useMenuSections = () => {
  const location = useLocation();
  const settings = useSettingsSections();
  const fleet = useFleetSections();
  if (matches(settings, location.pathname)) {
    return settings;
  }
  return isFleetPath(location.pathname) ? fleet : settings;
};

const MenuSection = ({ section }) => {
  const t = useTranslation();
  const location = useLocation();
  const selected = section.items.some((item) => item.match?.(location.pathname));
  // "Advanced" stays folded unless one of its pages is open.
  const [open, setOpen] = useState(!section.collapsible || selected);

  const items = section.items.map((item) => {
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
  });

  if (section.collapsible) {
    return (
      <List component="nav" aria-label={t(section.titleKey)} dense>
        <ListItemButton onClick={() => setOpen(!open)} aria-expanded={open} dense>
          <ListItemText
            primary={t(section.titleKey)}
            slotProps={{ primary: { variant: 'body2', color: 'textSecondary' } }}
          />
          {open ? (
            <ExpandLessRoundedIcon fontSize="small" />
          ) : (
            <ExpandMoreRoundedIcon fontSize="small" />
          )}
        </ListItemButton>
        <Collapse in={open} unmountOnExit>
          {items}
        </Collapse>
      </List>
    );
  }

  return (
    <List
      component="nav"
      aria-label={t(section.titleKey)}
      dense
      subheader={
        <ListSubheader component="div" disableSticky>
          {t(section.titleKey)}
        </ListSubheader>
      }
    >
      {items}
    </List>
  );
};

const SettingsMenu = () => {
  const sections = useMenuSections();
  return sections.map((section) => <MenuSection key={section.id} section={section} />);
};

export default SettingsMenu;
