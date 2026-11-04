import { useState } from 'react';
import { Drawer, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { useSearchParams } from 'react-router-dom';
import PageHeader from './shell/PageHeader';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    minHeight: 0,
    display: 'flex',
    [theme.breakpoints.down('md')]: {
      flexDirection: 'column',
    },
    '@media print': {
      height: 'auto',
      display: 'block',
    },
  },
  sectionNav: {
    width: theme.dimensions.sectionNavWidth,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.paper,
    borderInlineEnd: `1px solid ${theme.palette.surface.border}`,
    overflowY: 'auto',
    paddingBlock: theme.spacing(1),
    '@media print': {
      display: 'none',
    },
  },
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    '@media print': {
      overflow: 'visible',
    },
  },
  mobileDrawer: {
    width: 300,
    maxWidth: '85vw',
    paddingTop: `calc(${theme.spacing(1)} + env(safe-area-inset-top, 0px))`,
    paddingBottom: `calc(${theme.spacing(1)} + env(safe-area-inset-bottom, 0px))`,
  },
}));

// Standard non-map page: an optional section navigation column, a page
// header and a scrolling content area. On phones the section navigation
// opens as a drawer from the header (or with ?menu=true).
const PageLayout = ({ menu, breadcrumbs, title, description, actions, backTo, children }) => {
  const { classes } = useStyles();
  const theme = useTheme();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const [searchParams] = useSearchParams();
  const [openDrawer, setOpenDrawer] = useState(() => !desktop && searchParams.has('menu'));

  return (
    <div className={classes.root}>
      {desktop && menu && <aside className={`${classes.sectionNav} app-section-nav`}>{menu}</aside>}
      {!desktop && menu && (
        <Drawer
          anchor="left"
          open={openDrawer}
          onClose={() => setOpenDrawer(false)}
          slotProps={{ paper: { className: classes.mobileDrawer } }}
        >
          {menu}
        </Drawer>
      )}
      <div className={classes.main}>
        <PageHeader
          breadcrumbs={breadcrumbs}
          title={title}
          description={description}
          actions={actions}
          backTo={backTo}
          onOpenMenu={!desktop && menu ? () => setOpenDrawer(true) : undefined}
        />
        <div className={classes.content}>{children}</div>
      </div>
    </div>
  );
};

export default PageLayout;
