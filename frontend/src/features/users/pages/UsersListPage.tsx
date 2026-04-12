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
  Button,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Refresh as RefreshIcon,
  FileDownload as ExportIcon,
  FileUpload as ImportIcon,
} from '@mui/icons-material';
import { PageHeader } from '../../../components/common';
import { useAppDispatch } from '../../../store';
import { setPageTitle } from '../../../store/slices/uiSlice';
import { useGetUsersQuery, useUpdateUserStatusMutation, useUnlockUserMutation, useDeleteUserMutation } from '../../../store/api/usersApi';
import { UserRole, User } from '../../../types';

const roleColors: Record<UserRole, 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  [UserRole.SUPER_ADMIN]: 'error',
  [UserRole.SCHOOL_ADMIN]: 'primary',
  [UserRole.PRINCIPAL]: 'secondary',
  [UserRole.TEACHER]: 'info',
  [UserRole.STUDENT]: 'success',
  [UserRole.PARENT]: 'warning',
};

export const UsersListPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'locked' | ''>('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useGetUsersQuery({
    page,
    size: rowsPerPage,
    search: search || undefined,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
  });

  const [updateUserStatus] = useUpdateUserStatusMutation();
  const [unlockUser] = useUnlockUserMutation();
  const [deleteUser] = useDeleteUserMutation();

  useEffect(() => {
    dispatch(setPageTitle('Users'));
  }, [dispatch]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: User) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedUser(null);
  };

  const handleEdit = () => {
    if (selectedUser) {
      navigate(`/users/${selectedUser.userId}/edit`);
    }
    handleMenuClose();
  };

  const handleToggleStatus = async () => {
    if (selectedUser) {
      await updateUserStatus({
        userId: selectedUser.userId,
        isActive: !selectedUser.isActive,
      });
      refetch();
    }
    handleMenuClose();
  };

  const handleUnlock = async () => {
    if (selectedUser) {
      await unlockUser(selectedUser.userId);
      refetch();
    }
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedUser) {
      await deleteUser(selectedUser.userId);
      refetch();
    }
    setDeleteDialogOpen(false);
    handleMenuClose();
  };

  const users = data?.data?.content || [];
  const totalElements = data?.data?.totalElements || 0;

  return (
    <Box>
      <PageHeader
        title="Users"
        subtitle="Manage all users in your school"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Users' },
        ]}
        action={{
          label: 'Add User',
          icon: <AddIcon />,
          onClick: () => navigate('/users/new'),
        }}
        secondaryAction={{
          label: 'Import',
          icon: <ImportIcon />,
          onClick: () => navigate('/users/import'),
        }}
      />

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search users..."
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
            <InputLabel>Role</InputLabel>
            <Select
              value={roleFilter}
              label="Role"
              onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
            >
              <MenuItem value="">All Roles</MenuItem>
              <MenuItem value={UserRole.SCHOOL_ADMIN}>School Admin</MenuItem>
              <MenuItem value={UserRole.PRINCIPAL}>Principal</MenuItem>
              <MenuItem value={UserRole.TEACHER}>Teacher</MenuItem>
              <MenuItem value={UserRole.STUDENT}>Student</MenuItem>
              <MenuItem value={UserRole.PARENT}>Parent</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value as 'active' | 'inactive' | 'locked' | '')}
            >
              <MenuItem value="">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="locked">Locked</MenuItem>
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

      {/* Users Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Login</TableCell>
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
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.userId} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          src={user.profilePhotoUrl}
                          sx={{ width: 40, height: 40 }}
                        >
                          {user.firstName?.charAt(0)}
                        </Avatar>
                        <Box>
                          <Box sx={{ fontWeight: 500 }}>
                            {user.firstName} {user.lastName}
                          </Box>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.role.replace('_', ' ')}
                        size="small"
                        color={roleColors[user.role]}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{user.phone || '-'}</TableCell>
                    <TableCell>
                      {user.isLocked ? (
                        <Chip label="Locked" size="small" color="error" />
                      ) : user.isActive ? (
                        <Chip label="Active" size="small" color="success" />
                      ) : (
                        <Chip label="Inactive" size="small" color="default" />
                      )}
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, user)}
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
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>

        {selectedUser?.isLocked ? (
          <MenuItem onClick={handleUnlock}>
            <ListItemIcon>
              <LockOpenIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Unlock Account</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={handleToggleStatus}>
            <ListItemIcon>
              <LockIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              {selectedUser?.isActive ? 'Deactivate' : 'Activate'}
            </ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {selectedUser?.firstName} {selectedUser?.lastName}?
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

export default UsersListPage;
