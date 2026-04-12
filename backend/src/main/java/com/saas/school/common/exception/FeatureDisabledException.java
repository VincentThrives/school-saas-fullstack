package com.saas.school.common.exception;

public class FeatureDisabledException extends RuntimeException {
    private final String featureKey;

    public FeatureDisabledException(String featureKey) {
        super("Feature disabled: " + featureKey);
        this.featureKey = featureKey;
    }

    public String getFeatureKey() {
        return featureKey;
    }
}
