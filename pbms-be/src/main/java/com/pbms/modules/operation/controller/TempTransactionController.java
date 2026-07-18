package com.pbms.modules.operation.controller;

import com.pbms.modules.finance.repository.TransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/temp")
public class TempTransactionController {

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private com.pbms.modules.identity.service.WorkSessionService workSessionService;

    @GetMapping("/preview/9")
    public java.util.Map<String, Object> getPreview9() {
        return workSessionService.getPreviewSettlement("hoctapfu3@gmail.com");
    }

    @GetMapping("/preview/20")
    public java.util.Map<String, Object> getPreview20() {
        return workSessionService.getPreviewSettlement("systemstaffwebsite@gmail.com");
    }

    @GetMapping("/test-165")
    public int test165() {
        return transactionRepository.findByWorkSessionIdAndStatus(165L, "SUCCESS").size();
    }
}
