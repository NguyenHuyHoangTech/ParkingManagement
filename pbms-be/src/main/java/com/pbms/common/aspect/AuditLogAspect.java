package com.pbms.common.aspect;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pbms.common.annotation.LogAudit;
import com.pbms.common.context.AuditContext;
import com.pbms.common.context.AuditContextHolder;
import com.pbms.modules.identity.domain.User;
import com.pbms.modules.identity.repository.UserRepository;
import com.pbms.modules.system.domain.AuditLog;
import com.pbms.modules.system.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Arrays;

@Aspect
@Component
@Slf4j
@RequiredArgsConstructor
public class AuditLogAspect {

    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule())
            .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(com.fasterxml.jackson.databind.SerializationFeature.FAIL_ON_EMPTY_BEANS);

    @Around("@annotation(logAudit)")
    public Object logAround(ProceedingJoinPoint joinPoint, LogAudit logAudit) throws Throwable {
        AuditContext context = null;
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            User actor = null;
            if (auth != null && auth.getName() != null && !auth.getName().equals("anonymousUser")) {
                actor = userRepository.findByEmail(auth.getName()).orElse(null);
            }

            String ipAddress = "";
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                ipAddress = request.getRemoteAddr();
            }

            String resource = logAudit.resource().isEmpty() ? joinPoint.getSignature().getDeclaringTypeName() : logAudit.resource();

            context = AuditContext.builder()
                    .actor(actor)
                    .action(logAudit.action())
                    .resource(resource)
                    .description(logAudit.description())
                    .ipAddress(ipAddress)
                    .dbModified(false)
                    .build();

            AuditContextHolder.setContext(context);
            
            Object result = joinPoint.proceed();
            
            if (!context.isDbModified()) {
                // If Hibernate Listener didn't trigger, this action didn't modify the DB (e.g. SEND COMMAND)
                // We still want to log it for audit purposes.
                String requestPayload;
                try {
                    Object[] args = Arrays.stream(joinPoint.getArgs())
                            .filter(arg -> !(arg instanceof jakarta.servlet.http.HttpServletRequest || 
                                             arg instanceof jakarta.servlet.http.HttpServletResponse ||
                                             arg instanceof org.springframework.security.core.Authentication ||
                                             arg instanceof org.springframework.web.multipart.MultipartFile))
                            .toArray();
                    requestPayload = objectMapper.writeValueAsString(args.length == 1 ? args[0] : args);
                } catch (Exception e) {
                    requestPayload = Arrays.toString(joinPoint.getArgs());
                }

                AuditLog auditLog = AuditLog.builder()
                        .actor(context.getActor())
                        .action(context.getAction())
                        .resource(context.getResource() + 
                                 ("RoutingRule".equals(context.getResource()) || 
                                  "PricingPolicy".equals(context.getResource()) ||
                                  "MapConfiguration".equals(context.getResource()) ||
                                  "RfidCard".equals(context.getResource())
                                 ? " (Batch Update)" : " (Non-DB Action)"))
                        .description(context.getDescription())
                        .ipAddress(context.getIpAddress())
                        .oldValue(context.getOldValue())
                        .newValue(context.getNewValue() != null ? context.getNewValue() : requestPayload)
                        .build();

                auditLogRepository.save(auditLog);
            }
            
            return result;
            
        } catch (Throwable e) {
            throw e;
        } finally {
            AuditContextHolder.clearContext();
        }
    }
}


