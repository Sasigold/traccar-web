import { useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import { Container, Link, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { useLocalization } from '../common/components/LocalizationProvider';
import BrandLogo from '../common/components/brand/BrandLogo';
import { STATEMENT_UPDATED, accessibilityStatement } from '../common/accessibility/statement';
import { formatLongDate } from '../common/util/formatter';

const useStyles = makeStyles()((theme) => ({
  root: {
    minHeight: '100%',
    backgroundColor: theme.palette.background.default,
    paddingBlock: theme.spacing(4),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  section: {
    marginBlock: theme.spacing(3),
  },
  list: {
    paddingInlineStart: theme.spacing(3),
    '& li': { marginBlock: theme.spacing(0.75) },
  },
}));

// A11-07: the accessibility statement, open without signing in (linked from the login screen
// and from Settings › Help). Text in src/common/accessibility/statement.js; the coordinator's
// details come from the server settings: accessibilityContact, accessibilityPhone,
// accessibilityEmail.
const AccessibilityPage = () => {
  const { classes } = useStyles();
  const { language } = useLocalization();
  const theme = useTheme();
  const attributes = useSelector((state) => state.session.server?.attributes || {});
  const statement = accessibilityStatement(language);
  const contact = {
    name: attributes.accessibilityContact,
    phone: attributes.accessibilityPhone,
    email: attributes.accessibilityEmail,
  };
  const hasContact = Boolean(contact.name || contact.phone || contact.email);

  return (
    <main className={classes.root}>
      <Container maxWidth="md">
        <div className={classes.header}>
          <BrandLogo height={28} variant={theme.palette.mode === 'dark' ? 'reverse' : 'primary'} />
          <Link component={RouterLink} to="/">
            viper fleet
          </Link>
        </div>
        <Typography variant="h3" component="h1">
          {statement.title}
        </Typography>
        {statement.sections.map((section) => (
          <section key={section.title} className={classes.section}>
            <Typography variant="h5" component="h2" gutterBottom>
              {section.title}
            </Typography>
            {(section.paragraphs || []).map((text) => (
              <Typography key={text} paragraph>
                {text}
              </Typography>
            ))}
            {section.items && (
              <ul className={classes.list}>
                {section.items.map((text) => (
                  <li key={text}>
                    <Typography component="span">{text}</Typography>
                  </li>
                ))}
              </ul>
            )}
            {section.contact &&
              (hasContact ? (
                <Typography component="div">
                  {contact.name && (
                    <div>
                      {statement.coordinator}: {contact.name}
                    </div>
                  )}
                  {contact.phone && (
                    <div>
                      {statement.phone}:{' '}
                      <Link href={`tel:${contact.phone}`} dir="ltr">
                        {contact.phone}
                      </Link>
                    </div>
                  )}
                  {contact.email && (
                    <div>
                      {statement.email}:{' '}
                      <Link href={`mailto:${contact.email}`} dir="ltr">
                        {contact.email}
                      </Link>
                    </div>
                  )}
                </Typography>
              ) : (
                <Typography color="textSecondary">{statement.notSet}</Typography>
              ))}
          </section>
        ))}
        <Typography variant="body2" color="textSecondary">
          {statement.updated}: {formatLongDate(STATEMENT_UPDATED)}
        </Typography>
      </Container>
    </main>
  );
};

export default AccessibilityPage;
