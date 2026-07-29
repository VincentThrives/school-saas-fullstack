package com.saas.school.modules.biometric.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/**
 * Per-student face enrolment record. Kept in a dedicated collection so
 * the hot {@code Student} roster query stays lean, and so the photo
 * payload (base64) doesn't bloat every read of a student.
 *
 * <p>Photos are stored inline as base64 for the phase-1 launch — schools
 * we're targeting have ~500 students, so at ~30 KB per photo that's
 * ~15 MB total, well within Mongo's per-doc limit (one doc per student,
 * not one giant doc). Migration to object storage (R2/S3) later is a
 * straight refactor behind the {@code ImageStorageService} interface;
 * the {@code photoBase64} field becomes {@code photoUrl}.</p>
 */
@Document(collection = "student_biometrics")
public class StudentBiometric {

    @Id
    private String id;

    @Indexed(unique = true)
    private String studentId;

    /** Base64-encoded JPEG. Recommended max ~50 KB after compression on
     *  the client side. Included on the roster bundle handed to the
     *  kiosk each morning so the welcome card can show the face. */
    private String photoBase64;

    /** Face embedding vector (typically 128 floats for FaceNet, 512 for
     *  face-api.js's TinyFaceDescriptor). Not human-readable — the kiosk
     *  compares it against the vector computed live from the camera
     *  frame using cosine similarity. */
    private List<Double> faceEmbedding;

    private String enrolledBy;

    @CreatedDate
    private Instant enrolledAt;

    @LastModifiedDate
    private Instant updatedAt;

    public StudentBiometric() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getPhotoBase64() { return photoBase64; }
    public void setPhotoBase64(String photoBase64) { this.photoBase64 = photoBase64; }

    public List<Double> getFaceEmbedding() { return faceEmbedding; }
    public void setFaceEmbedding(List<Double> faceEmbedding) { this.faceEmbedding = faceEmbedding; }

    public String getEnrolledBy() { return enrolledBy; }
    public void setEnrolledBy(String enrolledBy) { this.enrolledBy = enrolledBy; }

    public Instant getEnrolledAt() { return enrolledAt; }
    public void setEnrolledAt(Instant enrolledAt) { this.enrolledAt = enrolledAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
