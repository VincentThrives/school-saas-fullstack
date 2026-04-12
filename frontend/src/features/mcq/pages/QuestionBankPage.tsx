import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { PageHeader } from '../../../components/common';
import { useAppDispatch } from '../../../store';
import { setPageTitle } from '../../../store/slices/uiSlice';
import {
  useGetQuestionsQuery,
  useCreateQuestionMutation,
  useUpdateQuestionMutation,
  useDeleteQuestionMutation,
} from '../../../store/api/mcqApi';
import { useGetSubjectsQuery } from '../../../store/api/classesApi';
import { McqQuestion } from '../../../types';
import { useSnackbar } from 'notistack';
import { useForm, Controller } from 'react-hook-form';

const difficultyColors: Record<string, 'success' | 'warning' | 'error'> = {
  EASY: 'success',
  MEDIUM: 'warning',
  HARD: 'error',
};

interface QuestionFormData {
  subjectId: string;
  questionText: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  correctOptionIndex: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

export const QuestionBankPage = () => {
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'EASY' | 'MEDIUM' | 'HARD' | ''>('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<McqQuestion | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useGetQuestionsQuery({
    page,
    size: rowsPerPage,
    search: search || undefined,
    subjectId: subjectFilter || undefined,
    difficulty: difficultyFilter || undefined,
  });

  const { data: subjectsData } = useGetSubjectsQuery();
  const [createQuestion, { isLoading: creating }] = useCreateQuestionMutation();
  const [updateQuestion, { isLoading: updating }] = useUpdateQuestionMutation();
  const [deleteQuestion] = useDeleteQuestionMutation();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<QuestionFormData>({
    defaultValues: {
      subjectId: '',
      questionText: '',
      option1: '',
      option2: '',
      option3: '',
      option4: '',
      correctOptionIndex: 0,
      difficulty: 'MEDIUM',
    },
  });

  useEffect(() => {
    dispatch(setPageTitle('Question Bank'));
  }, [dispatch]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, question: McqQuestion) => {
    setAnchorEl(event.currentTarget);
    setSelectedQuestion(question);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAddNew = () => {
    setSelectedQuestion(null);
    reset({
      subjectId: '',
      questionText: '',
      option1: '',
      option2: '',
      option3: '',
      option4: '',
      correctOptionIndex: 0,
      difficulty: 'MEDIUM',
    });
    setDialogOpen(true);
  };

  const handleEdit = () => {
    if (selectedQuestion) {
      reset({
        subjectId: selectedQuestion.subjectId,
        questionText: selectedQuestion.questionText,
        option1: selectedQuestion.options[0] || '',
        option2: selectedQuestion.options[1] || '',
        option3: selectedQuestion.options[2] || '',
        option4: selectedQuestion.options[3] || '',
        correctOptionIndex: selectedQuestion.correctOptionIndex,
        difficulty: selectedQuestion.difficulty,
      });
      setDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    if (selectedQuestion) {
      try {
        await deleteQuestion(selectedQuestion.questionId).unwrap();
        enqueueSnackbar('Question deleted successfully', { variant: 'success' });
        refetch();
      } catch {
        enqueueSnackbar('Failed to delete question', { variant: 'error' });
      }
    }
    setDeleteDialogOpen(false);
    setSelectedQuestion(null);
  };

  const onSubmit = async (data: QuestionFormData) => {
    const payload = {
      subjectId: data.subjectId,
      questionText: data.questionText,
      options: [data.option1, data.option2, data.option3, data.option4],
      correctOptionIndex: data.correctOptionIndex,
      difficulty: data.difficulty,
    };

    try {
      if (selectedQuestion) {
        await updateQuestion({
          questionId: selectedQuestion.questionId,
          data: payload,
        }).unwrap();
        enqueueSnackbar('Question updated successfully', { variant: 'success' });
      } else {
        await createQuestion(payload).unwrap();
        enqueueSnackbar('Question created successfully', { variant: 'success' });
      }
      setDialogOpen(false);
      refetch();
    } catch {
      enqueueSnackbar('Failed to save question', { variant: 'error' });
    }
  };

  const subjects = subjectsData?.data || [];
  const questions = data?.data?.content || [];
  const totalElements = data?.data?.totalElements || 0;

  return (
    <Box>
      <PageHeader
        title="Question Bank"
        subtitle="Manage MCQ questions for examinations"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'MCQ', path: '/mcq' },
          { label: 'Question Bank' },
        ]}
        action={{
          label: 'Add Question',
          icon: <AddIcon />,
          onClick: handleAddNew,
        }}
      />

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Subject</InputLabel>
            <Select
              value={subjectFilter}
              label="Subject"
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <MenuItem value="">All Subjects</MenuItem>
              {subjects.map((subject) => (
                <MenuItem key={subject.subjectId} value={subject.subjectId}>
                  {subject.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Difficulty</InputLabel>
            <Select
              value={difficultyFilter}
              label="Difficulty"
              onChange={(e) => setDifficultyFilter(e.target.value as typeof difficultyFilter)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="EASY">Easy</MenuItem>
              <MenuItem value="MEDIUM">Medium</MenuItem>
              <MenuItem value="HARD">Hard</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title="Refresh">
            <IconButton onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Card>

      {/* Questions Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Question</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Difficulty</TableCell>
                <TableCell>Options</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : questions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    No questions found
                  </TableCell>
                </TableRow>
              ) : (
                questions.map((question) => (
                  <TableRow key={question.questionId} hover>
                    <TableCell sx={{ maxWidth: 400 }}>
                      <Typography variant="body2" noWrap>
                        {question.questionText}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {subjects.find((s) => s.subjectId === question.subjectId)?.name || question.subjectId}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={question.difficulty}
                        size="small"
                        color={difficultyColors[question.difficulty]}
                      />
                    </TableCell>
                    <TableCell>{question.options.length}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={(e) => handleMenuOpen(e, question)}>
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={totalElements}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Card>

      {/* Actions Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Question Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>{selectedQuestion ? 'Edit Question' : 'Add New Question'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="subjectId"
                  control={control}
                  rules={{ required: 'Subject is required' }}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.subjectId}>
                      <InputLabel>Subject</InputLabel>
                      <Select {...field} label="Subject">
                        {subjects.map((subject) => (
                          <MenuItem key={subject.subjectId} value={subject.subjectId}>
                            {subject.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="difficulty"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Difficulty</InputLabel>
                      <Select {...field} label="Difficulty">
                        <MenuItem value="EASY">Easy</MenuItem>
                        <MenuItem value="MEDIUM">Medium</MenuItem>
                        <MenuItem value="HARD">Hard</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Controller
                  name="questionText"
                  control={control}
                  rules={{ required: 'Question is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Question"
                      multiline
                      rows={3}
                      error={!!errors.questionText}
                      helperText={errors.questionText?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Options (Select the correct answer)
                </Typography>
                <Controller
                  name="correctOptionIndex"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup {...field} value={field.value.toString()} onChange={(e) => field.onChange(parseInt(e.target.value, 10))}>
                      {[0, 1, 2, 3].map((index) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <FormControlLabel
                            value={index.toString()}
                            control={<Radio size="small" />}
                            label=""
                            sx={{ mr: 0 }}
                          />
                          <Controller
                            name={`option${index + 1}` as keyof QuestionFormData}
                            control={control}
                            rules={{ required: 'Option is required' }}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                fullWidth
                                size="small"
                                placeholder={`Option ${index + 1}`}
                                value={field.value as string}
                              />
                            )}
                          />
                        </Box>
                      ))}
                    </RadioGroup>
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={creating || updating}>
              {selectedQuestion ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Question</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this question?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuestionBankPage;
