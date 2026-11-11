import { Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useDispatch } from 'react-redux';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { WEBHOOK_TEMPLATES } from '../../common/fleet/webhookTemplates';
import { messagesActions } from '../../store';
import { useCatch } from '../../reactHelper';

const useStyles = makeStyles()((theme) => ({
  root: {
    margin: theme.spacing(2, 3),
  },
  grid: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    marginTop: theme.spacing(1.5),
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.surface.tint,
  },
  content: {
    flex: 1,
  },
  target: {
    color: theme.palette.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  },
  // Codes in Sora with even digits, not a monospace font outside the brand.
  code: {
    fontFamily: theme.typography.fontFamily,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
  },
  filter: {
    marginTop: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
}));

// INT-04: recipes for Make and Zapier: pick one, paste the URL the tool gives, and copy the
// sample body so the tool learns the fields before the first real event.
const WebhookTemplates = ({ onUse }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const dispatch = useDispatch();

  const copy = useCatch(async (template) => {
    await navigator.clipboard.writeText(JSON.stringify(template.sample, null, 2));
    dispatch(messagesActions.push({ message: t('webhookTemplatesCopied'), severity: 'success' }));
  });

  return (
    <section className={classes.root} aria-labelledby="webhook-templates-title">
      <Typography id="webhook-templates-title" variant="h6" component="h2">
        {t('webhookTemplatesTitle')}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        {t('webhookTemplatesDescription')}
      </Typography>
      <div className={classes.grid}>
        {WEBHOOK_TEMPLATES.map((template) => (
          <Card key={template.id} variant="outlined" className={classes.card}>
            <CardContent className={classes.content}>
              <Typography variant="caption" className={classes.target} dir="ltr" component="div">
                Make · Zapier → {template.target}
              </Typography>
              <Typography variant="subtitle1" component="h3" fontWeight={600}>
                {t(`webhookTemplate_${template.id}`)}
              </Typography>
              <Typography variant="body2">
                {t(`webhookTemplate_${template.id}Description`)}
              </Typography>
              {template.filter && (
                <Typography variant="body2" className={classes.filter}>
                  {t('webhookTemplatesFilter')}{' '}
                  <span dir="ltr" className={classes.code}>
                    {template.filter.field} = {template.filter.value}
                  </span>
                </Typography>
              )}
            </CardContent>
            <CardActions>
              <Button size="small" variant="outlined" onClick={() => onUse(template)}>
                {t('webhookTemplatesUse')}
              </Button>
              <Button size="small" onClick={() => copy(template)}>
                {t('webhookTemplatesCopySample')}
              </Button>
            </CardActions>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default WebhookTemplates;
