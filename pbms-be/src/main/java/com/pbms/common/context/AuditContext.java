package com.pbms.common.context;

import com.pbms.modules.identity.domain.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditContext {
    private String action;
    private String resource;
    private String description;
    private User actor;
    private String ipAddress;
    private String oldValue;
    private String newValue;
    private boolean dbModified;
}
