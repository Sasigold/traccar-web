import { useReducer, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import BrandLoader from '../common/components/brand/BrandLoader';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useCatch } from '../reactHelper';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../common/fleet/useFleet';
import { aiErrorKey, aiRequest } from '../common/fleet/ai';
import { formatTime } from '../common/util/formatter';
import FleetNotice from './components/FleetNotice';
import { useFleetRows } from './fleetRows';

const useStyles = makeStyles()((theme) => ({
  form: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)',
    paddingTop: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  wide: {
    gridColumn: '1 / -1',
  },
  section: {
    marginTop: theme.spacing(2),
  },
  right: {
    fontWeight: 600,
    color: theme.palette.success.main,
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
  },
}));

const MAX_PDF = 5 * 1024 * 1024;

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

// The course before it is published: its title, pass score and validity can change, and a
// question that is wrong can be taken out. Nothing reaches drivers until "Publish".
const CourseDialog = ({ course, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const [form, setForm] = useState(() => ({
    title: course.title || '',
    summary: course.summary || '',
    pass_score: course.pass_score ?? 80,
    valid_months: course.valid_months ?? 12,
    sections: course.sections || [],
    quiz: course.quiz || [],
  }));

  const save = useCatch(async (status) => {
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim() || null,
      pass_score: Number(form.pass_score) || 80,
      valid_months: form.valid_months === '' ? null : Number(form.valid_months),
      sections: form.sections,
      quiz: form.quiz,
      status,
    };
    const client = getFleetClient();
    if (course.id) {
      unwrap(await client.from('training_courses').update(payload).eq('id', course.id));
    } else {
      unwrap(await client.from('training_courses').insert({ ...payload, org_id: profile.org_id }));
    }
    onSaved();
  });

  const valid = form.title.trim().length >= 2 && form.quiz.length >= 3;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t(course.id ? 'courseEdit' : 'courseReview')}</DialogTitle>
      <DialogContent>
        {!course.id && <Alert severity="info">{t('courseReviewHint')}</Alert>}
        <div className={classes.form}>
          <TextField
            label={t('courseTitle')}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <TextField
            type="number"
            label={t('coursePassScore')}
            value={form.pass_score}
            onChange={(event) => setForm({ ...form, pass_score: event.target.value })}
            slotProps={{ htmlInput: { min: 1, max: 100 } }}
          />
          <TextField
            type="number"
            label={t('courseValidMonths')}
            value={form.valid_months}
            onChange={(event) => setForm({ ...form, valid_months: event.target.value })}
            slotProps={{ htmlInput: { min: 1, max: 60 } }}
          />
          <TextField
            className={classes.wide}
            multiline
            minRows={2}
            label={t('courseSummary')}
            value={form.summary}
            onChange={(event) => setForm({ ...form, summary: event.target.value })}
          />
        </div>
        {form.sections.map((section) => (
          <div key={section.heading} className={classes.section}>
            <Typography variant="subtitle2" component="h3">
              {section.heading}
            </Typography>
            <List dense disablePadding>
              {section.points.map((point) => (
                <ListItem
                  key={point}
                  disableGutters
                  sx={{ display: 'list-item', listStyle: 'disc inside' }}
                >
                  {point}
                </ListItem>
              ))}
            </List>
          </div>
        ))}
        <Typography variant="subtitle1" component="h3" className={classes.section} fontWeight={600}>
          {t('courseQuiz')} ({form.quiz.length})
        </Typography>
        <List dense>
          {form.quiz.map((item, index) => (
            <ListItem
              key={item.question}
              disableGutters
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label={`${t('sharedRemove')} ${index + 1}`}
                  onClick={() =>
                    setForm({ ...form, quiz: form.quiz.filter((_, i) => i !== index) })
                  }
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemText
                primary={`${index + 1}. ${item.question}`}
                secondary={item.options.map((option, i) => (
                  <span key={option} className={i === item.answer ? classes.right : undefined}>
                    {i > 0 && ' · '}
                    {option}
                  </span>
                ))}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="outlined" onClick={() => save('draft')} disabled={!valid}>
          {t('courseSaveDraft')}
        </Button>
        <Button variant="contained" onClick={() => save('published')} disabled={!valid}>
          {t('coursePublish')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// AI-10: short courses built from the company's own procedures. The PDF is read by the model,
// the safety officer reviews and publishes, drivers take it in their portal, and a pass goes into
// the driver file by itself.
const CoursesPage = () => {
  const t = useTranslation();
  const canRead = useFleetPermission('safety.read');
  const canWrite = useFleetPermission('safety.write');
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [editing, setEditing] = useState(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const courses = useFleetRows('training_courses', {
    order: 'created_at',
    ascending: false,
    enabled: canRead,
    reloadKey,
  });
  const completions = useFleetRows('course_completions', {
    select: 'course_id, driver_id, passed',
    enabled: canRead,
    reloadKey,
  });

  const build = async (file) => {
    setError(null);
    if (!file) return;
    if (file.type !== 'application/pdf' || file.size > MAX_PDF) {
      setError(t('courseFileHint'));
      return;
    }
    setBuilding(true);
    try {
      const course = await aiRequest('course', {
        media_type: 'application/pdf',
        data: await toBase64(file),
      });
      setEditing(course);
    } catch (failure) {
      setError(
        failure?.code === 'not_a_procedure' ? t('courseNotProcedure') : t(aiErrorKey(failure)),
      );
    } finally {
      setBuilding(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  // Archived, not deleted: the drivers' results and the file entries stay.
  const archive = useCatch(async (course) => {
    unwrap(
      await getFleetClient()
        .from('training_courses')
        .update({ status: 'archived' })
        .eq('id', course.id),
    );
    reload();
  });

  const stats = (id) => {
    const own = (completions || []).filter((row) => row.course_id === id);
    const passed = new Set(own.filter((row) => row.passed).map((row) => row.driver_id));
    return { drivers: new Set(own.map((row) => row.driver_id)).size, passed: passed.size };
  };

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'coursesPage']}
      description={t('coursesPageDescription')}
    >
      <FleetNotice permission="safety.read" />
      {error && (
        <Alert severity="warning" sx={{ mx: 3, mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {building && (
        <Alert severity="info" sx={{ mx: 3, mb: 2 }} icon={<BrandLoader size={20} />}>
          {t('courseBuilding')}
        </Alert>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        aria-label={t('courseFromProcedure')}
        onChange={(event) => build(event.target.files?.[0])}
      />
      <DataTable
        toolbar={
          <TableToolbar
            count={courses?.length || 0}
            actions={
              canWrite && (
                <Button
                  variant="contained"
                  size="small"
                  disabled={building}
                  onClick={() => inputRef.current?.click()}
                >
                  {t('courseFromProcedure')}
                </Button>
              )
            }
          />
        }
        empty={canRead && courses && courses.length === 0}
        emptyState={{ icon: <SchoolRoundedIcon />, title: t('coursesNone') }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('courseTitle')}</TableCell>
            <TableCell>{t('deviceStatus')}</TableCell>
            <TableCell>{t('courseQuiz')}</TableCell>
            <TableCell>{t('coursePassed')}</TableCell>
            <TableCell>{t('courseCreated')}</TableCell>
            {canWrite && <TableCell />}
          </TableRow>
        </TableHead>
        <TableBody>
          {canRead && !courses ? (
            <TableShimmer columns={canWrite ? 6 : 5} />
          ) : (
            (courses || []).map((course) => {
              const { drivers, passed } = stats(course.id);
              return (
                <TableRow key={course.id} hover>
                  <TableCell>{course.title}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={course.status === 'published' ? 'success' : 'default'}
                      label={t(`courseStatus_${course.status}`)}
                    />
                  </TableCell>
                  <TableCell>{(course.quiz || []).length}</TableCell>
                  <TableCell>{`${passed} / ${drivers}`}</TableCell>
                  <TableCell>{formatTime(course.created_at, 'date')}</TableCell>
                  {canWrite && (
                    <TableCell align="right">
                      <Button size="small" onClick={() => setEditing(course)}>
                        {t('sharedEdit')}
                      </Button>
                      {course.status !== 'archived' && (
                        <IconButton
                          size="small"
                          aria-label={`${t('courseArchive')} ${course.title}`}
                          onClick={() => archive(course)}
                        >
                          <ArchiveRoundedIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </DataTable>
      {editing && (
        <CourseDialog
          course={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </PageLayout>
  );
};

export default CoursesPage;
