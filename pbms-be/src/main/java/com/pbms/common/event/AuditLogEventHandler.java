package com.pbms.common.event;

import com.pbms.common.context.AuditContext;
import com.pbms.modules.system.domain.AuditLog;
import com.pbms.modules.system.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuditLogEventHandler {

    private final AuditLogRepository auditLogRepository;

    @EventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleAuditLogEvent(AuditLogEvent event) {
        try {
            AuditContext context = event.getAuditContext();
            
            // We append the target entity and ID to the resource description for better traceability
            String detailedResource = context.getResource() + " (" + event.getTargetEntity() + " #" + event.getTargetId() + ")";
            
            AuditLog auditLog = AuditLog.builder()
                    .actor(context.getActor())
                    .action(context.getAction())
                    .resource(detailedResource)
                    .description(context.getDescription())
                    .ipAddress(context.getIpAddress())
                    .oldValue(event.getOldValue())
                    .newValue(event.getNewValue())
                    .build();
            
            auditLogRepository.save(auditLog);
            log.info("Saved audit log for entity: {} (ID: {})", event.getTargetEntity(), event.getTargetId());
        } catch (Exception e) {
            log.error("Failed to save audit log from event: {}", e.getMessage(), e);
        }
    }
}

