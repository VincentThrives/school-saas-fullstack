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
  Avatar,
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
  DialogContentText,
  DialogActions,
  Button,
  Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  FileDownload as ExportIcon,
  FileUpload as ImportIcon,
} from '@mui/icons-material';
import { PageHeader } from '../../../components/common';
import { useAppDispatch } from '../../../store';
import { setPageTitle } from '../../../store/slices/uiSlice';
import { useGetTeachersQuery, useDeleteTeacherMutation } from '../../../store/api/teachersApi';
import { useGetSubjectsQuery, useGetClassesQuery } from '../../../store/api/classesApi';
import { Teacher } from '../../../types';
import { useSnackbar } from 'notistack';

export const TeachersListPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useGetTeachersQuery({
    page,
    size: rowsPerPage,
    search: search || undefined,
    subjectId: subjectFilter || undefined,
    classId: classFilter || undefined,
  });

  const { data: subjectsData } = useGetSubjectsQuery();
  const { data: classesData } = useGetClassesQuery();
  const [deleteTeacher] = useDeleteTeacherMutation();

  useEffect(() => {
    dispatch(setPageTitle('Teachers'));
  }, [dispatch]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, teacher: Teacher) => {
    setAnchorEl(event.currentTarget);
    setSelectedTeacher(teacher);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTeacher(null);
  };

  const handleView = () => {
    if (selectedTeacher) {
      navigate(`/teachers/${selectedTeacher.teacherId}`);
    }
    handleMenuClose();
  };

  const handleEdit = () => {
    if (selectedTeacher) {
      navigate(`/teachers/${selectedTeacher.teacherId}/edit`);
    }
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedTeacher) {
      try {
        await deleteTeacher(selectedTeacher.teacherId).unwrap();
        enqueueSnackbar('Teacher deleted successfully', { variant: 'success' });
        refetch();
      } catch {
        enqueueSnackbar('Failed to delete teacher', { variant: 'error' });
      }
    }
    setDeleteDialogOpen(false);
    handleMenuClose();
  };

  const subjects = subjectsData?.data || [];
  const classes = classesData?.data || [];
  const teachers = data?.data?.content || [];
  const totalElements = data?.data?.totalElements || 0;

  return (
    <Box>
      <PageHeader
        title="Teachers"
        subtitle="Manage all teachers in your school"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Teachers' },
        ]}
        action={{
          label: 'Add Teacher',
          icon: <AddIcon />,
          onClick: () => navigate('/teachers/new'),
        }}
        secondaryAction={{
          label: 'Import',
          icon: <ImportIcon />,
          onClick: () => navigate('/teachers/import'),
        }}
      />

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search teachers..."
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

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Class</InputLabel>
            <Select
              value={classFilter}
              label="Class"
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <MenuItem value="">All Classes</MenuItem>
              {classes.map((cls) => (
                <MenuItem key={cls.classId} value={cls.classId}>
                  {cls.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title="Refresh">
            <IconButton onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Export">
            <IconButton>
              <ExportIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Card>

      {/* Teachers Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Teacher</TableCell>
                <TableCell>Employee ID</TableCell>
                <TableCell>Specialization</TableCell>
                <TableCell>Subjects</TableCell>
                <TableCell>Class Teacher</TableCell>
                <TableCell>Contact</TableCell>
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
              ) : teachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    No teachers found
                  </TableCell>
                </TableRow>
              ) : (
                teachers.map((teacher) => (
                  <TableRow key={teacher.teacherId} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          src={teacher.user?.profilePhotoUrl}
                          sx={{ width: 40, height: 40 }}
                        >
                          {teacher.user?.firstName?.charAt(0)}
                        </Avatar>
                        <Box>
                          <Box sx={{ fontWeight: 500 }}>
                            {teacher.user?.firstName} {teacher.user?.lastName}
                          </Box>
                          <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                            {teacher.user?.email}
                          </Box>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{teacher.employeeId}</TableCell>
                    <TableCell>{teacher.specialization}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                        {teacher.subjects?.slice(0, 2).map((subject) => (
                          <Chip
                            key={subject.subjectId}
                            label={subject.name}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                        {teacher.subjects && teacher.subjects.length > 2 && (
                          <Chip
                            label={`+${teacher.subjects.length - 2}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {teacher.isClassTeacher ? (
                        <Chip
                          label={`${teacher.classTeacherOf?.className || ''} - ${teacher.classTeacherOf?.sectionName || ''}`}
                          size="small"
                          color="primary"
                        />
                      ) : (
                        <Chip label="No" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>{teacher.user?.phone || '-'}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, teacher)}
                      >
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
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleView}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>

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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Teacher</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {selectedTeacher?.user?.firstName} {selectedTeacher?.user?.lastName}?
            This action cannot be undone.
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

export default TeachersListPage;
