package com.saas.school.modules.analytics.service;

import com.saas.school.modules.analytics.dto.ClassRankingDto;
import com.saas.school.modules.analytics.dto.PerformanceTrendDto;
import com.saas.school.modules.analytics.dto.SubjectAnalysisDto;
import com.saas.school.modules.exam.model.Exam;
import com.saas.school.modules.exam.model.ExamMark;
import com.saas.school.modules.exam.repository.ExamMarkRepository;
import com.saas.school.modules.exam.repository.ExamRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import com.saas.school.modules.user.model.User;
import com.saas.school.modules.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class PerformanceAnalyticsService {

    private static final Logger logger = LoggerFactory.getLogger(PerformanceAnalyticsService.class);

    @Autowired
    private ExamRepository examRepository;

    @Autowired
    private ExamMarkRepository examMarkRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private UserRepository userRepository;

    public List<PerformanceTrendDto> getStudentTrend(String studentId) {
        logger.info("Fetching performance trend for student {}", studentId);

        List<ExamMark> studentMarks = examMarkRepository.findByStudentId(studentId);
        if (studentMarks.isEmpty()) {
            return Collections.emptyList();
        }

        List<String> examIds = studentMarks.stream()
                .map(ExamMark::getExamId)
                .collect(Collectors.toList());

        Map<String, Exam> examMap = new HashMap<>();
        for (String examId : examIds) {
            examRepository.findById(examId).ifPresent(e -> examMap.put(e.getExamId(), e));
        }

        List<PerformanceTrendDto> trends = new ArrayList<>();
        for (ExamMark mark : studentMarks) {
            Exam exam = examMap.get(mark.getExamId());
            if (exam == null) continue;

            // Compute class average for this exam
            List<ExamMark> allMarksForExam = examMarkRepository.findByExamId(exam.getExamId());
            double classAvg = allMarksForExam.stream()
                    .mapToDouble(m -> m.getMarksObtained() != null ? m.getMarksObtained() : 0)
                    .average()
                    .orElse(0);

            double obtained = mark.getMarksObtained() != null ? mark.getMarksObtained() : 0;
            double maxMarks = exam.getMaxMarks();
            double percentage = maxMarks > 0 ? (obtained / maxMarks) * 100 : 0;
            double classAvgPct = maxMarks > 0 ? (classAvg / maxMarks) * 100 : 0;

            PerformanceTrendDto dto = new PerformanceTrendDto();
            dto.setExamName(exam.getName());
            dto.setExamDate(exam.getExamDate() != null ? exam.getExamDate().toString() : "");
            dto.setMarksObtained(obtained);
            dto.setMaxMarks(maxMarks);
            dto.setPercentage(Math.round(percentage * 100.0) / 100.0);
            dto.setClassAverage(Math.round(classAvgPct * 100.0) / 100.0);
            trends.add(dto);
        }

        // Sort by exam date
        trends.sort(Comparator.comparing(PerformanceTrendDto::getExamDate));
        return trends;
    }

    public List<ClassRankingDto> getClassRankings(String classId, String examId) {
        logger.info("Fetching class rankings for class {} exam {}", classId, examId);

        // Build student info map
        List<Student> students = studentRepository.findByClassIdAndDeletedAtIsNull(classId,
                org.springframework.data.domain.PageRequest.of(0, 1000)).getContent();
        Map<String, Student> studentMap = students.stream()
                .collect(Collectors.toMap(Student::getStudentId, s -> s, (a, b) -> a));

        // Build user name map
        Map<String, String> userNameMap = new HashMap<>();
        for (Student student : students) {
            userRepository.findByUserIdAndDeletedAtIsNull(student.getUserId())
                    .ifPresent(u -> userNameMap.put(student.getStudentId(),
                            u.getFirstName() + " " + u.getLastName()));
        }

        List<ClassRankingDto> rankings;

        if (examId != null && !examId.isEmpty()) {
            // Single exam ranking
            List<ExamMark> marks = examMarkRepository.findByExamId(examId);
            Exam exam = examRepository.findById(examId).orElse(null);
            double maxMarks = exam != null ? exam.getMaxMarks() : 100;

            rankings = new ArrayList<>();
            for (ExamMark mark : marks) {
                Student student = studentMap.get(mark.getStudentId());
                if (student == null) continue;

                double obtained = mark.getMarksObtained() != null ? mark.getMarksObtained() : 0;
                double pct = maxMarks > 0 ? (obtained / maxMarks) * 100 : 0;

                ClassRankingDto dto = new ClassRankingDto();
                dto.setStudentId(mark.getStudentId());
                dto.setStudentName(userNameMap.getOrDefault(mark.getStudentId(), ""));
                dto.setRollNumber(student.getRollNumber());
                dto.setObtainedMarks(obtained);
                dto.setTotalMarks(maxMarks);
                dto.setMaxMarks(maxMarks);
                dto.setPercentage(Math.round(pct * 100.0) / 100.0);
                rankings.add(dto);
            }
        } else {
            // All exams - aggregate across all exams for this class
            List<Exam> classExams = examRepository.findByClassId(classId);
            if (classExams.isEmpty()) {
                return new ArrayList<>();
            }

            List<String> examIds = classExams.stream().map(Exam::getExamId).collect(Collectors.toList());
            Map<String, Double> examMaxMarksMap = classExams.stream()
                    .collect(Collectors.toMap(Exam::getExamId, e -> (double) e.getMaxMarks(), (a, b) -> a));

            List<ExamMark> allMarks = examMarkRepository.findByExamIdIn(examIds);

            // Aggregate per student: total obtained and total max
            Map<String, Double> studentObtained = new HashMap<>();
            Map<String, Double> studentMaxMarks = new HashMap<>();

            for (ExamMark mark : allMarks) {
                if (!studentMap.containsKey(mark.getStudentId())) continue;
                double obtained = mark.getMarksObtained() != null ? mark.getMarksObtained() : 0;
                double maxM = examMaxMarksMap.getOrDefault(mark.getExamId(), 100.0);

                studentObtained.merge(mark.getStudentId(), obtained, Double::sum);
                studentMaxMarks.merge(mark.getStudentId(), maxM, Double::sum);
            }

            rankings = new ArrayList<>();
            for (Map.Entry<String, Double> entry : studentObtained.entrySet()) {
                String studentId = entry.getKey();
                Student student = studentMap.get(studentId);
                if (student == null) continue;

                double obtained = entry.getValue();
                double maxM = studentMaxMarks.getOrDefault(studentId, 100.0);
                double pct = maxM > 0 ? (obtained / maxM) * 100 : 0;

                ClassRankingDto dto = new ClassRankingDto();
                dto.setStudentId(studentId);
                dto.setStudentName(userNameMap.getOrDefault(studentId, ""));
                dto.setRollNumber(student.getRollNumber());
                dto.setObtainedMarks(obtained);
                dto.setTotalMarks(maxM);
                dto.setMaxMarks(maxM);
                dto.setPercentage(Math.round(pct * 100.0) / 100.0);
                rankings.add(dto);
            }
        }

        // Sort by percentage descending and assign ranks
        rankings.sort(Comparator.comparingDouble(ClassRankingDto::getPercentage).reversed());
        for (int i = 0; i < rankings.size(); i++) {
            rankings.get(i).setRank(i + 1);
        }

        return rankings;
    }

    public List<SubjectAnalysisDto> getSubjectAnalysis(String studentId) {
        logger.info("Fetching subject analysis for student {}", studentId);

        List<ExamMark> studentMarks = examMarkRepository.findByStudentId(studentId);
        if (studentMarks.isEmpty()) {
            return Collections.emptyList();
        }

        // Group marks by subject via exam lookup
        Map<String, List<Double>> subjectMarksMap = new LinkedHashMap<>();
        Map<String, String> subjectNameMap = new HashMap<>();
        Map<String, List<Double>> subjectOrderedMarks = new LinkedHashMap<>();

        for (ExamMark mark : studentMarks) {
            examRepository.findById(mark.getExamId()).ifPresent(exam -> {
                String subjectId = exam.getSubjectId();
                double obtained = mark.getMarksObtained() != null ? mark.getMarksObtained() : 0;
                double pct = exam.getMaxMarks() > 0 ? (obtained / exam.getMaxMarks()) * 100 : 0;

                subjectMarksMap.computeIfAbsent(subjectId, k -> new ArrayList<>()).add(pct);
                subjectNameMap.putIfAbsent(subjectId, subjectId); // Use subjectId as fallback name
                subjectOrderedMarks.computeIfAbsent(subjectId, k -> new ArrayList<>()).add(pct);
            });
        }

        List<SubjectAnalysisDto> results = new ArrayList<>();
        for (Map.Entry<String, List<Double>> entry : subjectMarksMap.entrySet()) {
            List<Double> percentages = entry.getValue();
            DoubleSummaryStatistics stats = percentages.stream()
                    .mapToDouble(Double::doubleValue)
                    .summaryStatistics();

            String trend = determineTrend(subjectOrderedMarks.get(entry.getKey()));

            SubjectAnalysisDto dto = new SubjectAnalysisDto();
            dto.setSubjectName(subjectNameMap.get(entry.getKey()));
            dto.setAverageMarks(Math.round(stats.getAverage() * 100.0) / 100.0);
            dto.setHighestMarks(Math.round(stats.getMax() * 100.0) / 100.0);
            dto.setLowestMarks(Math.round(stats.getMin() * 100.0) / 100.0);
            dto.setExamCount((int) stats.getCount());
            dto.setTrend(trend);
            results.add(dto);
        }

        return results;
    }

    public Map<String, Object> getClassComparison(String academicYearId) {
        logger.info("Fetching class comparison for academic year {}", academicYearId);

        List<Exam> exams = examRepository.findByClassIdAndAcademicYearId(null, academicYearId);
        // Fallback: fetch all exams for the academic year by status
        if (exams.isEmpty()) {
            exams = examRepository.findByAcademicYearIdAndStatus(academicYearId, Exam.ExamStatus.COMPLETED);
        }

        Map<String, List<Double>> classPerformance = new HashMap<>();
        for (Exam exam : exams) {
            List<ExamMark> marks = examMarkRepository.findByExamId(exam.getExamId());
            for (ExamMark mark : marks) {
                double pct = exam.getMaxMarks() > 0
                        ? ((mark.getMarksObtained() != null ? mark.getMarksObtained() : 0) / exam.getMaxMarks()) * 100
                        : 0;
                classPerformance.computeIfAbsent(exam.getClassId(), k -> new ArrayList<>()).add(pct);
            }
        }

        Map<String, Object> comparison = new LinkedHashMap<>();
        for (Map.Entry<String, List<Double>> entry : classPerformance.entrySet()) {
            double avg = entry.getValue().stream().mapToDouble(Double::doubleValue).average().orElse(0);
            comparison.put(entry.getKey(), Math.round(avg * 100.0) / 100.0);
        }

        return comparison;
    }

    public List<ClassRankingDto> getTopPerformers(String classId, int count) {
        logger.info("Fetching top {} performers for class {}", count, classId);

        // Get all students in the class
        List<Student> students = studentRepository.findByClassIdAndDeletedAtIsNull(classId,
                org.springframework.data.domain.PageRequest.of(0, 1000)).getContent();

        Map<String, String> userNameMap = new HashMap<>();
        Map<String, String> rollNumberMap = new HashMap<>();
        for (Student student : students) {
            rollNumberMap.put(student.getStudentId(), student.getRollNumber());
            userRepository.findByUserIdAndDeletedAtIsNull(student.getUserId())
                    .ifPresent(u -> userNameMap.put(student.getStudentId(),
                            u.getFirstName() + " " + u.getLastName()));
        }

        // Aggregate all marks per student
        Map<String, Double> totalMarksMap = new HashMap<>();
        Map<String, Double> maxMarksMap = new HashMap<>();
        for (Student student : students) {
            List<ExamMark> marks = examMarkRepository.findByStudentId(student.getStudentId());
            double total = marks.stream()
                    .mapToDouble(m -> m.getMarksObtained() != null ? m.getMarksObtained() : 0)
                    .sum();
            double maxTotal = 0;
            for (ExamMark mark : marks) {
                Exam exam = examRepository.findById(mark.getExamId()).orElse(null);
                if (exam != null) maxTotal += exam.getMaxMarks();
            }
            totalMarksMap.put(student.getStudentId(), total);
            maxMarksMap.put(student.getStudentId(), maxTotal);
        }

        List<ClassRankingDto> rankings = new ArrayList<>();
        for (Student student : students) {
            double total = totalMarksMap.getOrDefault(student.getStudentId(), 0.0);
            double maxM = maxMarksMap.getOrDefault(student.getStudentId(), 0.0);
            double pct = maxM > 0 ? (total / maxM) * 100 : 0;

            ClassRankingDto dto = new ClassRankingDto();
            dto.setStudentId(student.getStudentId());
            dto.setStudentName(userNameMap.getOrDefault(student.getStudentId(), ""));
            dto.setRollNumber(rollNumberMap.getOrDefault(student.getStudentId(), ""));
            dto.setTotalMarks(total);
            dto.setMaxMarks(maxM);
            dto.setPercentage(Math.round(pct * 100.0) / 100.0);
            rankings.add(dto);
        }

        rankings.sort(Comparator.comparingDouble(ClassRankingDto::getPercentage).reversed());
        int limit = Math.min(count, rankings.size());
        for (int i = 0; i < limit; i++) {
            rankings.get(i).setRank(i + 1);
        }

        return rankings.subList(0, limit);
    }

    private String determineTrend(List<Double> orderedPercentages) {
        if (orderedPercentages == null || orderedPercentages.size() < 2) {
            return "STABLE";
        }
        int improving = 0;
        int declining = 0;
        for (int i = 1; i < orderedPercentages.size(); i++) {
            if (orderedPercentages.get(i) > orderedPercentages.get(i - 1)) {
                improving++;
            } else if (orderedPercentages.get(i) < orderedPercentages.get(i - 1)) {
                declining++;
            }
        }
        if (improving > declining) return "IMPROVING";
        if (declining > improving) return "DECLINING";
        return "STABLE";
    }
}
