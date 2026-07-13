package com.saas.school.modules.homework.dto;

import com.saas.school.modules.homework.model.HomeworkCompletion.Status;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class BatchSaveRequest {

    @NotEmpty(message = "entries must not be empty")
    private List<@NotNull EntryDto> entries;

    /** When true, after saving the roster the backend also sends a
     *  reminder notification to every student still marked PENDING
     *  (HALF-done students are NOT reminded — they've made an effort). */
    private boolean notifyUndone;

    public List<EntryDto> getEntries() { return entries; }
    public void setEntries(List<EntryDto> entries) { this.entries = entries; }

    public boolean isNotifyUndone() { return notifyUndone; }
    public void setNotifyUndone(boolean notifyUndone) { this.notifyUndone = notifyUndone; }

    public static class EntryDto {
        private String studentId;
        private Status status;
        private String remark;

        public String getStudentId() { return studentId; }
        public void setStudentId(String studentId) { this.studentId = studentId; }

        public Status getStatus() { return status; }
        public void setStatus(Status status) { this.status = status; }

        public String getRemark() { return remark; }
        public void setRemark(String remark) { this.remark = remark; }
    }
}
