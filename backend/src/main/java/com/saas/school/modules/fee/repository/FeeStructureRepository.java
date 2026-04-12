package com.saas.school.modules.fee.repository;
import com.saas.school.modules.fee.model.FeeStructure;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
public interface FeeStructureRepository extends MongoRepository<FeeStructure, String> {
    List<FeeStructure> findByAcademicYearIdAndClassId(String ay, String classId);
    List<FeeStructure> findByAcademicYearId(String ay);
}