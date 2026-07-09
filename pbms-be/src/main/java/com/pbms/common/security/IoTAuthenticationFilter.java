package com.pbms.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class IoTAuthenticationFilter extends OncePerRequestFilter {

    @Value("${iot.api.key:PBMS-HARDWARE-SECURE-KEY-2024}")
    private String expectedApiKey;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getServletPath();
        if (path.startsWith("/api/v1/operation/iot/") || path.startsWith("/api/v1/iot/")) {
            String apiKey = request.getHeader("X-API-KEY");
            if (apiKey == null || !apiKey.equals(expectedApiKey)) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType("application/json");
                response.getWriter()
                        .write("{\"status\": 401, \"message\": \"Unauthorized: Invalid or missing API Key\"}");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }
}
