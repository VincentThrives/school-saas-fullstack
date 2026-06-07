package com.saas.school.modules.classes.dto;

import com.saas.school.modules.classes.model.Subject;

import java.util.List;

/**
 * Wrapper around {@link Subject} for the create/update endpoint that
 * adds {@code applyToSectionIds} — a list of section IDs in the
 * subject's parent class to auto-attach this subject to.
 *
 * <p>When the request omits the list (or sends an empty list), the
 * controller falls back to "all sections of the class" so the
 * common path (admin creates a subject and wants it in every
 * section) stays one click. When the list is provided, only those
 * sections get the new subject's id pushed into their
 * {@code subjectIds} array.
 *
 * <p>Existing clients that POST a plain Subject body still work —
 * Jackson ignores the {@code applyToSectionIds} field when absent,
 * and the controller treats null as "all sections".
 */
public class CreateSubjectRequest extends Subject {
    private List<String> applyToSectionIds;

    public List<String> getApplyToSectionIds() {
        return applyToSectionIds;
    }

    public void setApplyToSectionIds(List<String> applyToSectionIds) {
        this.applyToSectionIds = applyToSectionIds;
    }
}
