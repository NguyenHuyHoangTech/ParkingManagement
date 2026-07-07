package com.pbms.common.event;

import com.pbms.common.context.AuditContext;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class AuditLogEvent extends ApplicationEvent {
    
    private final AuditContext auditContext;
    private final String oldValue;
    private final String newValue;
    private final String targetEntity;
    private final Long targetId;

    public AuditLogEvent(Object source, AuditContext auditContext, String targetEntity, Long targetId, String oldValue, String newValue) {
        super(source);
        this.auditContext = auditContext;
        this.targetEntity = targetEntity;
        this.targetId = targetId;
        this.oldValue = oldValue;
        this.newValue = newValue;
    }
}
