package com.saas.school.modules.ptm.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.ptm.dto.CreatePtmRequest;
import com.saas.school.modules.ptm.model.PtmSchedule;
import com.saas.school.modules.ptm.model.PtmSlot;
import com.saas.school.modules.ptm.repository.PtmScheduleRepository;
import com.saas.school.modules.ptm.repository.PtmSlotRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class PtmService {

    private static final Logger logger = LoggerFactory.getLogger(PtmService.class);
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");

    @Autowired
    private PtmScheduleRepository scheduleRepository;

    @Autowired
    private PtmSlotRepository slotRepository;

    public PtmSchedule createSchedule(CreatePtmRequest req, String adminId) {
        PtmSchedule schedule = new PtmSchedule();
        schedule.setId(UUID.randomUUID().toString());
        schedule.setTitle(req.getTitle());
        schedule.setDate(req.getDate());
        schedule.setStartTime(req.getStartTime());
        schedule.setEndTime(req.getEndTime());
        schedule.setSlotDurationMinutes(req.getSlotDurationMinutes());
        schedule.setLocation(req.getLocation());
        schedule.setDescription(req.getDescription());
        schedule.setTeacherIds(req.getTeacherIds());
        schedule.setStatus(PtmSchedule.PtmStatus.DRAFT);
        schedule.setCreatedBy(adminId);
        schedule.setBookedSlots(0);

        // Auto-generate time slots for each teacher
        List<PtmSlot> allSlots = new ArrayList<>();
        LocalTime start = LocalTime.parse(req.getStartTime(), TIME_FORMAT);
        LocalTime end = LocalTime.parse(req.getEndTime(), TIME_FORMAT);

        for (String teacherId : req.getTeacherIds()) {
            LocalTime slotStart = start;
            while (slotStart.plusMinutes(req.getSlotDurationMinutes()).compareTo(end) <= 0) {
                LocalTime slotEnd = slotStart.plusMinutes(req.getSlotDurationMinutes());

                PtmSlot slot = new PtmSlot();
                slot.setId(UUID.randomUUID().toString());
                slot.setPtmScheduleId(schedule.getId());
                slot.setTeacherId(teacherId);
                slot.setStartTime(slotStart.format(TIME_FORMAT));
                slot.setEndTime(slotEnd.format(TIME_FORMAT));
                slot.setStatus(PtmSlot.SlotStatus.AVAILABLE);
                allSlots.add(slot);

                slotStart = slotEnd;
            }
        }

        schedule.setTotalSlots(allSlots.size());
        PtmSchedule saved = scheduleRepository.save(schedule);
        slotRepository.saveAll(allSlots);

        logger.info("Created PTM schedule '{}' with {} slots for {} teachers",
                req.getTitle(), allSlots.size(), req.getTeacherIds().size());
        return saved;
    }

    public PtmSchedule publishSchedule(String scheduleId) {
        PtmSchedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new ResourceNotFoundException("PtmSchedule", scheduleId));

        if (schedule.getStatus() != PtmSchedule.PtmStatus.DRAFT) {
            throw new BusinessException("Only DRAFT schedules can be published");
        }

        schedule.setStatus(PtmSchedule.PtmStatus.PUBLISHED);
        logger.info("Publishing PTM schedule {}", scheduleId);
        return scheduleRepository.save(schedule);
    }

    public PtmSlot bookSlot(String slotId, String parentId, String parentName,
                             String studentId, String studentName) {
        PtmSlot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException("PtmSlot", slotId));

        if (slot.getStatus() != PtmSlot.SlotStatus.AVAILABLE) {
            throw new BusinessException("Slot is not available for booking");
        }

        slot.setParentId(parentId);
        slot.setParentName(parentName);
        slot.setStudentId(studentId);
        slot.setStudentName(studentName);
        slot.setStatus(PtmSlot.SlotStatus.BOOKED);
        slot.setBookedAt(java.time.Instant.now());

        PtmSlot saved = slotRepository.save(slot);

        // Update booked count on schedule
        scheduleRepository.findById(slot.getPtmScheduleId()).ifPresent(schedule -> {
            schedule.setBookedSlots(schedule.getBookedSlots() + 1);
            scheduleRepository.save(schedule);
        });

        logger.info("Slot {} booked by parent {} for student {}", slotId, parentId, studentId);
        return saved;
    }

    public PtmSlot cancelSlot(String slotId, String parentId) {
        PtmSlot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new ResourceNotFoundException("PtmSlot", slotId));

        if (slot.getStatus() != PtmSlot.SlotStatus.BOOKED) {
            throw new BusinessException("Only booked slots can be cancelled");
        }

        if (!parentId.equals(slot.getParentId())) {
            throw new BusinessException("You can only cancel your own bookings");
        }

        slot.setParentId(null);
        slot.setParentName(null);
        slot.setStudentId(null);
        slot.setStudentName(null);
        slot.setStatus(PtmSlot.SlotStatus.AVAILABLE);
        slot.setBookedAt(null);

        PtmSlot saved = slotRepository.save(slot);

        // Update booked count on schedule
        scheduleRepository.findById(slot.getPtmScheduleId()).ifPresent(schedule -> {
            schedule.setBookedSlots(Math.max(0, schedule.getBookedSlots() - 1));
            scheduleRepository.save(schedule);
        });

        logger.info("Slot {} cancelled by parent {}", slotId, parentId);
        return saved;
    }

    public List<PtmSchedule> getSchedules() {
        return scheduleRepository.findAll();
    }

    public List<PtmSlot> getAvailableSlots(String scheduleId, String teacherId) {
        if (teacherId != null) {
            return slotRepository.findByPtmScheduleIdAndTeacherId(scheduleId, teacherId);
        }
        return slotRepository.findByPtmScheduleIdAndStatus(scheduleId, PtmSlot.SlotStatus.AVAILABLE);
    }

    public List<PtmSlot> getTeacherSchedule(String teacherId) {
        return slotRepository.findByTeacherIdAndStatus(teacherId, PtmSlot.SlotStatus.BOOKED);
    }

    public List<PtmSlot> getParentBookings(String parentId) {
        return slotRepository.findByParentId(parentId);
    }
}
