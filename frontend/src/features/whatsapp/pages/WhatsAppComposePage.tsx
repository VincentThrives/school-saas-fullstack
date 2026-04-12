import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  IconButton,
  Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useSnackbar } from 'notistack';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { PageHeader } from '../../../components/common';
import {
  useSendWhatsAppMessageMutation,
  useResolveWhatsAppRecipientsMutation,
  useUploadWhatsAppMediaMutation,
} from '../../../store/api/whatsappApi';
import { useGetClassesQuery } from '../../../store/api/classesApi';
import { WhatsAppRecipientInfo } from '../../../types';

export const WhatsAppComposePage = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recipientType, setRecipientType] = useState<'CLASS' | 'INDIVIDUAL'>('CLASS');
  const [classId, setClassId] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [recipients, setRecipients] = useState<WhatsAppRecipientInfo[]>([]);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFileName, setMediaFileName] = useState('');
  const [mediaMimeType, setMediaMimeType] = useState('');

  const { data: classesData } = useGetClassesQuery();
  const [sendWhatsAppMessage, { isLoading: isSending }] = useSendWhatsAppMessageMutation();
  const [resolveWhatsAppRecipients, { isLoading: isResolving }] = useResolveWhatsAppRecipientsMutation();
  const [uploadWhatsAppMedia, { isLoading: isUploading }] = useUploadWhatsAppMediaMutation();

  const classes = classesData?.data || [];

  const handlePreviewRecipients = async () => {
    try {
      const result = await resolveWhatsAppRecipients({
        recipientType,
        classId: recipientType === 'CLASS' ? classId : undefined,
      }).unwrap();
      setRecipients(result.data || []);
    } catch {
      enqueueSnackbar('Failed to resolve recipients', { variant: 'error' });
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await uploadWhatsAppMedia(formData).unwrap();
      if (result.data) {
        setMediaUrl(result.data.url);
        setMediaFileName(result.data.fileName);
        setMediaMimeType(result.data.mimeType);
      }
    } catch {
      enqueueSnackbar('Failed to upload file', { variant: 'error' });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveMedia = () => {
    setMediaUrl('');
    setMediaFileName('');
    setMediaMimeType('');
  };

  const handleSend = async () => {
    try {
      await sendWhatsAppMessage({
        recipientType,
        classId: recipientType === 'CLASS' ? classId : undefined,
        messageBody,
        mediaUrl: mediaUrl || undefined,
        mediaFileName: mediaFileName || undefined,
        mediaMimeType: mediaMimeType || undefined,
      }).unwrap();
      enqueueSnackbar('Messages queued!', { variant: 'success' });
      navigate('/whatsapp');
    } catch {
      enqueueSnackbar('Failed to send message', { variant: 'error' });
    }
  };

  const isSendDisabled =
    !messageBody.trim() || (recipientType === 'CLASS' && !classId) || isSending;

  return (
    <Box>
      <PageHeader
        title="Compose WhatsApp Message"
        subtitle="Send a new WhatsApp message to parents"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'WhatsApp Messages', path: '/whatsapp' },
          { label: 'Compose' },
        ]}
        secondaryAction={{
          label: 'Back',
          icon: <ArrowBackIcon />,
          onClick: () => navigate('/whatsapp'),
        }}
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Recipients Section */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recipients
            </Typography>

            <FormControl component="fieldset" sx={{ mb: 2 }}>
              <RadioGroup
                row
                value={recipientType}
                onChange={(e) => {
                  setRecipientType(e.target.value as 'CLASS' | 'INDIVIDUAL');
                  setRecipients([]);
                }}
              >
                <FormControlLabel value="CLASS" control={<Radio />} label="By Class" />
                <FormControlLabel value="INDIVIDUAL" control={<Radio />} label="Individual" />
              </RadioGroup>
            </FormControl>

            {recipientType === 'CLASS' && (
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Select Class</InputLabel>
                <Select
                  value={classId}
                  label="Select Class"
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setRecipients([]);
                  }}
                >
                  {classes.map((cls) => (
                    <MenuItem key={cls.classId} value={cls.classId}>
                      {cls.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Button
              variant="outlined"
              onClick={handlePreviewRecipients}
              disabled={isResolving || (recipientType === 'CLASS' && !classId)}
              startIcon={isResolving ? <CircularProgress size={16} /> : undefined}
            >
              Preview Recipients
            </Button>

            {recipients.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {recipients.length} recipient(s) found
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Phone</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recipients.map((r) => (
                      <TableRow key={r.parentId}>
                        <TableCell>{r.parentName}</TableCell>
                        <TableCell>{r.phone}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Message Section */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Message
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={6}
              placeholder="Type your message here..."
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value.slice(0, 4096))}
              helperText={`${messageBody.length}/4096`}
              sx={{ mb: 2 }}
            />

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={isUploading ? <CircularProgress size={16} /> : <AttachFileIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                Attach File
              </Button>

              {mediaFileName && (
                <Chip
                  label={mediaFileName}
                  onDelete={handleRemoveMedia}
                  deleteIcon={<DeleteIcon />}
                  variant="outlined"
                  size="small"
                />
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Send Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={isSending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            onClick={handleSend}
            disabled={isSendDisabled}
            sx={{
              bgcolor: '#D4A843',
              '&:hover': { bgcolor: '#B8860B' },
            }}
          >
            Send Message
          </Button>
        </Box>
      </motion.div>
    </Box>
  );
};

export default WhatsAppComposePage;
