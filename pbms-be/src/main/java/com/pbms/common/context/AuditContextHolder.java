package com.pbms.common.context;

public class AuditContextHolder {
    private static final ThreadLocal<AuditContext> contextHolder = new ThreadLocal<>();

    public static void setContext(AuditContext context) {
        contextHolder.set(context);
    }

    public static AuditContext getContext() {
        return contextHolder.get();
    }

    public static void clearContext() {
        contextHolder.remove();
    }
}
