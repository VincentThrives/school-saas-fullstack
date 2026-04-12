import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Button,
  CircularProgress,
  Paper,
  Grid,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as HourglassEmptyIcon,
} from '@mui/icons-material';
import { PageHeader } from '../../../components/common';
import { useGetWhatsAppMessageByIdQuery } from '../../../store/api/whatsappApi';
import { WhatsAppMessageStatus, WhatsAppDeliveryStatus } from '../../../types';

const statusColorMap: Record<WhatsAppMessageStatus, 'success' | 'info' | 'default' | 'warning' | 'error'> = {
  [WhatsAppMessageStatus.COMPLETED]: 'success',
  [WhatsAppMessageStatus.PROCESSING]: 'info',
  [WhatsAppMessageStatus.QUEUED]: 'default',
  [WhatsAppMessageStatus.PARTIALLY_FAILED]: 'warning',
  [WhatsAppMessageStatus.FAILED]: 'error',
};

const deliveryStatusColorMap: Record<WhatsAppDeliveryStatus, 'success' | 'info' | 'error' | 'default'> = {
  [WhatsAppDeliveryStatus.SENT]: 'success',
  [WhatsAppDeliveryStatus.DELIVERED]: 'success',
  [WhatsAppDeliveryStatus.PENDING]: 'info',
  [WhatsAppDeliveryStatus.FAILED]: 'error',
};

const deliveryStatusIconMap: Record<WhatsAppDeliveryStatus, React.ReactNode> = {
  [WhatsAppDeliveryStatus.SENT]: <CheckCircleIcon fontSize="small" />,
  [WhatsAppDeliveryStatus.DELIVERED]: <CheckCircleIcon fontSize="small" />,
  [WhatsAppDeliveryStatus.PENDING]: <HourglassEmptyIcon fontSize="small" />,
  [WhatsAppDeliveryStatus.FAILED]: <ErrorIcon fontSize="small" />,
};

export const WhatsAppMessageDetailPage = () => {
  const { messageId } = useParams<{ messageId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useGetWhatsAppMessageByIdQuery(messageId!, {
    skip: !messageId,
  });

  const message = data?.data;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !message) {
    return (
      <Box>
        <PageHeader
          title="Message Details"
          breadcrumbs={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'WhatsApp Messages', path: '/whatsapp' },
            { label: 'Details' },
          ]}
          secondaryAction={{
            label: 'Back',
            icon: <ArrowBackIcon />,
            onClick: () => navigate('/whatsapp'),
          }}
        />
        <Card>
          <CardContent>
            <Typography color="error" align="center">
              Message not found or failed to load.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Message Details"
        subtitle={`Sent on ${new Date(message.createdAt).toLocaleString()}`}
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'WhatsApp Messages', path: '/whatsapp' },
          { label: 'Details' },
        ]}
        secondaryAction={{
          label: 'Back',
          icon: <ArrowBackIcon />,
          onClick: () => navigate('/whatsapp'),
        }}
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Info Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Sent By
                </Typography>
                <Typography variant="h6">{message.sentByName}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  label={message.status}
                  color={statusColorMap[message.status] || 'default'}
                  sx={{ mt: 0.5 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Content Type
                </Typography>
                <Typography variant="h6">{message.contentType}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Recipients
                </Typography>
                <Typography variant="h6">{message.totalRecipients}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Sent Successfully
                </Typography>
                <Typography variant="h6" color="success.main">
                  {message.successCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Failed
                </Typography>
                <Typography variant="h6" color="error.main">
                  {message.failureCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Message Body */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Message Body
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: (theme) => alpha(theme.palette.background.default, 0.5),
                whiteSpace: 'pre-wrap',
              }}
            >
              <Typography variant="body1">{message.messageBody}</Typography>
            </Paper>

            {message.mediaUrl && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Attached File
                </Typography>
                <Chip
                  label={message.mediaFileName || 'Download File'}
                  component="a"
                  href={message.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  clickable
                  variant="outlined"
                />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Recipients Table */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recipients
            </Typography>
          </CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Delivery Status</TableCell>
                  <TableCell>Error Message</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {message.recipients && message.recipients.length > 0 ? (
                  message.recipients.map((recipient) => (
                    <TableRow key={recipient.parentId} hover>
                      <TableCell>{recipient.parentName}</TableCell>
                      <TableCell>{recipient.phone}</TableCell>
                      <TableCell>
                        <Chip
                          icon={deliveryStatusIconMap[recipient.deliveryStatus] as React.ReactElement}
                          label={recipient.deliveryStatus}
                          size="small"
                          color={deliveryStatusColorMap[recipient.deliveryStatus] || 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        {recipient.errorMessage ? (
                          <Typography variant="body2" color="error">
                            {recipient.errorMessage}
                          </Typography>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No recipient details available
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </motion.div>
    </Box>
  );
};

export default WhatsAppMessageDetailPage;
