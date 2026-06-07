package com.saas.school.modules.classes.dto;

import com.saas.school.modules.classes.model.Subject;

import java.util.List;

/**
 * Wrapper around {@link Subject} for the create / update endpoint.
 *
 * <p>The new field that drives multi-class subjects is
 * {@link Subject#getAssignments()} — a list of {@code (classId,
 * sectionIds)} entries. Sending {@code assignments: [{...}, {...}]}
 * creates ONE Subject document attached to multiple classes (each with
 * its own picked sections).
 *
 * <p>Older clients that POST {@code classId} + {@code
 * applyToSectionIds} keep working — {@code ClassController}
 * normalises those into a single-entry assignments array before
 * persisting.
 */
public class CreateSubjectRequest extends Subject {
    /** Legacy single-class shape — folded into a one-entry assignments array. */
    private List<String> applyToSectionIds;

    public List<String> getApplyToSectionIds() {
        return applyToSectionIds;
    }

    public void setApplyToSectionIds(List<String> applyToSectionIds) {
        this.applyToSectionIds = applyToSectionIds;
    }
}
