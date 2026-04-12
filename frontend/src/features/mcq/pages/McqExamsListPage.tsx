import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Publish as PublishIcon,
  Assessment as ResultsIcon,
  QuestionAnswer as QuestionsIcon,
} from '@mui/icons-material';
import { PageHeader } from '../../../components/common';
import { useAppDispatch } from '../../../store';
import { setPageTitle } from '../../../store/slices/uiSlice';
import { useGetMcqExamsQuery, useDeleteMcqExamMutation, usePublishMcqExamMutation } from '../../../store/api/mcqApi';
import { useGetSubjectsQuery, useGetClassesQuery } from '../../../store/api/classesApi';
import { McqExam } from '../../../types';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'info'> = {
  DRAFT: 'default',
  PUBLISHED: 'info',
  ONGOING: 'warning',
  COMPLETED: 'success',
};

export const McqExamsListPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | ''>('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedExam, setSelectedExam] = useState<McqExam | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useGetMcqExamsQuery({
    page,
    size: rowsPerPage,
    subjectId: subjectFilter || undefined,
    status: statusFilter || undefined,
  });

  const { data: subjectsData } = useGetSubjectsQuery();
  const [deleteMcqExam] = useDeleteMcqExamMutation();
  const [publishMcqExam] = usePublishMcqExamMutation();

  useEffect(() => {
    dispatch(setPageTitle('MCQ Exams'));
  }, [dispatch]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, exam: McqExam) => {
    setAnchorEl(event.currentTarget);
    setSelectedExam(exam);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedExam(null);
  };

  const handleEdit = () => {
    if (selectedExam) {
      navigate(`/mcq/${selectedExam.examId}/edit`);
    }
    handleMenuClose();
  };

  const handleViewResults = () => {
    if (selectedExam) {
      navigate(`/mcq/${selectedExam.examId}/results`);
    }
    handleMenuClose();
  };

  const handlePublish = async () => {
    if (selectedExam) {
      try {
        await publishMcqExam(selectedExam.examId).unwrap();
        enqueueSnackbar('MCQ Exam published successfully', { variant: 'success' });
        refetch();
      } catch {
        enqueueSnackbar('Failed to publish exam', { variant: 'error' });
      }
    }
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedExam) {
      try {
        await deleteMcqExam(selectedExam.examId).unwrap();
        enqueueSnackbar('MCQ Exam deleted successfully', { variant: 'success' });
        refetch();
      } catch {
        enqueueSnackbar('Failed to delete exam', { variant: 'error' });
      }
    }
    setDeleteDialogOpen(false);
    handleMenuClose();
  };

  const subjects = subjectsData?.data || [];
  const exams = data?.data?.content || [];
  const totalElements = data?.data?.totalElements || 0;

  return (
    <Box>
      <PageHeader
        title="MCQ Exams"
        subtitle="Create and manage online MCQ examinations"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'MCQ Exams' },
        ]}
        action={{
          label: 'Create MCQ Exam',
          icon: <AddIcon />,
          onClick: () => navigate('/mcq/new'),
        }}
        secondaryAction={{
          label: 'Question Bank',
          icon: <QuestionsIcon />,
          onClick: () => navigate('/mcq/questions'),
        }}
      />

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <MenuItem value="">All Status</MenuItem>
              <MenuItem value="DRAFT">Draft</MenuItem>
              <MenuItem value="PUBLISHED">Published</MenuItem>
              <MenuItem value="ONGOING">Ongoing</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
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

      {/* Exams Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Questions</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Available</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : exams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    No MCQ exams found
                  </TableCell>
                </TableRow>
              ) : (
                exams.map((exam) => (
                  <TableRow key={exam.examId} hover>
                    <TableCell>
                      <Box sx={{ fontWeight: 500 }}>{exam.title}</Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={exam.subjectName} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{exam.questionIds?.length || 0}</TableCell>
                    <TableCell>{exam.duration} mins</TableCell>
                    <TableCell>
                      <Box sx={{ fontSize: '0.875rem' }}>
                        {dayjs(exam.startTime).format('DD MMM, HH:mm')} -
                        <br />
                        {dayjs(exam.endTime).format('DD MMM, HH:mm')}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={exam.status}
                        size="small"
                        color={statusColors[exam.status] || 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={(e) => handleMenuOpen(e, exam)}>
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
        {selectedExam?.status === 'DRAFT' && (
          <MenuItem onClick={handlePublish}>
            <ListItemIcon>
              <PublishIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Publish</ListItemText>
          </MenuItem>
        )}

        {(selectedExam?.status === 'COMPLETED' || selectedExam?.status === 'ONGOING') && (
          <MenuItem onClick={handleViewResults}>
            <ListItemIcon>
              <ResultsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>View Results</ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={handleEdit} disabled={selectedExam?.status !== 'DRAFT'}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={handleDeleteClick}
          sx={{ color: 'error.main' }}
          disabled={selectedExam?.status !== 'DRAFT'}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete MCQ Exam</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{selectedExam?.title}"? This action cannot be undone.
          </DialogContentText>
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

export default McqExamsListPage;
