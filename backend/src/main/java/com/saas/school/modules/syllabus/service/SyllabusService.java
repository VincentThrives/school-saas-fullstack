package com.saas.school.modules.syllabus.service;

import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.classes.model.SchoolClass;
import com.saas.school.modules.classes.repository.SchoolClassRepository;
import com.saas.school.modules.syllabus.dto.CreateSyllabusRequest;
import com.saas.school.modules.syllabus.dto.UpdateTopicRequest;
import com.saas.school.modules.syllabus.model.Syllabus;
import com.saas.school.modules.syllabus.repository.SyllabusRepository;
import com.saas.school.modules.teacher.model.Teacher;
import com.saas.school.modules.teacher.repository.TeacherRepository;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class SyllabusService {

    private static final Logger logger = LoggerFactory.getLogger(SyllabusService.class);

    @Autowired
    private SyllabusRepository syllabusRepository;

    @Autowired
    private SchoolClassRepository schoolClassRepository;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private UserRepository userRepository;

    public Syllabus createSyllabus(CreateSyllabusRequest request, String teacherId, String tenantId) {
        logger.info("Creating syllabus for classId={}, subjectId={}, academicYearId={}",
                request.getClassId(), request.getSubjectId(), request.getAcademicYearId());

        Syllabus syllabus = new Syllabus();
        syllabus.setTenantId(tenantId);
        syllabus.setClassId(request.getClassId());
        syllabus.setSubjectId(request.getSubjectId());
        syllabus.setSubjectName(request.getSubjectName());
        syllabus.setAcademicYearId(request.getAcademicYearId());

        // Resolve class name
        if (request.getClassId() != null) {
            SchoolClass schoolClass = schoolClassRepository.findById(request.getClassId()).orElse(null);
            if (schoolClass != null) {
                syllabus.setClassName(schoolClass.getName());
            }
        }

        // Resolve teacher info
        if (teacherId != null) {
            syllabus.setTeacherId(teacherId);
            Teacher teacher = teacherRepository.findByTeacherIdAndDeletedAtIsNull(teacherId).orElse(null);
            if (teacher != null) {
                User user = userRepository.findById(teacher.getUserId()).orElse(null);
                if (user != null) {
                    syllabus.setTeacherName(user.getFirstName() + " " + user.getLastName());
                }
            }
        }

        // Convert topic requests to topics
        List<Syllabus.Topic> topics = new ArrayList<>();
        if (request.getTopics() != null) {
            for (CreateSyllabusRequest.TopicRequest tr : request.getTopics()) {
                Syllabus.Topic topic = new Syllabus.Topic();
                topic.setTopicName(tr.getTopicName());
                topic.setDescription(tr.getDescription());
                topic.setPlannedDate(tr.getPlannedDate());
                topic.setStatus(Syllabus.TopicStatus.PENDING);
                topic.setCompletionPercentage(0);
                topics.add(topic);
            }
        }
        syllabus.setTopics(topics);
        syllabus.setTotalTopics(topics.size());
        syllabus.setCompletedTopics(0);
        syllabus.setOverallProgress(0.0);

        Syllabus saved = syllabusRepository.save(syllabus);
        logger.info("Syllabus created with id={}", saved.getId());
        return saved;
    }

    public Syllabus getSyllabusById(String syllabusId) {
        return syllabusRepository.findById(syllabusId)
                .orElseThrow(() -> new ResourceNotFoundException("Syllabus not found with id: " + syllabusId));
    }

    public List<Syllabus> getSyllabiByClassAndYear(String classId, String academicYearId) {
        logger.info("Fetching syllabi for classId={}, academicYearId={}", classId, academicYearId);
        return syllabusRepository.findByClassIdAndAcademicYearId(classId, academicYearId);
    }

    public Syllabus updateSyllabus(String syllabusId, CreateSyllabusRequest request) {
        logger.info("Updating syllabus id={}", syllabusId);

        Syllabus syllabus = syllabusRepository.findById(syllabusId)
                .orElseThrow(() -> new ResourceNotFoundException("Syllabus not found with id: " + syllabusId));

        if (request.getSubjectName() != null) {
            syllabus.setSubjectName(request.getSubjectName());
        }

        if (request.getTopics() != null) {
            List<Syllabus.Topic> topics = new ArrayList<>();
            for (CreateSyllabusRequest.TopicRequest tr : request.getTopics()) {
                Syllabus.Topic topic = new Syllabus.Topic();
                topic.setTopicName(tr.getTopicName());
                topic.setDescription(tr.getDescription());
                topic.setPlannedDate(tr.getPlannedDate());
                topic.setStatus(Syllabus.TopicStatus.PENDING);
                topic.setCompletionPercentage(0);
                topics.add(topic);
            }
            syllabus.setTopics(topics);
            syllabus.setTotalTopics(topics.size());
            recalculateProgress(syllabus);
        }

        Syllabus saved = syllabusRepository.save(syllabus);
        logger.info("Syllabus updated id={}", saved.getId());
        return saved;
    }

    public Syllabus updateTopicStatus(String syllabusId, UpdateTopicRequest request) {
        logger.info("Updating topic status for syllabusId={}, topicIndex={}", syllabusId, request.getTopicIndex());

        Syllabus syllabus = syllabusRepository.findById(syllabusId)
                .orElseThrow(() -> new ResourceNotFoundException("Syllabus not found with id: " + syllabusId));

        List<Syllabus.Topic> topics = syllabus.getTopics();
        if (topics == null || request.getTopicIndex() < 0 || request.getTopicIndex() >= topics.size()) {
            throw new IllegalArgumentException("Invalid topic index: " + request.getTopicIndex());
        }

        Syllabus.Topic topic = topics.get(request.getTopicIndex());

        if (request.getStatus() != null) {
            topic.setStatus(Syllabus.TopicStatus.valueOf(request.getStatus().toUpperCase()));
        }
        topic.setCompletionPercentage(request.getCompletionPercentage());
        if (request.getCompletedDate() != null) {
            topic.setCompletedDate(request.getCompletedDate());
        }

        // If completion percentage is 100, auto-set status to COMPLETED
        if (request.getCompletionPercentage() >= 100) {
            topic.setStatus(Syllabus.TopicStatus.COMPLETED);
        }

        recalculateProgress(syllabus);

        Syllabus saved = syllabusRepository.save(syllabus);
        logger.info("Topic status updated for syllabusId={}, topicIndex={}", syllabusId, request.getTopicIndex());
        return saved;
    }

    public void deleteSyllabus(String syllabusId) {
        logger.info("Deleting syllabus id={}", syllabusId);
        if (!syllabusRepository.existsById(syllabusId)) {
            throw new ResourceNotFoundException("Syllabus not found with id: " + syllabusId);
        }
        syllabusRepository.deleteById(syllabusId);
        logger.info("Syllabus deleted id={}", syllabusId);
    }

    private void recalculateProgress(Syllabus syllabus) {
        List<Syllabus.Topic> topics = syllabus.getTopics();
        if (topics == null || topics.isEmpty()) {
            syllabus.setCompletedTopics(0);
            syllabus.setOverallProgress(0.0);
            return;
        }

        int completed = 0;
        double totalProgress = 0;

        for (Syllabus.Topic topic : topics) {
            if (topic.getStatus() == Syllabus.TopicStatus.COMPLETED) {
                completed++;
            }
            totalProgress += topic.getCompletionPercentage();
        }

        syllabus.setCompletedTopics(completed);
        syllabus.setTotalTopics(topics.size());
        double overall = totalProgress / topics.size();
        syllabus.setOverallProgress(Math.round(overall * 100.0) / 100.0);
    }
}
