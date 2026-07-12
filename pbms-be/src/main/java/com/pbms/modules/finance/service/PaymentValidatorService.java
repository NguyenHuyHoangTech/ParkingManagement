package com.pbms.modules.finance.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pbms.modules.finance.domain.PaymentOrder;
import com.pbms.modules.finance.domain.RefundRequest;
import com.pbms.modules.finance.dto.PaymentActionRequest;
import com.pbms.modules.finance.dto.PaymentExecutionResponse;
import com.pbms.modules.finance.repository.PaymentOrderRepository;
import com.pbms.modules.finance.repository.RefundRequestRepository;
import com.pbms.modules.identity.domain.User;
import com.pbms.modules.identity.repository.UserRepository;
import com.pbms.modules.operation.dto.CreateReservationRequest;
import com.pbms.modules.finance.domain.PricingPolicy;
import com.pbms.modules.finance.repository.PricingPolicyRepository;
import com.pbms.modules.operation.domain.MonthlyTicket;
import com.pbms.modules.operation.repository.MonthlyTicketRepository;
import com.pbms.modules.operation.domain.ParkingSession;
import com.pbms.modules.operation.repository.ParkingSessionRepository;
import com.pbms.modules.operation.service.GateOperationService;
import com.pbms.modules.operation.service.MonthlyTicketService;
import com.pbms.modules.operation.service.ReservationService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentValidatorService {

    private final PaymentOrderRepository paymentOrderRepository;
    private final RefundRequestRepository refundRequestRepository;
    private final UserRepository userRepository;

    private final ReservationService reservationService;
    private final MonthlyTicketService monthlyTicketService;
    private final GateOperationService gateOperationService;
    private final PricingPolicyRepository pricingPolicyRepository;
    private final MonthlyTicketRepository monthlyTicketRepository;
    private final ParkingSessionRepository parkingSessionRepository;
    private final com.pbms.common.security.JwtProvider jwtProvider;

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

    /**
     * Calculates the exact required payment amount based on the action type and payload.
     * Prevents the frontend from manipulating the requested amount.
     */
    @Transactional(readOnly = true)
    public Double calculateRequiredAmount(PaymentActionRequest request) {
        String actionType = request.getActionType();
        Map<String, Object> payload = request.getPayload();
        
        try {
            if ("CREATE_RESERVATION".equals(actionType)) {
                CreateReservationRequest createReq = objectMapper.convertValue(payload, CreateReservationRequest.class);
                return reservationService.previewPrice(createReq.getVehicleTypeId(), createReq.getExpectedEntryTime(), createReq.getExpectedDurationMinutes()).doubleValue();
                
            } else if ("CREATE_MONTHLY_TICKET".equals(actionType)) {
                Long vehicleTypeId = payload.get("vehicleTypeId") != null ? Long.parseLong(payload.get("vehicleTypeId").toString()) : null;
                int duration = payload.get("duration") != null ? Integer.parseInt(payload.get("duration").toString()) : 1;
                
                PricingPolicy policy = pricingPolicyRepository.findByVehicleTypeIdAndStatus(vehicleTypeId, "ACTIVE")
                        .orElseThrow(() -> new IllegalArgumentException("No active pricing policy for vehicle type: " + vehicleTypeId));
                BigDecimal rate = policy.getMonthlyRate() != null ? policy.getMonthlyRate() : BigDecimal.ZERO;
                return rate.multiply(BigDecimal.valueOf(duration)).doubleValue();
                
            } else if ("RENEW_MONTHLY_TICKET".equals(actionType)) {
                Long ticketId = Long.valueOf(payload.get("id").toString());
                int duration = payload.get("duration") != null ? Integer.parseInt(payload.get("duration").toString()) : 1;
                
                MonthlyTicket ticket = monthlyTicketRepository.findById(ticketId)
                        .orElseThrow(() -> new IllegalArgumentException("Ticket not found"));
                PricingPolicy policy = pricingPolicyRepository.findByVehicleTypeIdAndStatus(ticket.getVehicleType().getId(), "ACTIVE")
                        .orElseThrow(() -> new IllegalArgumentException("No active pricing policy found"));
                BigDecimal rate = policy.getMonthlyRate() != null ? policy.getMonthlyRate() : BigDecimal.ZERO;
                return rate.multiply(BigDecimal.valueOf(duration)).doubleValue();
                
            } else if ("CHECKOUT".equals(actionType)) {
                String plateNumber = payload.get("plateNumber") != null ? payload.get("plateNumber").toString() : null;
                String rfid = payload.get("rfid") != null ? payload.get("rfid").toString() : null;
                
                ParkingSession session = null;
                if (rfid != null && !rfid.isEmpty()) {
                    session = parkingSessionRepository.findByRfidCard_CardCodeAndStatus(rfid, "ACTIVE").stream().findFirst().orElse(null);
                }
                if (session == null && plateNumber != null && !plateNumber.isEmpty()) {
                    session = parkingSessionRepository.findByPlateAndStatus(plateNumber, "ACTIVE").stream().findFirst().orElse(null);
                }
                if (session == null) {
                    throw new IllegalArgumentException("No active parking session found for Checkout");
                }
                
                if (request.getCheckoutToken() != null && !request.getCheckoutToken().isEmpty()) {
                    try {
                        io.jsonwebtoken.Claims claims = jwtProvider.getCheckoutClaims(request.getCheckoutToken());
                        if (!String.valueOf(session.getId()).equals(claims.get("sessionId", String.class))) {
                            throw new IllegalArgumentException("Token không khớp với phiên đỗ xe hiện tại.");
                        }
                        Double expectedFeeDouble = claims.get("expectedFee", Double.class);
                        if (expectedFeeDouble != null) {
                            return expectedFeeDouble;
                        }
                    } catch (io.jsonwebtoken.ExpiredJwtException e) {
                        throw new IllegalArgumentException("Báo giá đã hết hạn. Vui lòng làm mới trang (refresh) để xem báo giá mới nhất.");
                    } catch (Exception e) {
                        throw new IllegalArgumentException("Token báo giá không hợp lệ: " + e.getMessage());
                    }
                }
                
                // Fallback (should ideally be rejected if no token is provided, but keep for legacy testing)
                com.pbms.modules.operation.dto.CheckOutSessionInfoDTO info = gateOperationService.getCheckOutSessionInfo(session, com.pbms.common.utils.TimeProvider.now());
                return gateOperationService.calculateTotalAmount(info).doubleValue();
            }
        } catch (Exception e) {
            log.error("Failed to calculate required amount for action: " + actionType, e);
            throw new IllegalArgumentException("Lỗi tính toán số tiền: " + e.getMessage());
        }
        
        throw new IllegalArgumentException("Unsupported action type for calculating amount: " + actionType);
    }

    /**
     * Pre-Validate the payload before generating payment link.
     */
    @Transactional
    public PaymentOrder initializePaymentOrder(PaymentActionRequest request, String orderCode, String currentUserEmail) {
        // 1. Validation Logic
        String actionType = request.getActionType();
        Map<String, Object> payload = request.getPayload();

        try {
            if ("CREATE_RESERVATION".equals(actionType)) {
                CreateReservationRequest createReq = objectMapper.convertValue(payload, CreateReservationRequest.class);
                reservationService.validateCreateReservation(createReq);
            } else if ("CREATE_MONTHLY_TICKET".equals(actionType)) {
                monthlyTicketService.validateCreateTicket(payload);
            } else if ("RENEW_MONTHLY_TICKET".equals(actionType)) {
                Long ticketId = Long.valueOf(payload.get("id").toString());
                int duration = payload.get("duration") != null ? Integer.parseInt(payload.get("duration").toString()) : 1;
                monthlyTicketService.validateRenewTicket(ticketId, duration);
            } else if ("CHECKOUT".equals(actionType)) {
                if (payload.get("rfid") == null && payload.get("plateNumber") == null)
                    throw new IllegalArgumentException("RFID or Plate Number is required for Checkout");
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("Validation failed before payment: " + e.getMessage());
        }

        // 2. Save PaymentOrder
        String payloadJson = "{}";
        try {
            payloadJson = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            log.error("Failed to serialize payload", e);
        }

        Long currentUserId = null;
        if (currentUserEmail != null) {
            User u = userRepository.findByEmail(currentUserEmail).orElse(null);
            if (u != null) {
                currentUserId = u.getId();
            }
        }

        PaymentOrder order = PaymentOrder.builder()
                .orderCode(orderCode)
                .amount(BigDecimal.valueOf(request.getAmount()))
                .status("PENDING")
                .paymentMethod(request.getGateway())
                .actionType(actionType)
                .payload(payloadJson)
                .userId(currentUserId)
                .build();

        return paymentOrderRepository.save(order);
    }

    /**
     * Execute business logic AFTER payment is successful.
     * If execution fails, create a RefundRequest.
     */
    @Transactional
    public PaymentExecutionResponse executeAction(String orderCode) {
        PaymentOrder order = paymentOrderRepository.findByOrderCode(orderCode)
                .orElseThrow(() -> new IllegalArgumentException("Payment Order not found"));

        if (!"PAID".equals(order.getStatus())) {
            return new PaymentExecutionResponse(false, "FAILED",
                    "Order is not in PAID status (current: " + order.getStatus() + ")", null);
        }

        try {
            // Re-parse payload
            Map<String, Object> payload = objectMapper.readValue(order.getPayload(),
                    new TypeReference<Map<String, Object>>() {
                    });
            Object resultData = null;

            if ("CREATE_RESERVATION".equals(order.getActionType())) {
                CreateReservationRequest createReq = objectMapper.convertValue(payload, CreateReservationRequest.class);
                resultData = reservationService.createReservation(createReq);
            } else if ("CREATE_MONTHLY_TICKET".equals(order.getActionType())) {
                resultData = monthlyTicketService.createTicket(payload);
            } else if ("RENEW_MONTHLY_TICKET".equals(order.getActionType())) {
                Long ticketId = Long.valueOf(payload.get("id").toString());
                int duration = payload.get("duration") != null ? Integer.parseInt(payload.get("duration").toString())
                        : 1;
                resultData = monthlyTicketService.renewTicket(ticketId, duration);
            } else if ("CHECKOUT".equals(order.getActionType())) {
                // Typically Check-out updates the session
                com.pbms.modules.operation.dto.CheckOutRequestDTO checkoutReq = objectMapper.convertValue(payload,
                        com.pbms.modules.operation.dto.CheckOutRequestDTO.class);
                checkoutReq.setPaymentMethod(order.getPaymentMethod()); // ensure it reflects the gateway
                resultData = gateOperationService.processCheckOut(checkoutReq);
            } else {
                throw new UnsupportedOperationException("Unknown action type: " + order.getActionType());
            }

            // Success -> Mark as COMPLETED
            order.setStatus("COMPLETED");
            paymentOrderRepository.save(order);
            return new PaymentExecutionResponse(true, "COMPLETED", "Action executed successfully", resultData);

        } catch (Exception e) {
            // Rethrow to let the transaction roll back
            throw new RuntimeException(e);
        }
    }

    @Transactional
    public PaymentExecutionResponse processRefundForFailedAction(String orderCode, String errorMessage, String currentUserEmail) {
        PaymentOrder order = paymentOrderRepository.findByOrderCode(orderCode)
                .orElseThrow(() -> new IllegalArgumentException("Payment Order not found"));

        if (!"PAID".equals(order.getStatus()) && !"FAILED".equals(order.getStatus())) {
            return new PaymentExecutionResponse(false, "FAILED",
                    "Cannot refund order in status: " + order.getStatus(), null);
        }

        if ("FAILED".equals(order.getStatus())) {
            return new PaymentExecutionResponse(false, "REFUND_INITIATED", "Already refunded", null);
        }

        // System Failure -> Fallback to Refund
        order.setStatus("FAILED");
        paymentOrderRepository.save(order);

        User user = null;
        if (order.getUserId() != null) {
            user = userRepository.findById(order.getUserId()).orElse(null);
        }
        if (user == null && currentUserEmail != null && !currentUserEmail.equals("anonymousUser")) {
            user = userRepository.findByEmail(currentUserEmail).orElse(null);
        }
        if (user == null) {
            user = userRepository.findByEmail("systemadministratorweb@gmail.com").orElseThrow();
        }

        RefundRequest refundRequest = RefundRequest.builder()
                .user(user)
                .referenceType("FAILED_TRANSACTION")
                .referenceId(order.getOrderCode())
                .paidAmount(order.getAmount())
                .penaltyFee(BigDecimal.ZERO)
                .refundAmount(order.getAmount())
                .status("PENDING")
                .cancelTime(com.pbms.common.utils.TimeProvider.now())
                .rejectReason("System Error during execution: " + errorMessage)
                .build();

        refundRequestRepository.save(refundRequest);

        return new PaymentExecutionResponse(false, "REFUND_INITIATED",
                "System could not complete the action. Your payment of " + order.getAmount()
                        + " has been queued for a full refund. Error: " + errorMessage,
                null);
    }
}
