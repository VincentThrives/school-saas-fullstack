package com.saas.school.modules.biometric.dto;

import java.util.List;

/** Face enrollment payload sent from the admin's browser after
 *  face-api.js computes an embedding on-page. Photo and embedding come
 *  in the same request; server stores both. */
public class FaceEnrollmentRequest {
    /** JPEG data URL (or bare base64) — server strips prefix. Displayed
     *  as the enrolled thumbnail; typically the best shot of the batch. */
    private String photoBase64;
    /** Legacy single embedding. Ignored when {@link #faceEmbeddings} is
     *  non-empty; kept for backward compat with older clients. */
    private List<Double> faceEmbedding;
    /** Multi-shot enrolment — client captures 3+ frames, each with its
     *  own 128-D descriptor. Kiosk matches against the MAX cosine over
     *  the whole list per student. */
    private List<List<Double>> faceEmbeddings;

    public String getPhotoBase64() { return photoBase64; }
    public void setPhotoBase64(String photoBase64) { this.photoBase64 = photoBase64; }

    public List<Double> getFaceEmbedding() { return faceEmbedding; }
    public void setFaceEmbedding(List<Double> faceEmbedding) { this.faceEmbedding = faceEmbedding; }

    public List<List<Double>> getFaceEmbeddings() { return faceEmbeddings; }
    public void setFaceEmbeddings(List<List<Double>> faceEmbeddings) { this.faceEmbeddings = faceEmbeddings; }
}
