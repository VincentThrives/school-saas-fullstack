package com.saas.school.modules.notification.service;
import com.saas.school.modules.notification.model.Notification;
import com.saas.school.modules.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import java.time.Instant; import java.util.*;
@Slf4j @Service @RequiredArgsConstructor
public class NotificationService {
    private final NotificationRepository notificationRepository;
    private final JavaMailSender mailSender;

    public Notification send(Notification req, String sentBy) {
        req.setNotificationId(UUID.randomUUID().toString());
        req.setCreatedBy(sentBy);
        req.setSentAt(Instant.now());
        req.setReadBy(new ArrayList<>());
        Notification saved = notificationRepository.save(req);
        if (req.getChannel() == Notification.Channel.EMAIL
                || req.getChannel() == Notification.Channel.BOTH) {
            sendEmailAsync(saved);
        }
        return saved;
    }

    public void markRead(String notificationId, String userId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            if (!n.getReadBy().contains(userId)) {
                n.getReadBy().add(userId);
                notificationRepository.save(n);
            }
        });
    }

    public long countUnread(String userId) {
        return notificationRepository.findUnreadByUser(userId).size();
    }

    @Async
    public void sendEmailAsync(Notification n) {
        if (n.getRecipientIds() == null) return;
        // In production: look up emails from user service and send
        log.info("Would send email notification '{}' to {} recipients", n.getTitle(), n.getRecipientIds().size());
    }
}