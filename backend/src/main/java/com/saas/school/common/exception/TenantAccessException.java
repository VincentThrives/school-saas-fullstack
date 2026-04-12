package com.saas.school.common.exception;
public class TenantAccessException extends RuntimeException {
    public TenantAccessException(String message) { super(message); }
}
