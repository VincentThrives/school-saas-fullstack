import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  CircularProgress,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  Grid,
  Paper,
  Alert,
} from '@mui/material';
import {
  Timer as TimerIcon,
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  Send as SubmitIcon,
  CheckCircle as CorrectIcon,
  Cancel as WrongIcon,
} from '@mui/icons-material';
import { useStartMcqExamMutation, useSubmitAnswerMutation, useSubmitMcqExamMutation, useGetMcqAttemptResultQuery } from '../../../store/api/mcqApi';
import { useSnackbar } from 'notistack';

interface Question {
  questionId: string;
  questionText: string;
  options: string[];
}

interface Answer {
  questionId: string;
  selectedOptionIndex: number;
}

export const TakeMcqExamPage = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [started, setStarted] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [startExam, { isLoading: starting }] = useStartMcqExamMutation();
  const [submitAnswer] = useSubmitAnswerMutation();
  const [submitExam, { isLoading: submitting }] = useSubmitMcqExamMutation();

  const { data: resultData } = useGetMcqAttemptResultQuery(attemptId!, {
    skip: !attemptId || !submitted,
  });

  // Timer effect
  useEffect(() => {
    if (!started || submitted || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [started, submitted, timeRemaining]);

  const handleStartExam = async () => {
    try {
      const result = await startExam(examId!).unwrap();
      setAttemptId(result.data.attempt.attemptId);
      setQuestions(result.data.questions);
      setTimeRemaining(30 * 60); // 30 minutes in seconds (would be from exam data)
      setStarted(true);
    } catch {
      enqueueSnackbar('Failed to start exam', { variant: 'error' });
    }
  };

  const handleSelectAnswer = async (optionIndex: number) => {
    const question = questions[currentIndex];
    setAnswers((prev) => new Map(prev).set(question.questionId, optionIndex));

    if (attemptId) {
      try {
        await submitAnswer({
          attemptId,
          questionId: question.questionId,
          selectedOptionIndex: optionIndex,
        }).unwrap();
      } catch {
        // Silent fail for answer submission
      }
    }
  };

  const handleSubmitExam = useCallback(async () => {
    if (!attemptId) return;

    try {
      await submitExam(attemptId).unwrap();
      setSubmitted(true);
      setSubmitDialogOpen(false);
      enqueueSnackbar('Exam submitted successfully', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to submit exam', { variant: 'error' });
    }
  }, [attemptId, submitExam, enqueueSnackbar]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers.get(currentQuestion.questionId) : undefined;
  const answeredCount = answers.size;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  const result = resultData?.data;

  // Show results if submitted
  if (submitted && result) {
    const percentage = Math.round((result.attempt.correctAnswers / result.attempt.totalQuestions) * 100);
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h4" gutterBottom>
              Exam Completed!
            </Typography>

            <Box sx={{ my: 4 }}>
              <Typography variant="h1" color={percentage >= 60 ? 'success.main' : 'error.main'}>
                {result.attempt.score}
              </Typography>
              <Typography variant="h6" color="text.secondary">
                out of {result.attempt.totalQuestions}
              </Typography>
            </Box>

            <Grid container spacing={2} justifyContent="center" sx={{ mb: 4 }}>
              <Grid size={{ xs: 4 }}>
                <Paper sx={{ p: 2, bgcolor: 'success.light' }}>
                  <Typography variant="h4">{result.attempt.correctAnswers}</Typography>
                  <Typography variant="body2">Correct</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Paper sx={{ p: 2, bgcolor: 'error.light' }}>
                  <Typography variant="h4">
                    {result.attempt.totalQuestions - result.attempt.correctAnswers}
                  </Typography>
                  <Typography variant="body2">Wrong</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Paper sx={{ p: 2, bgcolor: 'primary.light' }}>
                  <Typography variant="h4">{percentage}%</Typography>
                  <Typography variant="body2">Score</Typography>
                </Paper>
              </Grid>
            </Grid>

            <Chip
              label={percentage >= 60 ? 'PASSED' : 'FAILED'}
              color={percentage >= 60 ? 'success' : 'error'}
              sx={{ fontSize: '1.2rem', py: 2, px: 4 }}
            />

            <Box sx={{ mt: 4 }}>
              <Button variant="contained" onClick={() => navigate('/mcq/available')}>
                Back to Exams
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Show detailed results */}
        {result.details && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Review Answers
              </Typography>
              {result.details.map((detail, index) => (
                <Box key={detail.questionId} sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    {detail.isCorrect ? (
                      <CorrectIcon color="success" />
                    ) : (
                      <WrongIcon color="error" />
                    )}
                    <Typography variant="subtitle1">
                      Q{index + 1}. {detail.questionText}
                    </Typography>
                  </Box>
                  <Box sx={{ pl: 4 }}>
                    {detail.options.map((option, optIndex) => (
                      <Typography
                        key={optIndex}
                        variant="body2"
                        sx={{
                          color:
                            optIndex === detail.correctOptionIndex
                              ? 'success.main'
                              : optIndex === detail.selectedOptionIndex
                              ? 'error.main'
                              : 'text.secondary',
                          fontWeight:
                            optIndex === detail.correctOptionIndex || optIndex === detail.selectedOptionIndex
                              ? 600
                              : 400,
                        }}
                      >
                        {String.fromCharCode(65 + optIndex)}. {option}
                        {optIndex === detail.correctOptionIndex && ' ✓'}
                        {optIndex === detail.selectedOptionIndex && optIndex !== detail.correctOptionIndex && ' (Your answer)'}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        )}
      </Box>
    );
  }

  // Show start screen
  if (!started) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h5" gutterBottom>
              MCQ Examination
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Read the instructions carefully before starting the exam.
            </Typography>

            <Alert severity="info" sx={{ textAlign: 'left', mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Instructions:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>You cannot pause the exam once started</li>
                <li>Each question has only one correct answer</li>
                <li>You can navigate between questions</li>
                <li>Make sure you have a stable internet connection</li>
              </ul>
            </Alert>

            <Button
              variant="contained"
              size="large"
              onClick={handleStartExam}
              disabled={starting}
            >
              {starting ? <CircularProgress size={24} /> : 'Start Exam'}
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Show exam
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 2 }}>
      {/* Header */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                icon={<TimerIcon />}
                label={formatTime(timeRemaining)}
                color={timeRemaining < 300 ? 'error' : 'primary'}
              />
              <Typography variant="body2" color="text.secondary">
                Question {currentIndex + 1} of {questions.length}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Answered: {answeredCount}/{questions.length}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} sx={{ mt: 1 }} />
        </CardContent>
      </Card>

      {/* Question */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {currentIndex + 1}. {currentQuestion?.questionText}
          </Typography>

          <RadioGroup
            value={currentAnswer?.toString() ?? ''}
            onChange={(e) => handleSelectAnswer(parseInt(e.target.value, 10))}
          >
            {currentQuestion?.options.map((option, index) => (
              <FormControlLabel
                key={index}
                value={index.toString()}
                control={<Radio />}
                label={`${String.fromCharCode(65 + index)}. ${option}`}
                sx={{
                  mb: 1,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: currentAnswer === index ? 'primary.light' : 'transparent',
                  '&:hover': { bgcolor: 'grey.100' },
                }}
              />
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          startIcon={<PrevIcon />}
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((prev) => prev - 1)}
        >
          Previous
        </Button>

        <Button
          variant="contained"
          color="error"
          startIcon={<SubmitIcon />}
          onClick={() => setSubmitDialogOpen(true)}
        >
          Submit Exam
        </Button>

        <Button
          endIcon={<NextIcon />}
          disabled={currentIndex === questions.length - 1}
          onClick={() => setCurrentIndex((prev) => prev + 1)}
        >
          Next
        </Button>
      </Box>

      {/* Question Navigator */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Question Navigator
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {questions.map((q, index) => (
              <Chip
                key={q.questionId}
                label={index + 1}
                size="small"
                color={answers.has(q.questionId) ? 'success' : 'default'}
                variant={currentIndex === index ? 'filled' : 'outlined'}
                onClick={() => setCurrentIndex(index)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Submit Confirmation Dialog */}
      <Dialog open={submitDialogOpen} onClose={() => setSubmitDialogOpen(false)}>
        <DialogTitle>Submit Exam?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You have answered {answeredCount} out of {questions.length} questions.
            {answeredCount < questions.length && ' Are you sure you want to submit?'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitDialogOpen(false)}>Continue Exam</Button>
          <Button onClick={handleSubmitExam} color="error" variant="contained" disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TakeMcqExamPage;
