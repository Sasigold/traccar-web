import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import BrandLoader from '../common/components/brand/BrandLoader';
import { useAsyncTask, useCatch } from '../reactHelper';
import { getFleetClient, unwrap } from '../common/fleet/client';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    maxWidth: 720,
    width: '100%',
    marginInline: 'auto',
  },
  card: {
    padding: theme.spacing(2, 2.5),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  points: {
    margin: 0,
    paddingInlineStart: theme.spacing(2.5),
    '& li': { marginBottom: theme.spacing(0.5) },
  },
  explanation: {
    color: theme.palette.text.secondary,
  },
}));

// AI-10: a course in the driver portal: read the sections, answer the quiz, see the result and
// the right answers. The score is worked out on the server; a pass goes into the driver file.
const DriverCoursePage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const { id } = useParams();
  const [course, setCourse] = useState(undefined);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  useAsyncTask(async () => {
    const rows = unwrap(await getFleetClient().rpc('my_courses')) || [];
    setCourse(rows.find((row) => row.id === id) || null);
  }, [id]);

  const submit = useCatch(async () => {
    const list = course.quiz.map((_, index) => Number(answers[index]));
    setResult(
      unwrap(await getFleetClient().rpc('submit_course', { p_course: id, p_answers: list })),
    );
    window.scrollTo({ top: 0 });
  });

  const complete = course && course.quiz.every((_, index) => answers[index] != null);

  return (
    <PageLayout breadcrumbs={['fleetDriverPortal']} title={course?.title || t('driverCourses')}>
      <div className={classes.root}>
        {course === undefined && <BrandLoader label={t('sharedLoading')} />}
        {course === null && <Alert severity="info">{t('courseMissing')}</Alert>}
        {result && (
          <Alert severity={result.passed ? 'success' : 'warning'} role="status">
            {t(result.passed ? 'courseResultPassed' : 'courseResultFailed')
              .replace('{0}', String(result.score))
              .replace('{1}', String(course.pass_score))}
          </Alert>
        )}
        {course && (
          <>
            {course.summary && <Typography>{course.summary}</Typography>}
            {course.sections.map((section) => (
              <Paper key={section.heading} elevation={0} className={classes.card}>
                <Typography variant="subtitle1" component="h2" fontWeight={700}>
                  {section.heading}
                </Typography>
                <ul className={classes.points}>
                  {section.points.map((point) => (
                    <li key={point}>
                      <Typography variant="body2">{point}</Typography>
                    </li>
                  ))}
                </ul>
              </Paper>
            ))}
            <Typography variant="h6" component="h2">
              {t('courseQuiz')}
            </Typography>
            {course.quiz.map((item, index) => (
              <Paper key={item.question} elevation={0} className={classes.card}>
                <FormControl disabled={Boolean(result)}>
                  <FormLabel id={`q-${index}`}>{`${index + 1}. ${item.question}`}</FormLabel>
                  <RadioGroup
                    aria-labelledby={`q-${index}`}
                    value={answers[index] ?? ''}
                    onChange={(event) => setAnswers({ ...answers, [index]: event.target.value })}
                  >
                    {item.options.map((option, optionIndex) => (
                      <FormControlLabel
                        key={option}
                        value={String(optionIndex)}
                        control={<Radio />}
                        label={option}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
                {result && (
                  <Typography variant="body2" className={classes.explanation}>
                    {`${t('courseRightAnswer')}: ${item.options[result.answers[index].answer]}. ${result.answers[index].explanation}`}
                  </Typography>
                )}
              </Paper>
            ))}
            {result && !result.passed && (
              <Button
                variant="contained"
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                  window.scrollTo({ top: 0 });
                }}
              >
                {t('courseRetry')}
              </Button>
            )}
            {result ? (
              <Button
                variant={result.passed ? 'contained' : 'outlined'}
                component={RouterLink}
                to="/driver"
              >
                {t('courseBack')}
              </Button>
            ) : (
              <Button variant="contained" onClick={submit} disabled={!complete}>
                {t('courseSubmit')}
              </Button>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default DriverCoursePage;
