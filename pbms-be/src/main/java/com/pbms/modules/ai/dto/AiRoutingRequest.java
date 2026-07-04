package com.pbms.modules.ai.dto;

import com.pbms.modules.incident.dto.ZoneTrendDTO;
import lombok.Data;

import java.util.List;

@Data
public class AiRoutingRequest {
    private String vehicleType;
    private String dateRange;
    private List<ZoneTrendDTO> chartData;
    private String extraContext;
    private boolean isRoutingEnabled;
    private Object currentRules;
}
