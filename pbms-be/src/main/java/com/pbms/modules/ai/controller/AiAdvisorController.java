package com.pbms.modules.ai.controller;

import com.pbms.common.dto.ApiResponse;
import com.pbms.modules.ai.dto.AiRoutingRequest;
import com.pbms.modules.ai.service.GeminiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/manager/ai")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'MANAGER')")
public class AiAdvisorController {

    private final GeminiService geminiService;

    @PostMapping("/routing-advice")
    public ResponseEntity<ApiResponse<String>> getRoutingAdvice(@RequestBody AiRoutingRequest request) {
        String advice = geminiService.getRoutingAdvice(request);
        return ResponseEntity.ok(ApiResponse.success(advice, "Success"));
    }
}
