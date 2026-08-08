package com.saas.school.modules.biometric.service;

import com.saas.school.common.exception.BusinessException;
import com.saas.school.common.exception.ResourceNotFoundException;
import com.saas.school.modules.biometric.dto.FaceEnrollmentRequest;
import com.saas.school.modules.biometric.model.StudentBiometric;
import com.saas.school.modules.biometric.repository.StudentBiometricRepository;
import com.saas.school.modules.student.model.Student;
import com.saas.school.modules.student.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Enrollment surface for admins — mapping a card UID to a student, and
 * saving a face photo + embedding for a student. Both are toggle-safe:
 * the admin can re-enrol or clear either at any time.
 */
@Service
public class BiometricEnrollmentService {

    @Autowired private StudentRepository studentRepository;
    @Autowired private StudentBiometricRepository biometricRepository;

    // ── Card ────────────────────────────────────────────────

    public Student setCardUid(String studentId, String cardUid) {
        Student s = requireStudent(studentId);
        String uid = cardUid == null ? null : cardUid.trim();
        if (uid != null && uid.isEmpty()) uid = null;
        s.setCardUid(uid);
        return studentRepository.save(s);
    }

    // ── Face ────────────────────────────────────────────────

    public StudentBiometric enrollFace(String studentId, FaceEnrollmentRequest req, String userId) {
        Student s = requireStudent(studentId);
        if (req == null || req.getPhotoBase64() == null || req.getPhotoBase64().isBlank()) {
            throw new BusinessException("Photo is required.");
        }

        // Multi-shot is the preferred path; fall back to the single
        // embedding for older client versions that haven't updated yet.
        List<List<Double>> shots = req.getFaceEmbeddings();
        List<Double> single = req.getFaceEmbedding();

        boolean multiOk = shots != null && !shots.isEmpty()
                && shots.stream().allMatch(v -> v != null && v.size() >= 64);
        boolean singleOk = single != null && single.size() >= 64;
        if (!multiOk && !singleOk) {
            throw new BusinessException(
                    "Face embedding is missing — the client must capture at least one clear face.");
        }

        String photo = stripDataUrlPrefix(req.getPhotoBase64());
        if (photo.length() > 300_000) {  // ~220 KB decoded
            throw new BusinessException("Photo is too large. Please use a smaller image.");
        }

        StudentBiometric bio = biometricRepository.findByStudentId(s.getStudentId())
                .orElseGet(StudentBiometric::new);
        bio.setStudentId(s.getStudentId());
        bio.setPhotoBase64(photo);
        if (multiOk) {
            bio.setFaceEmbeddings(shots);
            // Keep the legacy single field synced to shots[0] so older
            // roster readers still resolve a usable embedding.
            bio.setFaceEmbedding(shots.get(0));
        } else {
            bio.setFaceEmbeddings(java.util.List.of(single));
            bio.setFaceEmbedding(single);
        }
        bio.setEnrolledBy(userId);
        return biometricRepository.save(bio);
    }

    public void clearFace(String studentId) {
        biometricRepository.findByStudentId(studentId)
                .ifPresent(biometricRepository::delete);
    }

    public StudentBiometric getFace(String studentId) {
        return biometricRepository.findByStudentId(studentId).orElse(null);
    }

    public List<StudentBiometric> getFacesFor(List<String> studentIds) {
        if (studentIds == null || studentIds.isEmpty()) return List.of();
        return biometricRepository.findByStudentIdIn(studentIds);
    }

    /** IDs of all students in this tenant with a face enrolled — used
     *  by the admin enrolment table to show a "Face ✓" chip per row
     *  without fetching each student's photo blob. */
    public java.util.Set<String> faceEnrolledIds() {
        java.util.Set<String> out = new java.util.HashSet<>();
        for (StudentBiometric b : biometricRepository.findAll()) {
            // Only count multi-shot enrolments. Legacy single-embedding
            // records may be pre-face-api stubs that the kiosk now
            // ignores — showing them as "Enrolled" would be misleading.
            if (b.getFaceEmbeddings() != null && !b.getFaceEmbeddings().isEmpty()) {
                out.add(b.getStudentId());
            }
        }
        return out;
    }

    // ── Helpers ─────────────────────────────────────────────

    private Student requireStudent(String studentId) {
        return studentRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student", studentId));
    }

    private String stripDataUrlPrefix(String s) {
        int comma = s.indexOf(',');
        if (comma >= 0 && s.startsWith("data:")) return s.substring(comma + 1);
        return s;
    }
}
