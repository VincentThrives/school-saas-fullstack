package com.saas.school.config;

import com.saas.school.config.mongodb.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("TenantContext ThreadLocal isolation tests")
class TenantContextTest {

    @AfterEach
    void cleanup() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("Setting tenantId is readable on the same thread")
    void setAndGet_sameThread_returnsValue() {
        TenantContext.setTenantId("tenant-abc");
        assertThat(TenantContext.getTenantId()).isEqualTo("tenant-abc");
    }

    @Test
    @DisplayName("Clearing context removes tenantId")
    void clear_removesValue() {
        TenantContext.setTenantId("tenant-abc");
        TenantContext.clear();
        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    @DisplayName("Different threads have isolated tenant contexts")
    void differentThreads_haveIsolatedContext() throws InterruptedException {
        TenantContext.setTenantId("tenant-main");

        String[] threadTenantId = {null};
        Thread t = new Thread(() -> {
            // Child thread should NOT inherit parent's tenant (InheritableThreadLocal would, but we clear anyway)
            TenantContext.setTenantId("tenant-child");
            threadTenantId[0] = TenantContext.getTenantId();
            TenantContext.clear();
        });
        t.start();
        t.join();

        // Main thread context must be unaffected by child
        assertThat(TenantContext.getTenantId()).isEqualTo("tenant-main");
        assertThat(threadTenantId[0]).isEqualTo("tenant-child");
    }

    @Test
    @DisplayName("hasTenant returns false when no tenant is set")
    void hasTenant_whenNotSet_returnsFalse() {
        assertThat(TenantContext.hasTenant()).isFalse();
    }

    @Test
    @DisplayName("hasTenant returns true when tenant is set")
    void hasTenant_whenSet_returnsTrue() {
        TenantContext.setTenantId("tenant-xyz");
        assertThat(TenantContext.hasTenant()).isTrue();
    }
}
