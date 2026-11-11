import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, Chip, Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import { getFleetClient, unwrap } from '../../common/fleet/client';

const useStyles = makeStyles()((theme) => ({
  card: {
    padding: theme.spacing(2, 2.5),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
}));

// AI-10: the driver's courses: what is still to do first, each one link to take it.
const DriverCoursesCard = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [courses, setCourses] = useState(null);

  useAsyncTask(async () => {
    setCourses(unwrap(await getFleetClient().rpc('my_courses')) || []);
  }, []);

  if (!courses?.length) return null;
  const sorted = [...courses].sort((a, b) => Number(a.passed) - Number(b.passed));

  return (
    <Paper
      elevation={0}
      className={classes.card}
      component="section"
      aria-labelledby="driver-courses"
    >
      <div className={classes.head}>
        <SchoolRoundedIcon color="primary" />
        <Typography id="driver-courses" variant="subtitle1" component="h2" fontWeight={700}>
          {t('driverCourses')}
        </Typography>
      </div>
      {sorted.map((course) => (
        <div key={course.id} className={classes.row}>
          <Typography variant="body2">{course.title}</Typography>
          {course.passed ? (
            <Chip size="small" color="success" label={t('courseDone')} />
          ) : (
            <Button
              size="small"
              variant="outlined"
              component={RouterLink}
              to={`/driver/course/${course.id}`}
            >
              {t('courseStart')}
            </Button>
          )}
        </div>
      ))}
    </Paper>
  );
};

export default DriverCoursesCard;
