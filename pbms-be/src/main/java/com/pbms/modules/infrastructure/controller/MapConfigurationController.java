package com.pbms.modules.infrastructure.controller;

import com.pbms.common.dto.ApiResponse;
import com.pbms.modules.infrastructure.dto.config.MapConfigDTO;
import com.pbms.modules.infrastructure.service.MapConfigurationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.pbms.common.annotation.LogAudit;

@RestController
@RequestMapping("/api/v1/infrastructure/map")
@RequiredArgsConstructor
@Slf4j
public class MapConfigurationController {

    private final MapConfigurationService mapConfigurationService;

    @GetMapping("/config")
    public ResponseEntity<ApiResponse<MapConfigDTO>> getMapConfig() {
        return ResponseEntity.ok(ApiResponse.success(
                mapConfigurationService.getMapConfiguration(),
                "Successfully retrieved parking configuration"
        ));
    }

    @PostMapping("/save")
    @LogAudit(action = "UPDATE", resource = "MapConfiguration", description = "Update space map configuration")
    public ResponseEntity<ApiResponse<String>> saveMapConfig(@RequestBody MapConfigDTO mapConfigDTO) {
        try {
            mapConfigurationService.saveMapConfiguration(mapConfigDTO);
            return ResponseEntity.ok(ApiResponse.success("What are the results?", "The results"));
        } catch (Exception e) {
            log.error("Failed to parse string list map configuration", e);
            return ResponseEntity.badRequest().body(ApiResponse.error(400, e.getMessage()));
        }
    }
}
