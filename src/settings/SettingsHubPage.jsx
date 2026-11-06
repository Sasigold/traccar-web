import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { InputAdornment, TextField, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import PageLayout from '../common/components/PageLayout';
import EmptyState from '../common/components/table/EmptyState';
import { useTranslation } from '../common/components/LocalizationProvider';
import SettingsMenu from './components/SettingsMenu';
import { SettingsList, SettingsProfileCard } from './components/SettingsList';
import { userInitial } from '../common/components/shell/UserMenu';
import { useSettingsSections } from './components/settingsSections';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(1, 3, 4),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3.5),
    maxWidth: 760,
    width: '100%',
    marginInline: 'auto',
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(2, 2, 4),
      gap: theme.spacing(3),
    },
  },
  search: {
    '& .MuiOutlinedInput-root': {
      height: 48,
      borderRadius: theme.tokens.radius.lg,
      fontSize: '1rem',
    },
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  groupTitle: {
    color: theme.palette.text.secondary,
    fontWeight: 600,
    paddingInline: theme.spacing(0.75),
  },
}));

const SettingsHubPage = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const sections = useSettingsSections();
  const user = useSelector((state) => state.session.user);
  const profile = sections
    .flatMap((section) => section.items)
    .find((item) => item.id === 'profile');

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return sections;
    }
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          [t(item.titleKey), t(item.descriptionKey), t(section.titleKey)]
            .filter(Boolean)
            .some((text) => text.toLowerCase().includes(needle)),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, query, t]);

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['settingsTitle']}
      description={t('settingsHubDescription')}
    >
      <div className={classes.root}>
        <TextField
          className={classes.search}
          placeholder={t('settingsSearchPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus={desktop}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon />
                </InputAdornment>
              ),
            },
          }}
        />
        {profile && !query.trim() && (
          <SettingsProfileCard
            to={profile.path}
            initial={userInitial(user)}
            name={user.name || user.email}
            detail={user.name ? user.email : t(profile.titleKey)}
          />
        )}
        {filtered.map((section) => (
          <section key={section.id} className={classes.group}>
            <Typography variant="body2" component="h2" className={classes.groupTitle}>
              {t(section.titleKey)}
            </Typography>
            <SettingsList
              items={section.items.map((item) => ({
                id: item.id,
                icon: item.icon,
                title: t(item.titleKey),
                description: t(item.descriptionKey),
                to: item.path,
                href: item.href,
              }))}
            />
          </section>
        ))}
        {filtered.length === 0 && (
          <EmptyState icon={<SearchOffRoundedIcon />} title={t('shellNoResults')} />
        )}
      </div>
    </PageLayout>
  );
};

export default SettingsHubPage;
