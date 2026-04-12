package com.saas.school.modules.whatsapp.service;

import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.user.repository.UserRepository;
import com.saas.school.modules.whatsapp.dto.RecipientInfo;
import com.saas.school.modules.whatsapp.dto.SendWhatsAppRequest;
import com.saas.school.modules.whatsapp.model.WhatsAppMessage;
import com.saas.school.modules.whatsapp.repository.WhatsAppMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class WhatsAppService {

    private static final Logger logger = LoggerFactory.getLogger(WhatsAppService.class);

    @Autowired
    private WhatsAppMessageRepository whatsAppMessageRepository;

    @Autowired
    private WhatsAppApiClient whatsAppApiClient;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SchoolClassRepository schoolClassRepository;

    public List<RecipientInfo> resolveRecipients(String recipientType, String classId, List<String> parentIds) {
        List<String> allParentIds = new ArrayList<>();

        if ("CLASS".equalsIgnoreCase(recipientType)) {
            var students = studentRepository.findByClassIdAndDeletedAtIsNull(classId, Pageable.unpaged()).getContent();
            var parentIdSet = new HashSet<String>();
            for (var student : students) {
                if (student.getParentIds() != null) {
                    parentIdSet.addAll(student.getParentIds());
                }
            }
            allParentIds.addAll(parentIdSet);
        } else {
            if (parentIds != null) {
                allParentIds.addAll(new HashSet<>(parentIds));
            }
        }

        var users = userRepository.findAllById(allParentIds);
        return users.stream()
                .filter(user -> user.getPhone() != null && !user.getPhone().isBlank())
                .map(user -> new RecipientInfo(user.getId(), user.getName(), user.getPhone()))
                .collect(Collectors.toList());
    }

    public WhatsAppMessage sendBulkMessage(SendWhatsAppRequest request, String sentByUserId) {
        List<RecipientInfo> recipientInfos = resolveRecipients(
                request.getRecipientType(), request.getClassId(), request.getParentIds());

        WhatsAppMessage message = new WhatsAppMessage();
        message.setMessageId(UUID.randomUUID().toString());
        message.setSentBy(sentByUserId);
        message.setRecipientType(WhatsAppMessage.RecipientType.valueOf(request.getRecipientType().toUpperCase()));
        message.setClassId(request.getClassId());
        message.setMessageBody(request.getMessageBody());

        if (request.getMediaUrl() != null && !request.getMediaUrl().isBlank()) {
            if (request.getMediaMimeType() != null && request.getMediaMimeType().startsWith("image/")) {
                message.setContentType(WhatsAppMessage.ContentType.IMAGE);
            } else {
                message.setContentType(WhatsAppMessage.ContentType.DOCUMENT);
            }
            message.setMediaUrl(request.getMediaUrl());
            message.setMediaFileName(request.getMediaFileName());
            message.setMediaMimeType(request.getMediaMimeType());
        } else {
            message.setContentType(WhatsAppMessage.ContentType.TEXT);
        }

        if ("CLASS".equalsIgnoreCase(request.getRecipientType()) && request.getClassId() != null) {
            try {
                schoolClassRepository.findById(request.getClassId()).ifPresent(
                        schoolClass -> message.setClassName(schoolClass.getName()));
            } catch (Exception e) {
                logger.warn("Could not resolve class name for classId {}: {}", request.getClassId(), e.getMessage());
            }
        }

        List<String> resolvedParentIds = recipientInfos.stream()
                .map(RecipientInfo::getParentId)
                .collect(Collectors.toList());
        message.setParentIds(resolvedParentIds);

        List<WhatsAppMessage.RecipientDetail> recipients = recipientInfos.stream()
                .map(info -> {
                    WhatsAppMessage.RecipientDetail detail = new WhatsAppMessage.RecipientDetail();
                    detail.setParentId(info.getParentId());
                    detail.setParentName(info.getParentName());
                    detail.setPhone(info.getPhone());
                    detail.setDeliveryStatus(WhatsAppMessage.DeliveryStatus.PENDING);
                    return detail;
                })
                .collect(Collectors.toList());
        message.setRecipients(recipients);

        message.setTotalRecipients(recipients.size());
        message.setStatus(WhatsAppMessage.MessageStatus.QUEUED);

        whatsAppMessageRepository.save(message);

        processBulkSendAsync(message);

        return message;
    }

    @Async
    public void processBulkSendAsync(WhatsAppMessage message) {
        message.setStatus(WhatsAppMessage.MessageStatus.PROCESSING);
        whatsAppMessageRepository.save(message);

        int success = 0;
        int fail = 0;

        for (WhatsAppMessage.RecipientDetail recipient : message.getRecipients()) {
            try {
                String msgId;
                if (message.getContentType() == WhatsAppMessage.ContentType.TEXT) {
                    msgId = whatsAppApiClient.sendTextMessage(recipient.getPhone(), message.getMessageBody());
                } else {
                    msgId = whatsAppApiClient.sendMediaMessage(
                            recipient.getPhone(),
                            message.getMediaUrl(),
                            message.getMediaMimeType(),
                            message.getMediaFileName(),
                            message.getMessageBody());
                }
                recipient.setDeliveryStatus(WhatsAppMessage.DeliveryStatus.SENT);
                recipient.setWhatsappMessageId(msgId);
                success++;
            } catch (Exception e) {
                recipient.setDeliveryStatus(WhatsAppMessage.DeliveryStatus.FAILED);
                recipient.setErrorMessage(e.getMessage());
                fail++;
                logger.error("Failed to send WhatsApp message to {}: {}", recipient.getPhone(), e.getMessage());
            }

            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }

        message.setSuccessCount(success);
        message.setFailureCount(fail);

        if (fail == 0) {
            message.setStatus(WhatsAppMessage.MessageStatus.COMPLETED);
        } else if (success == 0) {
            message.setStatus(WhatsAppMessage.MessageStatus.FAILED);
        } else {
            message.setStatus(WhatsAppMessage.MessageStatus.PARTIALLY_FAILED);
        }

        message.setCompletedAt(Instant.now());
        whatsAppMessageRepository.save(message);
    }

    public Page<WhatsAppMessage> getMessages(Pageable pageable) {
        return whatsAppMessageRepository.findAllByOrderByCreatedAtDesc(pageable);
    }

    public WhatsAppMessage getMessageById(String messageId) {
        return whatsAppMessageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("WhatsApp message not found"));
    }
}
