package com.mdot.studio.service;

import com.mdot.studio.exception.ProcessingException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * PDF generation service for A4 print layouts.
 *
 * A4 dimensions: 210 × 297 mm = 595.28 × 841.89 points (72 DPI)
 * ID card standard: 85.6 × 54 mm
 */
@Service
public class PdfService {

    private static final Logger log = LoggerFactory.getLogger(PdfService.class);

    // A4 in PDF points (1 point = 1/72 inch, 1 inch = 25.4 mm)
    private static final float A4_WIDTH_PT = PDRectangle.A4.getWidth();   // 595.28
    private static final float A4_HEIGHT_PT = PDRectangle.A4.getHeight(); // 841.89

    // Conversion: mm to PDF points
    private static final float MM_TO_PT = 72f / 25.4f; // ~2.8346

    /**
     * Generate an A4 PDF with front and back card images.
     *
     * @param frontImage  Front side image bytes (PNG)
     * @param backImage   Back side image bytes (PNG), nullable
     * @param layout      "SIDE_BY_SIDE" or "TOP_BOTTOM"
     * @param copies      Number of copies per page
     * @param marginMm    Page margin in mm
     * @param cardWidthMm Card width in mm
     * @param cardHeightMm Card height in mm
     * @return PDF bytes
     */
    public byte[] generatePdf(
            byte[] frontImage,
            byte[] backImage,
            String layout,
            int copies,
            double marginMm,
            double cardWidthMm,
            double cardHeightMm
    ) {
        try (PDDocument document = new PDDocument()) {
            float margin = (float) (marginMm * MM_TO_PT);
            float cardW = (float) (cardWidthMm * MM_TO_PT);
            float cardH = (float) (cardHeightMm * MM_TO_PT);

            PDImageXObject frontImg = PDImageXObject.createFromByteArray(document, frontImage, "front");
            PDImageXObject backImg = backImage != null
                    ? PDImageXObject.createFromByteArray(document, backImage, "back")
                    : null;

            for (int copy = 0; copy < copies; copy++) {
                PDPage page = new PDPage(PDRectangle.A4);
                document.addPage(page);

                try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
                    if ("TOP_BOTTOM".equals(layout)) {
                        drawTopBottomLayout(cs, frontImg, backImg, margin, cardW, cardH);
                    } else {
                        drawSideBySideLayout(cs, frontImg, backImg, margin, cardW, cardH);
                    }
                }
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            document.save(baos);
            return baos.toByteArray();

        } catch (IOException e) {
            log.error("PDF generation failed", e);
            throw new ProcessingException("PDF generation failed. Please try again.");
        }
    }

    /**
     * Side by side layout: Front and Back next to each other horizontally, centered on A4.
     */
    private void drawSideBySideLayout(
            PDPageContentStream cs,
            PDImageXObject frontImg,
            PDImageXObject backImg,
            float margin,
            float cardW,
            float cardH
    ) throws IOException {
        float availableW = A4_WIDTH_PT - 2 * margin;
        float availableH = A4_HEIGHT_PT - 2 * margin;

        float spacing = 10 * MM_TO_PT; // 10mm spacing between cards
        int numCards = backImg != null ? 2 : 1;
        float totalCardsW = numCards * cardW + (numCards > 1 ? spacing : 0);

        // Scale down if cards don't fit
        float scale = 1.0f;
        if (totalCardsW > availableW) {
            scale = availableW / totalCardsW;
        }
        if (cardH * scale > availableH) {
            scale = Math.min(scale, availableH / cardH);
        }

        float drawCardW = cardW * scale;
        float drawCardH = cardH * scale;
        float drawSpacing = spacing * scale;

        // Center horizontally and vertically
        float totalW = numCards * drawCardW + (numCards > 1 ? drawSpacing : 0);
        float startX = margin + (availableW - totalW) / 2;
        float startY = margin + (availableH - drawCardH) / 2;

        // PDF coordinate system: origin at bottom-left
        float pdfY = A4_HEIGHT_PT - startY - drawCardH;

        // Draw front
        cs.drawImage(frontImg, startX, pdfY, drawCardW, drawCardH);

        // Draw back
        if (backImg != null) {
            float backX = startX + drawCardW + drawSpacing;
            cs.drawImage(backImg, backX, pdfY, drawCardW, drawCardH);
        }
    }

    /**
     * Top & bottom layout: Front on top, Back below, centered on A4.
     */
    private void drawTopBottomLayout(
            PDPageContentStream cs,
            PDImageXObject frontImg,
            PDImageXObject backImg,
            float margin,
            float cardW,
            float cardH
    ) throws IOException {
        float availableW = A4_WIDTH_PT - 2 * margin;
        float availableH = A4_HEIGHT_PT - 2 * margin;

        float spacing = 10 * MM_TO_PT; // 10mm spacing between cards
        int numCards = backImg != null ? 2 : 1;
        float totalCardsH = numCards * cardH + (numCards > 1 ? spacing : 0);

        // Scale down if cards don't fit
        float scale = 1.0f;
        if (cardW > availableW) {
            scale = availableW / cardW;
        }
        if (totalCardsH * scale > availableH) {
            scale = Math.min(scale, availableH / totalCardsH);
        }

        float drawCardW = cardW * scale;
        float drawCardH = cardH * scale;
        float drawSpacing = spacing * scale;

        // Center horizontally
        float startX = margin + (availableW - drawCardW) / 2;

        // Center vertically
        float totalH = numCards * drawCardH + (numCards > 1 ? drawSpacing : 0);
        float startY = margin + (availableH - totalH) / 2;

        // PDF coordinate system: origin at bottom-left
        // Front on top
        float frontPdfY = A4_HEIGHT_PT - startY - drawCardH;
        cs.drawImage(frontImg, startX, frontPdfY, drawCardW, drawCardH);

        // Back below
        if (backImg != null) {
            float backPdfY = frontPdfY - drawSpacing - drawCardH;
            cs.drawImage(backImg, startX, backPdfY, drawCardW, drawCardH);
        }
    }
}
