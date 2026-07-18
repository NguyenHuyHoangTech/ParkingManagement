package com.pbms;

import com.pbms.modules.infrastructure.controller.GateController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class GateControllerTest {

    @Autowired
    private GateController gateController;

    @Test
    public void testGateController() {
        try {
            gateController.getAllGates();
            System.out.println("GateController success!");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
