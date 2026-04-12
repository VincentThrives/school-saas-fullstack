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
  IconButton,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  alpha,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Archive as ArchiveIcon,
  CheckCircle as SetCurrentIcon,
  Refresh as RefreshIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { PageHeader } from '../../../components/common';
import { useAppDispatch, useAppSelector } from '../../../store';
import { setPageTitle } from '../../../store/slices/uiSlice';
import { selectSelectedAcademicYearId, setSelectedAcademicYear } from '../../../store/slices/uiSlice';
import {
  useGetAcademicYearsQuery,
  useCreateAcademicYearMutation,
  useSetCurrentAcademicYearMutation,
  useArchiveAcademicYearMutation,
} from '../../../store/api/classesApi';
import { AcademicYear } from '../../../types';
import { useSnackbar } from 'notistack';

const GOLD = '#D4A843';

export const AcademicYearsListPage = () => {
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const selectedAcademicYearId = useAppSelector(selectSelectedAcademicYearId);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null);

  const { data: academicYearsData, isLoading, refetch } = useGetAcademicYearsQuery();
  const [createAcademicYear, { isLoading: isCreating }] = useCreateAcademicYearMutation();
  const [setCurrentAcademicYear] = useSetCurrentAcademicYearMutation();
  const [archiveAcademicYear] = useArchiveAcademicYearMutation();

  const academicYears = academicYearsData?.data || [];

  useEffect(() => {
    dispatch(setPageTitle('Academic Years'));
  }, [dispatch]);

  // Auto-suggest next academic year
  const suggestNextYear = () => {
    const currentYear = new Date().getFullYear();
    const existingLabels = academicYears.map((ay) => ay.label);

    // Try to find the next year that doesn't exist
    for (let y = currentYear; y <= currentYear + 5; y++) {
      const label = `${y}-${y + 1}`;
      if (!existingLabels.includes(label)) {
        setNewLabel(label);
        setNewStartDate(`${y}-04-01`);
        setNewEndDate(`${y + 1}-03-31`);
        return;
      }
    }
    setNewLabel('');
    setNewStartDate('');
    setNewEndDate('');
  };

  const handleOpenCreate = () => {
    suggestNextYear();
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!newLabel.trim() || !newStartDate || !newEndDate) {
      enqueueSnackbar('Please fill all fields', { variant: 'warning' });
      return;
    }

    try {
      await createAcademicYear({
        label: newLabel.trim(),
        startDate: newStartDate,
        endDate: newEndDate,
      }).unwrap();
      enqueueSnackbar(`Academic year "${newLabel}" created successfully`, { variant: 'success' });
      setCreateDialogOpen(false);
      setNewLabel('');
      setNewStartDate('');
      setNewEndDate('');
      refetch();
    } catch {
      enqueueSnackbar('Failed to create academic year', { variant: 'error' });
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, year: AcademicYear) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedYear(year);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedYear(null);
  };

  const handleSetCurrent = async () => {
    if (selectedYear) {
      try {
        await setCurrentAcademicYear(selectedYear.academicYearId).unwrap();
        dispatch(setSelectedAcademicYear(selectedYear.academicYearId));
        enqueueSnackbar(`"${selectedYear.label}" set as current academic year`, { variant: 'success' });
        refetch();
      } catch {
        enqueueSnackbar('Failed to set current academic year', { variant: 'error' });
      }
    }
    handleMenuClose();
  };

  const handleArchive = async () => {
    if (selectedYear) {
      try {
        await archiveAcademicYear(selectedYear.academicYearId).unwrap();
        enqueueSnackbar(`"${selectedYear.label}" archived successfully`, { variant: 'success' });
        refetch();
      } catch {
        enqueueSnackbar('Failed to archive academic year', { variant: 'error' });
      }
    }
    handleMenuClose();
  };

  const handleSelectYear = (yearId: string) => {
    dispatch(setSelectedAcademicYear(yearId));
    enqueueSnackbar('Academic year switched', { variant: 'info' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Box>
        <PageHeader
          title="Academic Years"
          subtitle="Manage academic years. Create new years, set the current year, and archive old ones."
          breadcrumbs={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Academic Years' },
          ]}
          action={{
            label: 'Create Academic Year',
            icon: <AddIcon />,
            onClick: handleOpenCreate,
          }}
        />

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card
            sx={{
              mb: 3,
              p: 2.5,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              border: `1px solid ${alpha(GOLD, 0.15)}`,
              bgcolor: alpha(GOLD, 0.03),
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: alpha(GOLD, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarIcon sx={{ color: GOLD, fontSize: 24 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                Active Academic Year:{' '}
                <Chip
                  label={academicYears.find((ay) => ay.isCurrent)?.label || 'Not Set'}
                  size="small"
                  sx={{
                    bgcolor: alpha(GOLD, 0.12),
                    color: '#B8860B',
                    fontWeight: 700,
                    ml: 1,
                  }}
                />
              </Typography>
              <Typography variant="caption" color="text.secondary">
                The current academic year is used across all modules - attendance, exams, fees, timetable, etc.
              </Typography>
            </Box>
            <Tooltip title="Refresh">
              <IconButton onClick={() => refetch()}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Card>
        </motion.div>

        {/* Academic Years Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Academic Year</TableCell>
                    <TableCell>Start Date</TableCell>
                    <TableCell>End Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Selected</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">Loading academic years...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : academicYears.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          No academic years found. Create one to get started.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    academicYears.map((year, index) => (
                      <motion.tr
                        key={year.academicYearId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        style={{ display: 'table-row' }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box
                              sx={{
                                width: 36,
                                height: 36,
                                borderRadius: 2,
                                bgcolor: year.isCurrent ? alpha(GOLD, 0.12) : alpha('#000', 0.04),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <CalendarIcon
                                sx={{
                                  fontSize: 18,
                                  color: year.isCurrent ? GOLD : 'text.secondary',
                                }}
                              />
                            </Box>
                            <Typography fontWeight={year.isCurrent ? 700 : 500}>
                              {year.label}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {new Date(year.startDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          {new Date(year.endDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          {year.isCurrent ? (
                            <Chip
                              label="Current"
                              size="small"
                              sx={{
                                bgcolor: alpha(GOLD, 0.12),
                                color: '#B8860B',
                                fontWeight: 700,
                              }}
                            />
                          ) : year.status === 'ARCHIVED' ? (
                            <Chip
                              label="Archived"
                              size="small"
                              variant="outlined"
                              sx={{ color: 'text.secondary', borderColor: 'divider' }}
                            />
                          ) : (
                            <Chip
                              label="Active"
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {selectedAcademicYearId === year.academicYearId ? (
                            <Chip
                              label="In Use"
                              size="small"
                              sx={{
                                bgcolor: alpha('#2E7D32', 0.1),
                                color: '#2E7D32',
                                fontWeight: 600,
                              }}
                            />
                          ) : (
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => handleSelectYear(year.academicYearId)}
                              sx={{ fontSize: '0.75rem', color: GOLD }}
                            >
                              Switch to this
                            </Button>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, year)}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </motion.div>

        {/* Actions Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          {selectedYear && !selectedYear.isCurrent && selectedYear.status !== 'ARCHIVED' && (
            <MenuItem onClick={handleSetCurrent}>
              <ListItemIcon>
                <SetCurrentIcon fontSize="small" sx={{ color: GOLD }} />
              </ListItemIcon>
              <ListItemText>Set as Current</ListItemText>
            </MenuItem>
          )}
          {selectedYear && !selectedYear.isCurrent && selectedYear.status !== 'ARCHIVED' && (
            <MenuItem onClick={handleArchive}>
              <ListItemIcon>
                <ArchiveIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Archive</ListItemText>
            </MenuItem>
          )}
          {selectedYear?.isCurrent && (
            <MenuItem disabled>
              <ListItemIcon>
                <SetCurrentIcon fontSize="small" sx={{ color: GOLD }} />
              </ListItemIcon>
              <ListItemText>This is the current year</ListItemText>
            </MenuItem>
          )}
          {selectedYear?.status === 'ARCHIVED' && (
            <MenuItem disabled>
              <ListItemIcon>
                <ArchiveIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Already archived</ListItemText>
            </MenuItem>
          )}
        </Menu>

        {/* Create Academic Year Dialog */}
        <Dialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 700 }}>
            Create New Academic Year
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create a new academic year for the upcoming session. All modules will use this
              year when selected.
            </Typography>

            <TextField
              fullWidth
              label="Academic Year Label"
              placeholder="e.g., 2025-2026"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              sx={{ mb: 2.5 }}
              helperText="Format: YYYY-YYYY (e.g., 2025-2026)"
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="Usually April 1st"
              />
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="Usually March 31st"
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              variant="contained"
              disabled={isCreating || !newLabel.trim() || !newStartDate || !newEndDate}
              sx={{
                background: `linear-gradient(135deg, ${GOLD} 0%, #B8860B 100%)`,
                color: '#FFFFFF',
              }}
            >
              {isCreating ? 'Creating...' : 'Create Academic Year'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </motion.div>
  );
};

export default AcademicYearsListPage;
