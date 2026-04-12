package com.saas.school.common.exception;
import lombok.Getter;
@Getter
public class FeatureDisabledException extends RuntimeException {
    private final String featureKey;
    public FeatureDisabledException(String featureKey) {
        super("Feature disabled: " + featureKey);
        this.featureKey = featureKey;
    }
}
