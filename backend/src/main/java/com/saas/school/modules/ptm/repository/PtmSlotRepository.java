package com.saas.school.modules.ptm.repository;

import com.saas.school.modules.ptm.model.PtmSlot;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PtmSlotRepository extends MongoRepository<PtmSlot, String> {

    List<PtmSlot> findByPtmScheduleIdAndTeacherId(String ptmScheduleId, String teacherId);

    List<PtmSlot> findByParentId(String parentId);

    List<PtmSlot> findByPtmScheduleIdAndStatus(String ptmScheduleId, PtmSlot.SlotStatus status);

    List<PtmSlot> findByTeacherIdAndStatus(String teacherId, PtmSlot.SlotStatus status);
}
