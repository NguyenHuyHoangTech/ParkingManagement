package com.pbms.modules.finance.service;

import com.pbms.modules.finance.dto.RevenueRecordDTO;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.PrintWriter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class RevenueService {

    @PersistenceContext
    private final EntityManager entityManager;

    private static final String BASE_SQL = """
        SELECT 
            CONVERT(VARCHAR(10), ps.time_out, 120) AS date_str, 
            COALESCE(vt.type_name, 'Unclear') AS vehicleType,
            COALESCE(g.gate_name, 'N/A') AS gateName, 
            CASE 
                WHEN ps.reservation_id IS NOT NULL THEN 'Reservation' 
                WHEN mt.id IS NOT NULL THEN 'Monthly Ticket' 
                ELSE 'Standard Ticket' 
            END AS revenueSource, 
            COALESCE(t.payment_method, 'CASH') AS paymentMethod, 
            SUM(ps.total_fee) AS totalRevenue, 
            COUNT(ps.id) AS totalTransactions 
        FROM parking_sessions ps 
        LEFT JOIN vehicle_types vt ON ps.vehicle_type_id = vt.id 
        LEFT JOIN gates g ON ps.gate_out_id = g.id 
        LEFT JOIN monthly_tickets mt ON ps.plate = mt.plate AND mt.status = 'ACTIVE' 
        LEFT JOIN transactions t ON ps.id = t.parking_session_id AND t.status = 'SUCCESS' 
        WHERE ps.status = 'COMPLETED' AND ps.total_fee > 0
          AND CAST(ps.time_out AS DATE) >= :startDate 
          AND CAST(ps.time_out AS DATE) <= :endDate 
        GROUP BY 
            CONVERT(VARCHAR(10), ps.time_out, 120), 
            COALESCE(vt.type_name, 'Unclear'),
            COALESCE(g.gate_name, 'N/A'), 
            CASE 
                WHEN ps.reservation_id IS NOT NULL THEN 'Reservation' 
                WHEN mt.id IS NOT NULL THEN 'Monthly Ticket' 
                ELSE 'Standard Ticket' 
            END, 
            COALESCE(t.payment_method, 'CASH')
        UNION ALL
        SELECT 
            CONVERT(VARCHAR(10), ps.time_out, 120) AS date_str, 
            COALESCE(vt.type_name, 'Unclear') AS vehicleType,
            COALESCE(g.gate_name, 'N/A') AS gateName, 
            'Penalty' AS revenueSource, 
            COALESCE(t.payment_method, 'CASH') AS paymentMethod, 
            SUM(ps.penalty_fee) AS totalRevenue, 
            COUNT(ps.id) AS totalTransactions 
        FROM parking_sessions ps 
        LEFT JOIN vehicle_types vt ON ps.vehicle_type_id = vt.id 
        LEFT JOIN gates g ON ps.gate_out_id = g.id 
        LEFT JOIN monthly_tickets mt ON ps.plate = mt.plate AND mt.status = 'ACTIVE' 
        LEFT JOIN transactions t ON ps.id = t.parking_session_id AND t.status = 'SUCCESS' 
        WHERE ps.status = 'COMPLETED' AND ps.penalty_fee > 0
          AND CAST(ps.time_out AS DATE) >= :startDate 
          AND CAST(ps.time_out AS DATE) <= :endDate 
        GROUP BY 
            CONVERT(VARCHAR(10), ps.time_out, 120), 
            COALESCE(vt.type_name, 'Unclear'),
            COALESCE(g.gate_name, 'N/A'), 
            COALESCE(t.payment_method, 'CASH')
         UNION ALL 
        SELECT 
            CONVERT(VARCHAR(10), t.created_at, 120) AS date_str, 
            'Unclear' AS vehicleType,
            N'N/A' AS gateName, 
            'Cancel Penalty' AS revenueSource, 
            t.payment_method AS paymentMethod, 
            SUM(t.amount) AS totalRevenue, 
            COUNT(t.id) AS totalTransactions 
        FROM transactions t 
        WHERE t.status = 'SUCCESS' 
          AND t.transaction_reference LIKE 'PENALTY-RES-%' 
          AND CAST(t.created_at AS DATE) >= :startDate 
          AND CAST(t.created_at AS DATE) <= :endDate 
        GROUP BY 
            CONVERT(VARCHAR(10), t.created_at, 120), 
            t.payment_method
        """;

    /**
     * [1] Fetch Dashboard Aggregated Data
     * Retrieves all revenue grouped by date, vehicle type, gate, and payment method for the given date range.
     * Used mainly for constructing Charts and KPIs on the UI.
     * @param startDate The start date of the reporting period
     * @param endDate The end date of the reporting period
     * @return List of aggregated revenue records
     */
    @Transactional(readOnly = true)
    public List<RevenueRecordDTO> getRevenueDashboardData(LocalDate startDate, LocalDate endDate) {
        Query query = entityManager.createNativeQuery(BASE_SQL);
        query.setParameter("startDate", startDate.toString());
        query.setParameter("endDate", endDate.toString());

        @SuppressWarnings("unchecked")
        List<Object[]> rawList = query.getResultList();
        return mapToDTOList(rawList);
    }

    /**
     * [2] Fetch Paginated Data for Data Table
     * Retrieves the same aggregated data but with Server-side Pagination.
     * Essential for handling large date ranges without crashing the browser.
     * @param startDate The start date
     * @param endDate The end date
     * @param page Current page number (1-indexed)
     * @param size Number of items per page
     * @return Page object containing the data slice and total count
     */
    @Transactional(readOnly = true)
    public Page<RevenueRecordDTO> getRevenueTableData(LocalDate startDate, LocalDate endDate, int page, int size) {
        // 1. Get count
        String countSql = "SELECT COUNT(*) FROM (" + BASE_SQL + ") AS raw_data";
        Query countQuery = entityManager.createNativeQuery(countSql);
        countQuery.setParameter("startDate", startDate.toString());
        countQuery.setParameter("endDate", endDate.toString());
        long totalElements = ((Number) countQuery.getSingleResult()).longValue();

        // 2. Get paginated data
        String paginatedSql = "SELECT * FROM (" + BASE_SQL + ") AS raw_data ORDER BY date_str DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY";
        Query query = entityManager.createNativeQuery(paginatedSql);
        query.setParameter("startDate", startDate.toString());
        query.setParameter("endDate", endDate.toString());
        query.setParameter("offset", (page - 1) * size);
        query.setParameter("limit", size);

        @SuppressWarnings("unchecked")
        List<Object[]> rawList = query.getResultList();
        List<RevenueRecordDTO> dtoList = mapToDTOList(rawList);

        return new PageImpl<>(dtoList, PageRequest.of(page - 1, size), totalElements);
    }

    /**
     * [3] Export Revenue Data to CSV
     * Streams the entire dataset for the date range directly to the HTTP response.
     * Uses UTF-8 BOM encoding so it opens correctly in MS Excel without garbled Vietnamese text.
     */
    @Transactional(readOnly = true)
    public StreamingResponseBody exportRevenueCsv(LocalDate startDate, LocalDate endDate) {
        return outputStream -> {
            try {
                // Write BOM for Excel UTF-8 support
                outputStream.write(0xEF);
                outputStream.write(0xBB);
                outputStream.write(0xBF);

                try (PrintWriter writer = new PrintWriter(new java.io.OutputStreamWriter(outputStream, java.nio.charset.StandardCharsets.UTF_8))) {
                    writer.println("Ngày;Loại xe;Cổng;Nguồn thu;Phương thức thanh toán;Tổng doanh thu;Số giao dịch");

                    Query query = entityManager.createNativeQuery("SELECT * FROM (" + BASE_SQL + ") AS raw_data ORDER BY date_str DESC");
                    query.setParameter("startDate", startDate.toString());
                    query.setParameter("endDate", endDate.toString());

                    // Unwrap Hibernate query and set fetch size to stream data without OOM
                    @SuppressWarnings("unchecked")
                    org.hibernate.query.Query<Object[]> hibernateQuery = query.unwrap(org.hibernate.query.Query.class);
                    hibernateQuery.setFetchSize(500);

                    java.util.stream.Stream<Object[]> stream = hibernateQuery.stream();

                    stream.forEach(row -> {
                        String dateStr = (String) row[0];
                        String vehicleType = (String) row[1];
                        String gateName = (String) row[2];
                        String revenueSource = (String) row[3];
                        String paymentMethod = (String) row[4];
                        BigDecimal totalRevenue = row[5] != null ? new BigDecimal(row[5].toString()) : BigDecimal.ZERO;
                        Long totalTransactions = row[6] != null ? ((Number) row[6]).longValue() : 0L;

                        writer.printf("%s;%s;%s;%s;%s;%s;%s\n",
                                dateStr, vehicleType, gateName, revenueSource, paymentMethod, totalRevenue, totalTransactions);
                    });
                }
            } catch (Exception e) {
                log.error("Error exporting CSV: ", e);
                throw new RuntimeException("Failed to export CSV", e);
            }
        };
    }

    private List<RevenueRecordDTO> mapToDTOList(List<Object[]> results) {
        List<RevenueRecordDTO> dtoList = new ArrayList<>();
        for (Object[] row : results) {
            dtoList.add(RevenueRecordDTO.builder()
                    .date((String) row[0])
                    .vehicleType((String) row[1])
                    .gateName((String) row[2])
                    .revenueSource((String) row[3])
                    .paymentMethod((String) row[4])
                    .totalRevenue(row[5] != null ? new BigDecimal(row[5].toString()) : BigDecimal.ZERO)
                    .totalTransactions(row[6] != null ? ((Number) row[6]).longValue() : 0L)
                    .build());
        }
        return dtoList;
    }
}
