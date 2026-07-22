import os

file_path = r"d:\GitHub\ParkingManagement\pbms-be\src\main\java\com\pbms\modules\identity\service\WorkSessionService.java"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix the method signature that was mangled
wrong_block = """        session.setExpectedOtherRevenue(expectedOtherRevenue);

        // Reset physical gate type back to generic ENTRY_EXIT after shift ends
                .orElseThrow(() -> new IllegalArgumentException("Staff do not agree"));"""

right_block = """        session.setExpectedOtherRevenue(expectedOtherRevenue);

        // Reset physical gate type back to generic ENTRY_EXIT after shift ends
        Gate gate = session.getGate();
        if (gate != null && session.getWorkGateType() != null && !session.getWorkGateType().equals("PATROL")) {
            gate.setStatus("INACTIVE");
            gateRepository.save(gate);
        }

        workSessionRepository.save(session);

        Map<String, Object> result = new HashMap<>();
        result.put("sessionId", session.getId());
        result.put("staffName", staff.getFullName());
        result.put("gateName", session.getGate().getGateName());
        result.put("loginTime", session.getLoginTime());
        result.put("logoutTime", session.getLogoutTime());
        result.put("message", "Work session checked out successfully");
        return result;
    }

    /**
     * Preview the current shift's expected revenue before checking out.
     * Calculates total expected revenue based on the gate type and the number of checkout sessions.
     * Includes a specific edge case for PATROL staff who collect penalty fees directly.
     * @param email Staff's email
     * @return Map containing preview data (expected revenue, transaction count, etc.)
     */
    public Map<String, Object> getPreviewSettlement(String email) {
        User staff = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Staff do not agree"));"""

content = content.replace(wrong_block, right_block)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
