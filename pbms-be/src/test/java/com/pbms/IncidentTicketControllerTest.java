package com.pbms;

import com.pbms.modules.incident.controller.IncidentTicketController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class IncidentTicketControllerTest {

    @Autowired
    private IncidentTicketController incidentController;

    @Test
    public void testIncidentController() {
        try {
            org.springframework.security.core.Authentication auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("manager@pbms.com", "password");
            org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
            incidentController.getAllIncidents(auth);
            System.out.println("IncidentController success!");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
