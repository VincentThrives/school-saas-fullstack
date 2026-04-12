package com.saas.school.common.exception;
public class AccountLockedException extends RuntimeException {
    public AccountLockedException(String message) { super(message); }
}
