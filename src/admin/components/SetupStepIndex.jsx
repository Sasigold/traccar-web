import { Chip, GlobalStyles } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
    margin: 0,
    listStyle: 'none',
    backgroundColor: theme.palette.background.default,
    '@media print': {
      display: 'none',
    },
  },
}));

// ADM-26: the wizard's steps in a row that stays on top: ✓ for a step filled in, ! for one
// missing what it needs; a step scrolls to its section. steps: [{ id, label, state }], state
// 'done' | 'missing' | undefined.
const SetupStepIndex = ({ steps }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  return (
    <nav aria-label={t('adminSetupSteps')}>
      {/* A section scrolled to stays clear of this row. */}
      <GlobalStyles styles={{ '[id^="setup-"]': { scrollMarginTop: 56 } }} />
      <ol className={classes.root}>
        {steps.map((step, index) => (
          <li key={step.id}>
            <Chip
              size="small"
              clickable
              component="a"
              href={`#${step.id}`}
              onClick={(event) => {
                event.preventDefault();
                document
                  .getElementById(step.id)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              color={
                step.state === 'missing' ? 'warning' : step.state === 'done' ? 'success' : 'default'
              }
              variant={step.state ? 'filled' : 'outlined'}
              icon={
                step.state === 'done' ? (
                  <CheckRoundedIcon />
                ) : step.state === 'missing' ? (
                  <PriorityHighRoundedIcon />
                ) : undefined
              }
              label={`${index + 1}. ${step.label}`}
              aria-label={`${index + 1}. ${step.label}${
                step.state
                  ? ` · ${t(step.state === 'done' ? 'adminStepDone' : 'adminStepMissing')}`
                  : ''
              }`}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default SetupStepIndex;
