package com.pbms.modules.infrastructure.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class ImpoundedZoneMigration implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(ImpoundedZoneMigration.class);
    private final JdbcTemplate jdbcTemplate;

    public ImpoundedZoneMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) throws Exception {
        log.info("Checking for any remaining IMPOUNDED zones to migrate...");
        try {
            int updatedRows = jdbcTemplate.update(
                "UPDATE zones SET function_type = 'WALK_IN' WHERE function_type = 'IMPOUNDED'"
            );
            if (updatedRows > 0) {
                log.info("Migrated {} IMPOUNDED zones to WALK_IN zones successfully.", updatedRows);
            } else {
                log.info("No IMPOUNDED zones found. Migration not needed.");
            }
        } catch (Exception e) {
            log.error("Failed to execute IMPOUNDED zone migration.", e);
        }
    }
}
