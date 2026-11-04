import { makeStyles } from 'tss-react/mui';

export default makeStyles()((theme) => ({
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  containerMap: {
    flexBasis: 'var(--report-map-height, 40%)',
    flexShrink: 0,
    margin: theme.spacing(0.5, 3, 0),
    borderRadius: theme.tokens.radius.xl,
    overflow: 'hidden',
    border: `1px solid ${theme.palette.surface.border}`,
    position: 'relative',
    [theme.breakpoints.down('md')]: {
      margin: 0,
      borderRadius: 0,
      borderInline: 'none',
    },
    '@media print': {
      display: 'none',
    },
  },
  containerMain: {
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  header: {
    position: 'sticky',
    top: 0,
    left: 0,
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: theme.palette.background.default,
    '@media print': {
      display: 'none',
    },
  },
  columnAction: {
    width: '1%',
    paddingInlineStart: theme.spacing(1),
    '@media print': {
      display: 'none',
    },
  },
  columnActionContainer: {
    display: 'flex',
  },
  filter: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
    margin: theme.spacing(0.5, 3, 1.5),
    padding: theme.spacing(2),
    borderRadius: theme.tokens.radius.xl,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[1],
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(1.5, 2),
    },
    '@media print': {
      display: 'none !important',
    },
  },
  filterItem: {
    minWidth: 0,
    flex: `1 1 ${theme.dimensions.filterFormWidth}`,
  },
  filterButtons: {
    display: 'flex',
    gap: theme.spacing(1),
    flex: `1 1 ${theme.dimensions.filterFormWidth}`,
  },
  filterButton: {
    flexGrow: 1,
  },
  chart: {
    flexGrow: 1,
    overflow: 'hidden',
    margin: theme.spacing(0, 3, 3),
    padding: theme.spacing(2, 1, 1),
    borderRadius: theme.tokens.radius.xl,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.background.paper,
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(0, 1, 2),
    },
  },
  actionCellPadding: {
    '&.MuiTableCell-body': {
      paddingTop: 0,
      paddingBottom: 0,
    },
    '@media print': {
      display: 'none',
    },
  },
}));
