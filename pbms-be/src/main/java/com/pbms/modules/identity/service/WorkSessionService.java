package com.pbms.modules.identity.service;

// =========================================================================
// PHẦN 1: CÁC DOMAIN ENTITY VÀ REPOSITORY LÕI (IDENTITY & OPERATION & FINANCE)
// =========================================================================
import com.pbms.modules.identity.domain.StaffWorkSession;
import com.pbms.modules.identity.domain.User;
import com.pbms.modules.identity.repository.UserRepository;
import com.pbms.modules.infrastructure.domain.Gate;
import com.pbms.modules.infrastructure.repository.GateRepository;
import com.pbms.modules.operation.domain.ParkingSession;
import com.pbms.modules.operation.repository.ParkingSessionRepository;
import com.pbms.modules.operation.repository.StaffWorkSessionRepository;
import com.pbms.modules.finance.repository.TransactionRepository;

// =========================================================================
// PHẦN 2: CÁC THƯ VIỆN SPRING BOOT / LOMBOK VÀ PHÂN TRANG
// =========================================================================
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * =========================================================================================
 * DỊCH VỤ QUẢN LÝ CA TRỰC NHÂN VIÊN VÀ ĐỐI SOÁT DOANH THU (WORK SESSION SERVICE)
 * =========================================================================================
 *
 * MỤC ĐÍCH:
 * Chịu trách nhiệm quản lý vòng đời ca làm việc của Nhân viên kiểm soát cổng (Mở ca,
 * Đóng ca), thống kê trước số lượng giao dịch và doanh thu (tiền mặt/chuyển khoản),
 * cũng như phục vụ truy vấn lịch sử ca trực cho Quản lý bãi xe.
 *
 * BẰNG CHỨNG KIẾN TRÚC:
 * - Minh chứng 1: Bắt buộc kiểm tra tính độc quyền của ca trực (1 nhân viên chỉ được
 *   trực 1 cổng tại 1 thời điểm, và 1 cổng chỉ nhận 1 nhân viên ACTIVE).
 * - Minh chứng 2: Doanh thu chốt ca được tổng hợp động từ bảng `transactions` với
 *   trạng thái `SUCCESS`, chia rõ doanh thu tiền mặt (`CASH`) và chuyển khoản.
 * =========================================================================================
 */
@Service
@RequiredArgsConstructor
public class WorkSessionService {

    private final StaffWorkSessionRepository workSessionRepository;
    private final UserRepository userRepository;
    private final GateRepository gateRepository;
    private final ParkingSessionRepository parkingSessionRepository;
    private final TransactionRepository transactionRepository;

    /**
     * =========================================================================
     * API/HÀM: MỞ CA TRỰC TẠI CỔNG (START SESSION)
     * =========================================================================
     * MỤC ĐÍCH:
     * Kiểm tra ràng buộc độc quyền ca trực của nhân viên và cổng, sau đó khởi
     * tạo bản ghi `StaffWorkSession` với trạng thái "ACTIVE".
     *
     * MÃ GIẢ CHI TIẾT:
     * 1. Kiểm tra email nhân viên trong DB.
     * 2. Nếu nhân viên này đang có ca trực "ACTIVE" tại cổng khác -> Ném ngoại lệ.
     * 3. Kiểm tra cổng (Gate) theo ID.
     * 4. Nếu cổng này đang được nhân viên khác trực "ACTIVE" -> Ném ngoại lệ.
     * 5. Khởi tạo đối tượng ca trực với thời gian đăng nhập hiện tại.
     * 6. Đưa trạng thái Cổng sang "OCCUPIED" để đối xứng với `endSession()`
     *    (đưa về "IDLE" khi đóng ca) — nhờ đó
     *    Space Map (`SpaceMapScreen.tsx`) tô đúng màu Gate đang có người trực.
     * 7. Lưu ca trực mới vào DB.
     */
    @Transactional
    public StaffWorkSession startSession(String email, Long gateId, String gateType) {
        User staff = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Staff account not found"));

        // KIỂM TRA ĐỘC QUYỀN NHÂN VIÊN: Một nhân viên không được trực 2 cổng cùng lúc
        Optional<StaffWorkSession> existing = workSessionRepository
                .findByStaffIdAndStatus(staff.getId(), "ACTIVE");
        if (existing.isPresent()) {
            throw new IllegalStateException("You are already on duty at gate \""
                + existing.get().getGate().getGateName() + "\". Please end that shift first.");
        }

        Gate gate = gateRepository.findById(gateId)
                .orElseThrow(() -> new IllegalArgumentException("Gate not found: " + gateId));

        // KIỂM TRA ĐỘC QUYỀN CỔNG: Một cổng không được nhận 2 nhân viên trực cùng lúc
        Optional<StaffWorkSession> gateExisting = workSessionRepository
                .findByGateIdAndStatus(gate.getId(), "ACTIVE");
        if (gateExisting.isPresent()) {
            throw new IllegalStateException("Gate is already occupied by "
                + gateExisting.get().getStaff().getFullName());
        }

        StaffWorkSession session = StaffWorkSession.builder()
                .staff(staff)
                .gate(gate)
                .workGateType(gateType != null ? gateType : "IN_OUT")
                .loginTime(com.pbms.common.utils.TimeProvider.now())
                .status("ACTIVE")
                .build();

        // Đưa trạng thái Cổng sang "OCCUPIED" vì đã có người trực — trước đây bị
        // thiếu dòng này, khiến Gate không bao giờ chuyển OCCUPIED dù có nhân viên
        // mở ca, làm Space Map (SpaceMapScreen.tsx) không bao giờ tô xanh Gate.
        gate.setStatus("OCCUPIED");
        gateRepository.save(gate);

        return workSessionRepository.save(session);
    }

    /**
     * =========================================================================
     * API/HÀM: ĐÓNG CA TRỰC VÀ CHỐT DOANH THU (END SESSION)
     * =========================================================================
     * MỤC ĐÍCH:
     * Kết thúc ca làm việc của nhân viên, tổng hợp doanh thu tiền mặt và chuyển
     * khoản từ bảng giao dịch, đổi trạng thái ca sang "COMPLETED".
     *
     * MÃ GIẢ CHI TIẾT:
     * 1. Tìm phiên làm việc "ACTIVE" của nhân viên theo email.
     * 2. Nếu không có phiên -> Trả về kết quả fallback an toàn để giải phóng FE.
     * 3. Gọi `getPreviewSettlement(email)` TRƯỚC KHI cập nhật trạng thái COMPLETED
     *    để tính tổng doanh thu (`totalRevenue`, `cashRevenue`, `otherRevenue`).
     * 4. Gán thời gian đăng xuất, doanh thu chốt ca vào Entity và lưu DB.
     * 5. Đưa trạng thái Cổng về "IDLE" để chờ ca trực mới tiếp quản.
     */
    @Transactional
    public Map<String, Object> endSession(String email) {
        User staff = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Staff account not found"));

        Optional<StaffWorkSession> sessionOpt = workSessionRepository
                .findByStaffIdAndStatus(staff.getId(), "ACTIVE");

        if (sessionOpt.isEmpty()) {
            // Xử lý an toàn: giải phóng giao diện Frontend nếu bộ nhớ tạm (localStorage) bị lệch
            Map<String, Object> result = new HashMap<>();
            result.put("sessionId", null);
            result.put("staffName", staff.getFullName());
            result.put("gateName", "N/A");
            result.put("message", "No active work session found to end");
            return result;
        }

        StaffWorkSession session = sessionOpt.get();

        // TÍNH TOÁN DOANH THU CHỐT CA: Bắt buộc tính trước khi đổi sang "COMPLETED"
        Map<String, Object> preview = getPreviewSettlement(email);
        BigDecimal expectedRevenue = preview.get("totalRevenue") != null 
            ? new BigDecimal(preview.get("totalRevenue").toString()) 
            : BigDecimal.ZERO;
            
        BigDecimal expectedCashRevenue = preview.get("cashRevenue") != null 
            ? new BigDecimal(preview.get("cashRevenue").toString()) 
            : BigDecimal.ZERO;
            
        BigDecimal expectedOtherRevenue = preview.get("otherRevenue") != null 
            ? new BigDecimal(preview.get("otherRevenue").toString()) 
            : BigDecimal.ZERO;
            
        session.setStatus("COMPLETED");
        session.setLogoutTime(com.pbms.common.utils.TimeProvider.now());
        
        session.setExpectedRevenue(expectedRevenue);
        session.setExpectedCashRevenue(expectedCashRevenue);
        session.setExpectedOtherRevenue(expectedOtherRevenue);

        // Trả trạng thái Cổng về "IDLE" (trống, chờ ca trực mới) sau khi đóng ca.
        // Dùng đúng bộ từ vựng đã khai báo ở `GateConfigDTO` — IDLE/OCCUPIED/MAINTENANCE
        // — vì màn hình sơ đồ in thẳng chuỗi này ra cho quản lý đọc: "INACTIVE" như
        // trước đây khiến quản lý tưởng Cổng bị hỏng/khóa, trong khi thực tế nó chỉ
        // đang trống. Không nơi nào trong hệ thống đọc giá trị "INACTIVE" của Cổng.
        Gate gate = session.getGate();
        if (gate != null) {
            gate.setStatus("IDLE");
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
     * =========================================================================
     * API/HÀM: XEM TRƯỚC BÁO CÁO DOANH THU CA TRỰC (PREVIEW SETTLEMENT)
     * =========================================================================
     * MỤC ĐÍCH:
     * Tính toán doanh thu tạm thời của ca trực hiện tại theo email nhân viên,
     * bao gồm tổng số lượt xe vào/ra, doanh thu tiền mặt (`CASH`), và doanh thu
     * chuyển khoản/hình thức khác.
     *
     * MÃ GIẢ CHI TIẾT:
     * 1. Tìm phiên làm việc "ACTIVE" của nhân viên theo email.
     * 2. Nếu không có -> Trả về `hasActiveSession = false`.
     * 3. Truy vấn danh sách xe vào (`checkIns`) và xe ra (`checkOuts`) tại cổng.
     * 4. Xác định tổng số lượng giao dịch dựa theo chức năng cổng (IN, OUT, IN_OUT).
     * 5. Duyệt qua tất cả giao dịch "SUCCESS" của phiên làm việc:
     *    - Nếu `paymentMethod == CASH` -> Cộng vào `cashRevenue`.
     *    - Ngược lại -> Cộng vào `otherRevenue`.
     * 6. Trả về map chứa đầy đủ thông số báo cáo ca làm việc.
     */
    public Map<String, Object> getPreviewSettlement(String email) {
        User staff = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Staff account not found"));

        Optional<StaffWorkSession> sessionOpt = workSessionRepository
                .findByStaffIdAndStatus(staff.getId(), "ACTIVE");

        if (sessionOpt.isEmpty()) {
            Map<String, Object> empty = new HashMap<>();
            empty.put("hasActiveSession", false);
            return empty;
        }

        StaffWorkSession session = sessionOpt.get();

        // Lấy danh sách phiên xe vào/ra trong khoảng thời gian từ lúc mở ca đến hiện tại
        List<ParkingSession> checkIns = parkingSessionRepository
                .findByGateInIdAndTimeInBetween(
                        session.getGate().getId(),
                        session.getLoginTime(),
                        com.pbms.common.utils.TimeProvider.now()
                );

        List<ParkingSession> checkOuts = parkingSessionRepository
                .findByGateOutIdAndTimeOutBetween(
                        session.getGate().getId(),
                        session.getLoginTime(),
                        com.pbms.common.utils.TimeProvider.now()
                );

        BigDecimal totalRevenue = BigDecimal.ZERO;
        BigDecimal cashRevenue = BigDecimal.ZERO;
        BigDecimal otherRevenue = BigDecimal.ZERO;
        long totalTransactions = 0;

        String workGateType = session.getWorkGateType();
        Map<String, Object> preview = new HashMap<>();
        if ("IN".equals(workGateType) || "ENTRY".equals(workGateType)) {
            preview.put("action", "Check-in processing required");
            totalTransactions = checkIns.size();
        } else if ("OUT".equals(workGateType) || "EXIT".equals(workGateType) || "IN_OUT".equals(workGateType) || "ENTRY_EXIT".equals(workGateType)) {
            preview.put("action", "Checkout processing required");
            if ("OUT".equals(workGateType) || "EXIT".equals(workGateType)) {
                totalTransactions = checkOuts.size();
            } else {
                totalTransactions = checkIns.size() + checkOuts.size();
            }
        }
        
        // TỔNG HỢP DOANH THU THEO PHƯƠNG THỨC THANH TOÁN
        List<com.pbms.modules.finance.domain.Transaction> transactions = transactionRepository.findByWorkSessionIdAndStatus(session.getId(), "SUCCESS");
        for (com.pbms.modules.finance.domain.Transaction t : transactions) {
            if (t.getAmount() != null) {
                totalRevenue = totalRevenue.add(t.getAmount());
                if ("CASH".equalsIgnoreCase(t.getPaymentMethod())) {
                    cashRevenue = cashRevenue.add(t.getAmount());
                } else {
                    otherRevenue = otherRevenue.add(t.getAmount());
                }
            }
        }

        preview.put("hasActiveSession", true);
        preview.put("sessionId", session.getId());
        preview.put("gateId", session.getGate().getId());
        preview.put("gateType", session.getWorkGateType());
        preview.put("staffName", staff.getFullName());
        preview.put("gateName", session.getGate().getGateName());
        preview.put("loginTime", session.getLoginTime());
        preview.put("totalTransactions", totalTransactions);
        preview.put("totalRevenue", totalRevenue);
        preview.put("cashRevenue", cashRevenue);
        preview.put("otherRevenue", otherRevenue);
        return preview;
    }

    /**
     * =========================================================================
     * API/HÀM: TRA CỨU LỊCH SỬ CÁC CA TRỰC (GET WORK SESSION HISTORY)
     * =========================================================================
     * MỤC ĐÍCH:
     * Lọc danh sách các ca làm việc đã chốt (trạng thái "COMPLETED") theo khoảng
     * ngày (`startDate`, `endDate`) và loại cổng (`gateType`), phân trang cho UI.
     *
     * MÃ GIẢ CHI TIẾT:
     * 1. Phân tích chuỗi ngày `startDateStr` (từ 00:00:00) và `endDateStr` (đến 23:59:59).
     * 2. Truy vấn DB theo tiêu chí kết hợp:
     *    - Có cả khoảng ngày + loại cổng.
     *    - Chỉ có khoảng ngày.
     *    - Chỉ có loại cổng.
     *    - Hoặc lấy toàn bộ danh sách "COMPLETED".
     * 3. Ánh xạ sang Map kết quả cho Frontend render bảng lịch sử.
     */
    public Page<Map<String, Object>> getWorkSessionHistory(String startDateStr, String endDateStr, String gateType, Pageable pageable) {
        LocalDateTime startDate = null;
        LocalDateTime endDate = null;
        if (startDateStr != null && !startDateStr.isEmpty()) {
            startDate = LocalDateTime.parse(startDateStr + "T00:00:00");
        }
        if (endDateStr != null && !endDateStr.isEmpty()) {
            endDate = LocalDateTime.parse(endDateStr + "T23:59:59");
        }

        Page<StaffWorkSession> sessions;
        if (startDate != null && endDate != null) {
            if (gateType != null && !gateType.isEmpty()) {
                sessions = workSessionRepository.findByStatusAndLogoutTimeBetweenAndWorkGateType("COMPLETED", startDate, endDate, gateType, pageable);
            } else {
                sessions = workSessionRepository.findByStatusAndLogoutTimeBetween("COMPLETED", startDate, endDate, pageable);
            }
        } else {
            if (gateType != null && !gateType.isEmpty()) {
                sessions = workSessionRepository.findByStatusAndWorkGateType("COMPLETED", gateType, pageable);
            } else {
                sessions = workSessionRepository.findByStatus("COMPLETED", pageable);
            }
        }

        return sessions.map(session -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", session.getId());
            map.put("staffName", session.getStaff().getFullName());
            map.put("gateName", session.getGate().getGateName());
            map.put("gateType", session.getWorkGateType());
            map.put("loginTime", session.getLoginTime());
            map.put("logoutTime", session.getLogoutTime());
            map.put("expectedRevenue", session.getExpectedRevenue());
            map.put("expectedCashRevenue", session.getExpectedCashRevenue());
            map.put("expectedOtherRevenue", session.getExpectedOtherRevenue());
            map.put("status", session.getStatus());
            return map;
        });
    }
}
