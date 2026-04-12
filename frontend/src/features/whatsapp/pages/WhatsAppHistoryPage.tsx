import { useState } from 'react';
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
  Chip,
  IconButton,
  Typography,
  Button,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import {
  Visibility as VisibilityIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { PageHeader } from '../../../components/common';
import { useGetWhatsAppMessagesQuery } from '../../../store/api/whatsappApi';
import { WhatsAppMessageStatus } from '../../../types';

const statusColorMap: Record<WhatsAppMessageStatus, 'success' | 'info' | 'default' | 'warning' | 'error'> = {
  [WhatsAppMessageStatus.COMPLETED]: 'success',
  [WhatsAppMessageStatus.PROCESSING]: 'info',
  [WhatsAppMessageStatus.QUEUED]: 'default',
  [WhatsAppMessageStatus.PARTIALLY_FAILED]: 'warning',
  [WhatsAppMessageStatus.FAILED]: 'error',
};

export const WhatsAppHistoryPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { data, isLoading } = useGetWhatsAppMessagesQuery({ page, size: rowsPerPage });

  const messages = data?.data?.content || [];
  const totalElements = data?.data?.totalElements || 0;

  return (
    <Box>
      <PageHeader
        title="WhatsApp Messages"
        subtitle="View and manage sent WhatsApp messages"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'WhatsApp Messages' },
        ]}
        action={{
          label: 'Compose New',
          icon: <SendIcon />,
          onClick: () => navigate('/whatsapp/compose'),
        }}
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Sent</TableCell>
                  <TableCell>Failed</TableCell>
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
                ) : messages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No messages sent yet
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  messages.map((msg) => (
                    <TableRow key={msg.messageId} hover>
                      <TableCell>
                        {new Date(msg.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {msg.classId ? msg.className || 'Class' : 'Individual'}
                      </TableCell>
                      <TableCell>{msg.totalRecipients}</TableCell>
                      <TableCell>{msg.successCount}</TableCell>
                      <TableCell>{msg.failureCount}</TableCell>
                      <TableCell>
                        <Chip
                          label={msg.status}
                          size="small"
                          color={statusColorMap[msg.status] || 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/whatsapp/${msg.messageId}`)}
                        >
                          <VisibilityIcon fontSize="small" />
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
      </motion.div>
    </Box>
  );
};

export default WhatsAppHistoryPage;
