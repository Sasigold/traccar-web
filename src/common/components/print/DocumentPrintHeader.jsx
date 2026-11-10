import { makeStyles } from 'tss-react/mui';
import BrandLogo from '../brand/BrandLogo';

const useStyles = makeStyles()((theme) => ({
  // Printed pages only (BRD-08, BRAND §8): the "SYNC POINT / …" label, the title, a few facts and
  // the ink logo, over an ink rule. Every printed document uses this, so reports, work orders and
  // the driver file look like one family. The page numbers ("01 / 04") come from @page in
  // public/styles.css.
  root: {
    display: 'none',
    '@media print': {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: theme.spacing(3),
      paddingBottom: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
      borderBottom: `2px solid ${theme.palette.brand.ink}`,
      color: theme.palette.brand.ink,
    },
  },
  eyebrow: {
    margin: 0,
    fontFamily: theme.typography.fontFamily,
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.18em',
    color: theme.palette.brand.slate,
  },
  title: {
    margin: theme.spacing(0.5, 0, 0),
    fontSize: '1.4rem',
    fontWeight: 700,
  },
  meta: {
    margin: theme.spacing(0.5, 0, 0),
    fontSize: '0.8rem',
    lineHeight: 1.6,
  },
}));

// kind: the English label after "SYNC POINT /" (REPORT, WORK ORDER, DRIVER FILE...).
// portrait: a document page (A4 portrait); reports print landscape.
const DocumentPrintHeader = ({ kind, title, lines = [], portrait = false }) => {
  const { classes } = useStyles();
  const shown = lines.filter(Boolean);
  return (
    <header
      className={`${classes.root} vf-print-header`}
      data-page={portrait ? 'document' : undefined}
      aria-hidden="true"
    >
      <div>
        <p className={classes.eyebrow} dir="ltr">{`SYNC POINT / ${kind}`}</p>
        <h1 className={classes.title}>{title}</h1>
        {shown.length > 0 && (
          <p className={classes.meta}>
            {shown.map((line, index) => (
              <span key={index}>
                {index > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        )}
      </div>
      <BrandLogo variant="ink" height={40} />
    </header>
  );
};

export default DocumentPrintHeader;
