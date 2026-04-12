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
  DialogContentText,
  DialogActions,
  Button,
  Stack,
  Collapse,
  Typography,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Group as GroupIcon,
} from '@mui/icons-material';
import { PageHeader } from '../../../components/common';
import { useAppDispatch } from '../../../store';
import { setPageTitle } from '../../../store/slices/uiSlice';
import { useGetClassesQuery, useDeleteClassMutation, useGetAcademicYearsQuery } from '../../../store/api/classesApi';
import { Class } from '../../../types';
import { useSnackbar } from 'notistack';

export const ClassesListPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();

  const [search, setSearch] = useState('');
  const [academicYearFilter, setAcademicYearFilter] = useState('');
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: classesData, isLoading, refetch } = useGetClassesQuery(
    academicYearFilter ? { academicYearId: academicYearFilter } : undefined
  );
  const { data: academicYearsData } = useGetAcademicYearsQuery();
  const [deleteClass] = useDeleteClassMutation();

  useEffect(() => {
    dispatch(setPageTitle('Classes & Sections'));
  }, [dispatch]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, cls: Class) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedClass(cls);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedClass(null);
  };

  const handleEdit = () => {
    if (selectedClass) {
      navigate(`/classes/${selectedClass.classId}/edit`);
    }
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedClass) {
      try {
        await deleteClass(selectedClass.classId).unwrap();
        enqueueSnackbar('Class deleted successfully', { variant: 'success' });
        refetch();
      } catch {
        enqueueSnackbar('Failed to delete class', { variant: 'error' });
      }
    }
    setDeleteDialogOpen(false);
    handleMenuClose();
  };

  const toggleExpand = (classId: string) => {
    setExpandedClass(expandedClass === classId ? null : classId);
  };

  const academicYears = academicYearsData?.data || [];
  const classes = (classesData?.data || []).filter(
    (cls) => !search || cls.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <PageHeader
        title="Classes & Sections"
        subtitle="Manage classes and their sections"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Classes' },
        ]}
        action={{
          label: 'Add Class',
          icon: <AddIcon />,
          onClick: () => navigate('/classes/new'),
        }}
      />

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search classes..."
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

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Academic Year</InputLabel>
            <Select
              value={academicYearFilter}
              label="Academic Year"
              onChange={(e) => setAcademicYearFilter(e.target.value)}
            >
              <MenuItem value="">All Years</MenuItem>
              {academicYears.map((year) => (
                <MenuItem key={year.academicYearId} value={year.academicYearId}>
                  {year.label} {year.isCurrent && '(Current)'}
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
        </Box>
      </Card>

      {/* Classes Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={50}></TableCell>
                <TableCell>Class Name</TableCell>
                <TableCell>Grade</TableCell>
                <TableCell>Sections</TableCell>
                <TableCell>Total Students</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : classes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    No classes found
                  </TableCell>
                </TableRow>
              ) : (
                classes.map((cls) => (
                  <>
                    <TableRow
                      key={cls.classId}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => toggleExpand(cls.classId)}
                    >
                      <TableCell>
                        <IconButton size="small">
                          {expandedClass === cls.classId ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ fontWeight: 500 }}>{cls.name}</Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={`Grade ${cls.grade}`} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          {cls.sections.slice(0, 3).map((section) => (
                            <Chip
                              key={section.sectionId}
                              label={section.name}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ))}
                          {cls.sections.length > 3 && (
                            <Chip
                              label={`+${cls.sections.length - 3}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<GroupIcon />}
                          label={cls.sections.reduce((sum, s) => sum + s.studentCount, 0)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, cls)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 0, borderBottom: expandedClass === cls.classId ? undefined : 'none' }}>
                        <Collapse in={expandedClass === cls.classId} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, px: 2 }}>
                            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                              Sections
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Section Name</TableCell>
                                  <TableCell>Class Teacher</TableCell>
                                  <TableCell>Capacity</TableCell>
                                  <TableCell>Students</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {cls.sections.map((section) => (
                                  <TableRow key={section.sectionId}>
                                    <TableCell>{section.name}</TableCell>
                                    <TableCell>{section.classTeacherName || 'Not Assigned'}</TableCell>
                                    <TableCell>{section.capacity}</TableCell>
                                    <TableCell>
                                      <Chip
                                        label={`${section.studentCount} / ${section.capacity}`}
                                        size="small"
                                        color={section.studentCount >= section.capacity ? 'error' : 'success'}
                                        variant="outlined"
                                      />
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {cls.sections.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={4} align="center">
                                      No sections added yet
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Class</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete Class</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Class</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {selectedClass?.name}?
            This will also delete all sections and affect student assignments.
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

export default ClassesListPage;
