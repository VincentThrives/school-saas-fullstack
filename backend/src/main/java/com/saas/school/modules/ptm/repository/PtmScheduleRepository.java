package com.saas.school.modules.ptm.repository;

import com.saas.school.modules.ptm.model.PtmSchedule;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PtmScheduleRepository extends MongoRepository<PtmSchedule, String> {

    List<PtmSchedule> findByTenantId(String tenantId);

    List<PtmSchedule> findByStatus(PtmSchedule.PtmStatus status);
}
