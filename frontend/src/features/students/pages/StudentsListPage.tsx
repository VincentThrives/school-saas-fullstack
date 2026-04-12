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
import { useGetStudentsQuery, useDeleteStudentMutation } from '../../../store/api/studentsApi';
import { useGetClassesQuery } from '../../../store/api/classesApi';
import { Student, Gender } from '../../../types';
import { useSnackbar } from 'notistack';

export const StudentsListPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState<Gender | ''>('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useGetStudentsQuery({
    page,
    size: rowsPerPage,
    search: search || undefined,
    classId: classFilter || undefined,
    sectionId: sectionFilter || undefined,
    gender: genderFilter || undefined,
  });

  const { data: classesData } = useGetClassesQuery();
  const [deleteStudent] = useDeleteStudentMutation();

  useEffect(() => {
    dispatch(setPageTitle('Students'));
  }, [dispatch]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, student: Student) => {
    setAnchorEl(event.currentTarget);
    setSelectedStudent(student);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedStudent(null);
  };

  const handleView = () => {
    if (selectedStudent) {
      navigate(`/students/${selectedStudent.studentId}`);
    }
    handleMenuClose();
  };

  const handleEdit = () => {
    if (selectedStudent) {
      navigate(`/students/${selectedStudent.studentId}/edit`);
    }
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedStudent) {
      try {
        await deleteStudent(selectedStudent.studentId).unwrap();
        enqueueSnackbar('Student deleted successfully', { variant: 'success' });
        refetch();
      } catch {
        enqueueSnackbar('Failed to delete student', { variant: 'error' });
      }
    }
    setDeleteDialogOpen(false);
    handleMenuClose();
  };

  const classes = classesData?.data || [];
  const selectedClass = classes.find((c) => c.classId === classFilter);
  const sections = selectedClass?.sections || [];
  const students = data?.data?.content || [];
  const totalElements = data?.data?.totalElements || 0;

  return (
    <Box>
      <PageHeader
        title="Students"
        subtitle="Manage all students in your school"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Students' },
        ]}
        action={{
          label: 'Add Student',
          icon: <AddIcon />,
          onClick: () => navigate('/students/new'),
        }}
        secondaryAction={{
          label: 'Import',
          icon: <ImportIcon />,
          onClick: () => navigate('/students/import'),
        }}
      />

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search students..."
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
            <InputLabel>Class</InputLabel>
            <Select
              value={classFilter}
              label="Class"
              onChange={(e) => {
                setClassFilter(e.target.value);
                setSectionFilter('');
              }}
            >
              <MenuItem value="">All Classes</MenuItem>
              {classes.map((cls) => (
                <MenuItem key={cls.classId} value={cls.classId}>
                  {cls.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }} disabled={!classFilter}>
            <InputLabel>Section</InputLabel>
            <Select
              value={sectionFilter}
              label="Section"
              onChange={(e) => setSectionFilter(e.target.value)}
            >
              <MenuItem value="">All Sections</MenuItem>
              {sections.map((section) => (
                <MenuItem key={section.sectionId} value={section.sectionId}>
                  {section.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Gender</InputLabel>
            <Select
              value={genderFilter}
              label="Gender"
              onChange={(e) => setGenderFilter(e.target.value as Gender | '')}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value={Gender.MALE}>Male</MenuItem>
              <MenuItem value={Gender.FEMALE}>Female</MenuItem>
              <MenuItem value={Gender.OTHER}>Other</MenuItem>
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

      {/* Students Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Admission No.</TableCell>
                <TableCell>Roll No.</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Gender</TableCell>
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
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    No students found
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <TableRow key={student.studentId} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          src={student.user?.profilePhotoUrl}
                          sx={{ width: 40, height: 40 }}
                        >
                          {student.user?.firstName?.charAt(0)}
                        </Avatar>
                        <Box>
                          <Box sx={{ fontWeight: 500 }}>
                            {student.user?.firstName} {student.user?.lastName}
                          </Box>
                          <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                            {student.user?.email}
                          </Box>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{student.admissionNumber}</TableCell>
                    <TableCell>{student.rollNumber}</TableCell>
                    <TableCell>
                      <Chip
                        label={`${student.className || 'N/A'} - ${student.sectionName || 'N/A'}`}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={student.gender}
                        size="small"
                        color={student.gender === Gender.MALE ? 'info' : student.gender === Gender.FEMALE ? 'secondary' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{student.user?.phone || '-'}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, student)}
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
        <DialogTitle>Delete Student</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {selectedStudent?.user?.firstName} {selectedStudent?.user?.lastName}?
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

export default StudentsListPage;
