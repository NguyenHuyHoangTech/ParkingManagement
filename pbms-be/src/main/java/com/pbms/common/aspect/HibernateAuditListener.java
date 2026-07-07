package com.pbms.common.aspect;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pbms.common.context.AuditContext;
import com.pbms.common.context.AuditContextHolder;
import com.pbms.common.event.AuditLogEvent;
import com.pbms.modules.system.domain.AuditLog;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.event.spi.*;
import org.hibernate.persister.entity.EntityPersister;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class HibernateAuditListener implements PostInsertEventListener, PostUpdateEventListener, PostDeleteEventListener {

    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule())
            .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(com.fasterxml.jackson.databind.SerializationFeature.FAIL_ON_EMPTY_BEANS);

    @Override
    public void onPostInsert(PostInsertEvent event) {
        processAudit(event.getEntity(), null, event.getState(), event.getPersister(), "CREATE");
    }

    @Override
    public void onPostUpdate(PostUpdateEvent event) {
        processAudit(event.getEntity(), event.getOldState(), event.getState(), event.getPersister(), "UPDATE");
    }

    @Override
    public void onPostDelete(PostDeleteEvent event) {
        processAudit(event.getEntity(), event.getDeletedState(), null, event.getPersister(), "DELETE");
    }

    @Override
    public boolean requiresPostCommitHandling(EntityPersister persister) {
        return false;
    }
    

    private void processAudit(Object entity, Object[] oldState, Object[] newState, EntityPersister persister, String defaultAction) {
        if (entity instanceof AuditLog) {
            return;
        }
        AuditContext context = AuditContextHolder.getContext();
        
        if (entity instanceof com.pbms.modules.infrastructure.domain.RoutingRule ||
            entity instanceof com.pbms.modules.finance.domain.PricingPolicy ||
            entity instanceof com.pbms.modules.finance.domain.PricingShift ||
            entity instanceof com.pbms.modules.finance.domain.PricingBlock ||
            entity instanceof com.pbms.modules.infrastructure.domain.Floor ||
            entity instanceof com.pbms.modules.infrastructure.domain.Zone ||
            entity instanceof com.pbms.modules.infrastructure.domain.Gate ||
            entity instanceof com.pbms.modules.infrastructure.domain.Slot) {
            return;
        }

        if (entity instanceof com.pbms.modules.infrastructure.domain.RfidCard) {
            if (context != null && "CREATE".equals(context.getAction())) {
                return; // Only skip bulk imports
            }
        }

        if (context == null) {
            return;
        }
        
        context.setDbModified(true);

        try {
            String[] propertyNames = persister.getPropertyNames();
            String oldJson = toJson(oldState, propertyNames);
            String newJson = toJson(newState, propertyNames);

            Long entityId = null;
            try {
                java.lang.reflect.Method getIdMethod = entity.getClass().getMethod("getId");
                entityId = (Long) getIdMethod.invoke(entity);
            } catch (Exception e) {
                // Ignore
            }
            
            String action = context.getAction() != null ? context.getAction() : defaultAction;
            
            AuditContext clonedContext = AuditContext.builder()
                .actor(context.getActor())
                .action(action)
                .resource(context.getResource())
                .description(context.getDescription())
                .ipAddress(context.getIpAddress())
                .build();

            AuditLogEvent auditEvent = new AuditLogEvent(
                    this,
                    clonedContext,
                    entity.getClass().getSimpleName(),
                    entityId,
                    oldJson,
                    newJson
            );

            eventPublisher.publishEvent(auditEvent);

        } catch (Exception e) {
            log.error("Error creating audit log event: {}", e.getMessage(), e);
        }
    }

    private String toJson(Object[] state, String[] propertyNames) {
        if (state == null) return null;
        try {
            Map<String, Object> map = new HashMap<>();
            for (int i = 0; i < state.length; i++) {
                Object value = state[i];
                if (value != null && isEntity(value)) {
                    try {
                        java.lang.reflect.Method getIdMethod = value.getClass().getMethod("getId");
                        Object id = getIdMethod.invoke(value);
                        map.put(propertyNames[i], value.getClass().getSimpleName() + "(id=" + id + ")");
                    } catch (Exception e) {
                        map.put(propertyNames[i], value.toString());
                    }
                } else {
                    map.put(propertyNames[i], value);
                }
            }
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            log.warn("Failed to serialize entity state: {}", e.getMessage());
            return "{\"error\": \"Unserializable state\"}";
        }
    }

    private boolean isEntity(Object obj) {
        return obj.getClass().isAnnotationPresent(jakarta.persistence.Entity.class);
    }
}
