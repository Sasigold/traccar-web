import { Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import PageLayout from '../../common/components/PageLayout';

const useStyles = makeStyles()((theme, { maxWidth }) => ({
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  form: {
    width: '100%',
    maxWidth,
    marginInline: 'auto',
    padding: theme.spacing(1, 3, 3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(2, 2, 3),
    },
  },
  intro: {
    color: theme.palette.text.secondary,
  },
}));

// Page layout for forms: section cards in a centered column, with an optional
// sticky footer (SaveBar). The description explains the form in plain words. The scroll container is PageLayout's content area,
// so nothing here may set overflow.
const FormPage = ({
  menu,
  breadcrumbs,
  title,
  description,
  actions,
  backTo,
  footer,
  maxWidth,
  children,
}) => {
  const { classes } = useStyles({ maxWidth: maxWidth ?? 760 });
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  return (
    <PageLayout
      menu={menu}
      breadcrumbs={breadcrumbs}
      title={title}
      description={description}
      actions={actions}
      backTo={backTo}
    >
      <div className={classes.body}>
        <div className={classes.form}>
          {/* The page header hides the description on phones; forms keep it as an intro. */}
          {!desktop && description && (
            <Typography variant="body2" className={classes.intro}>
              {description}
            </Typography>
          )}
          {children}
        </div>
        {footer}
      </div>
    </PageLayout>
  );
};

export default FormPage;
