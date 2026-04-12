import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Grid,
  Typography,
  Button,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Timer as TimerIcon,
  QuestionAnswer as QuestionsIcon,
  PlayArrow as StartIcon,
} from '@mui/icons-material';
import { PageHeader } from '../../../components/common';
import { useAppDispatch } from '../../../store';
import { setPageTitle } from '../../../store/slices/uiSlice';
import { useGetAvailableMcqExamsQuery } from '../../../store/api/mcqApi';
import dayjs from 'dayjs';

export const AvailableMcqExamsPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { data, isLoading } = useGetAvailableMcqExamsQuery();

  useEffect(() => {
    dispatch(setPageTitle('Available MCQ Exams'));
  }, [dispatch]);

  const exams = data?.data || [];

  return (
    <Box>
      <PageHeader
        title="Available MCQ Exams"
        subtitle="Take online MCQ examinations"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'MCQ Exams' },
        ]}
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : exams.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary">
              No exams available at the moment
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Check back later for new examinations
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {exams.map((exam) => (
            <Grid key={exam.examId} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {exam.title}
                  </Typography>

                  <Chip
                    label={exam.subjectName}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <QuestionsIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {exam.questionIds?.length || 0} Questions
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TimerIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {exam.duration} minutes
                      </Typography>
                    </Box>

                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      Available until: {dayjs(exam.endTime).format('DD MMM YYYY, HH:mm')}
                    </Typography>
                  </Box>
                </CardContent>

                <CardActions>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<StartIcon />}
                    onClick={() => navigate(`/mcq/take/${exam.examId}`)}
                  >
                    Start Exam
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default AvailableMcqExamsPage;
