package com.mdot.studio.controller;

import com.mdot.studio.entity.Photo;
import com.mdot.studio.exception.ProcessingException;
import com.mdot.studio.service.PdfService;
import com.mdot.studio.service.PhotoService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class PrintController {

    private final PhotoService photoService;
    private final PdfService pdfService;

    public PrintController(PhotoService photoService, PdfService pdfService) {
        this.photoService = photoService;
        this.pdfService = pdfService;
    }

    /**
     * Generate PDF for printing.
     */
    @PostMapping("/pdf/export")
    public ResponseEntity<byte[]> exportPdf(@RequestBody Map<String, Object> body) {
        String layout = (String) body.getOrDefault("layout", "SIDE_BY_SIDE");
        int copies = ((Number) body.getOrDefault("copies", 1)).intValue();
        double marginMm = ((Number) body.getOrDefault("marginMm", 5.0)).doubleValue();
        double cardWidthMm = ((Number) body.getOrDefault("cardWidthMm", 85.6)).doubleValue();
        double cardHeightMm = ((Number) body.getOrDefault("cardHeightMm", 54.0)).doubleValue();
        String frontId = (String) body.get("frontId");
        String backId = (String) body.get("backId");

        byte[] frontImage;
        byte[] backImage = null;

        if (frontId != null) {
            frontImage = photoService.getProcessedImage(frontId);
        } else {
            Photo front = photoService.getFrontPhoto();
            if (front == null) {
                throw new ProcessingException("No front photo available for printing.");
            }
            frontImage = front.getProcessedData() != null ? front.getProcessedData() : front.getOriginalData();
        }

        if (backId != null) {
            backImage = photoService.getProcessedImage(backId);
        } else {
            Photo back = photoService.getBackPhoto();
            if (back != null) {
                backImage = back.getProcessedData() != null ? back.getProcessedData() : back.getOriginalData();
            }
        }

        byte[] pdfBytes = pdfService.generatePdf(
                frontImage, backImage, layout, copies, marginMm, cardWidthMm, cardHeightMm
        );

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=id-card-print.pdf")
                .body(pdfBytes);
    }

    /**
     * Health check for the print service.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "healthy"));
    }
}
