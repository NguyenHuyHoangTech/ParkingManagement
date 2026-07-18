package com.pbms;

import com.pbms.modules.infrastructure.service.MapConfigurationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class MapConfigTest {

    @Autowired
    private MapConfigurationService mapConfigurationService;

    @Test
    public void testMapConfig() {
        try {
            mapConfigurationService.getMapConfiguration();
            System.out.println("MapConfig success!");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
