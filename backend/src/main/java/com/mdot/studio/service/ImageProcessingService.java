package com.mdot.studio.service;

import com.mdot.studio.dto.CornersDto;
import com.mdot.studio.dto.PointDto;
import com.mdot.studio.dto.ProcessingResultDto;
import com.mdot.studio.exception.ProcessingException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

/**
 * Service for communicating with the Python image processing service.
 */
@Service
public class ImageProcessingService {

    private static final Logger log = LoggerFactory.getLogger(ImageProcessingService.class);

    private final RestTemplate restTemplate;
    private final String imageServiceUrl;

    public ImageProcessingService(
            RestTemplate restTemplate,
            @Value("${image.service.url}") String imageServiceUrl) {
        this.restTemplate = restTemplate;
        this.imageServiceUrl = imageServiceUrl;
    }

    /**
     * Send image to Python service for full processing pipeline.
     * Returns processed image bytes along with metadata from response headers.
     */
    public ProcessedImageResult processImage(byte[] imageData, String filename) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            ByteArrayResource resource = new ByteArrayResource(imageData) {
                @Override
                public String getFilename() {
                    return filename;
                }
            };

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("image", new HttpEntity<>(resource, createFileHeaders(filename)));

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            ResponseEntity<byte[]> response = restTemplate.exchange(
                    imageServiceUrl + "/process",
                    HttpMethod.POST,
                    requestEntity,
                    byte[].class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                HttpHeaders respHeaders = response.getHeaders();

                String contentType = respHeaders.getFirst(HttpHeaders.CONTENT_TYPE);
                if (contentType != null && contentType.startsWith("image/")) {
                    int origW = getHeaderInt(respHeaders, "X-Original-Width", 0);
                    int origH = getHeaderInt(respHeaders, "X-Original-Height", 0);
                    CornersDto corners = parseCorners(respHeaders, origW, origH);
                    // Success - image returned
                    return new ProcessedImageResult(
                            response.getBody(),
                            getHeaderStr(respHeaders, "X-Processing-Status", "READY"),
                            getHeaderDouble(respHeaders, "X-Confidence", 0.0),
                            getHeaderStr(respHeaders, "X-Confidence-Level", "HIGH"),
                            getHeaderStr(respHeaders, "X-Detection-Method", "OPENCV"),
                            origW,
                            origH,
                            getHeaderInt(respHeaders, "X-Processed-Width", 0),
                            getHeaderInt(respHeaders, "X-Processed-Height", 0),
                            getHeaderStr(respHeaders, "X-File-Id", ""),
                            null,
                            corners
                    );
                } else {
                    // JSON error response from Python service
                    String bodyStr = new String(response.getBody());
                    log.warn("Processing returned non-image response: {}", bodyStr);
                    return new ProcessedImageResult(
                            null, "FAILED", 0.0, "LOW", "NONE",
                            0, 0, 0, 0, "",
                            "Couldn't detect the card clearly. Please upload a clearer photo or adjust the crop.",
                            null
                    );
                }
            }

            return new ProcessedImageResult(
                    null, "FAILED", 0.0, "LOW", "NONE",
                    0, 0, 0, 0, "",
                    "Image processing service returned an error.",
                    null
            );

        } catch (RestClientException e) {
            log.error("Image processing service communication error", e);
            throw new ProcessingException("Image processing service is not available. Please ensure it is running.");
        }
    }

    /**
     * Send image for enhancement only.
     */
    public byte[] enhanceImage(byte[] imageData, String mode, double brightness, double contrast, double sharpness) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            ByteArrayResource resource = new ByteArrayResource(imageData) {
                @Override
                public String getFilename() {
                    return "image.png";
                }
            };

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("image", new HttpEntity<>(resource, createFileHeaders("image.png")));
            body.add("mode", mode);
            body.add("brightness", String.valueOf(brightness));
            body.add("contrast", String.valueOf(contrast));
            body.add("sharpness", String.valueOf(sharpness));

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            ResponseEntity<byte[]> response = restTemplate.exchange(
                    imageServiceUrl + "/enhance",
                    HttpMethod.POST,
                    requestEntity,
                    byte[].class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            }

            throw new ProcessingException("Enhancement failed.");

        } catch (RestClientException e) {
            log.error("Enhancement service error", e);
            throw new ProcessingException("Enhancement service is not available.");
        }
    }

    /**
     * Send image for rotation.
     */
    public byte[] rotateImage(byte[] imageData, int angle) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            ByteArrayResource resource = new ByteArrayResource(imageData) {
                @Override
                public String getFilename() {
                    return "image.png";
                }
            };

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("image", new HttpEntity<>(resource, createFileHeaders("image.png")));
            body.add("angle", String.valueOf(angle));

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            ResponseEntity<byte[]> response = restTemplate.exchange(
                    imageServiceUrl + "/rotate",
                    HttpMethod.POST,
                    requestEntity,
                    byte[].class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            }

            throw new ProcessingException("Rotation failed.");

        } catch (RestClientException e) {
            log.error("Rotation service error", e);
            throw new ProcessingException("Rotation service is not available.");
        }
    }

    public boolean isServiceHealthy() {
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(
                    imageServiceUrl + "/health", String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            return false;
        }
    }

    private HttpHeaders createFileHeaders(String filename) {
        HttpHeaders fileHeaders = new HttpHeaders();
        fileHeaders.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        fileHeaders.setContentDispositionFormData("image", filename);
        return fileHeaders;
    }

    private String getHeaderStr(HttpHeaders headers, String key, String defaultVal) {
        String val = headers.getFirst(key);
        return val != null ? val : defaultVal;
    }

    private double getHeaderDouble(HttpHeaders headers, String key, double defaultVal) {
        String val = headers.getFirst(key);
        if (val != null) {
            try { return Double.parseDouble(val); } catch (NumberFormatException ignored) {}
        }
        return defaultVal;
    }

    private int getHeaderInt(HttpHeaders headers, String key, int defaultVal) {
        String val = headers.getFirst(key);
        if (val != null) {
            try { return Integer.parseInt(val); } catch (NumberFormatException ignored) {}
        }
        return defaultVal;
    }

    /**
     * Send original image for manual crop with 4 corners.
     */
    public ProcessedImageResult cropImage(byte[] imageData, CornersDto corners) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            ByteArrayResource resource = new ByteArrayResource(imageData) {
                @Override
                public String getFilename() {
                    return "image.png";
                }
            };

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("image", new HttpEntity<>(resource, createFileHeaders("image.png")));
            body.add("top_left_x", String.valueOf((int) Math.round(corners.topLeft().x())));
            body.add("top_left_y", String.valueOf((int) Math.round(corners.topLeft().y())));
            body.add("top_right_x", String.valueOf((int) Math.round(corners.topRight().x())));
            body.add("top_right_y", String.valueOf((int) Math.round(corners.topRight().y())));
            body.add("bottom_right_x", String.valueOf((int) Math.round(corners.bottomRight().x())));
            body.add("bottom_right_y", String.valueOf((int) Math.round(corners.bottomRight().y())));
            body.add("bottom_left_x", String.valueOf((int) Math.round(corners.bottomLeft().x())));
            body.add("bottom_left_y", String.valueOf((int) Math.round(corners.bottomLeft().y())));

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            ResponseEntity<byte[]> response = restTemplate.exchange(
                    imageServiceUrl + "/crop",
                    HttpMethod.POST,
                    requestEntity,
                    byte[].class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                HttpHeaders respHeaders = response.getHeaders();
                int procW = getHeaderInt(respHeaders, "X-Processed-Width", 0);
                int procH = getHeaderInt(respHeaders, "X-Processed-Height", 0);
                return new ProcessedImageResult(
                        response.getBody(),
                        "READY",
                        1.0,
                        "HIGH",
                        "MANUAL",
                        0, 0,
                        procW, procH,
                        "",
                        null,
                        corners
                );
            }
            throw new ProcessingException("Manual crop failed.");
        } catch (RestClientException e) {
            log.error("Manual crop service error", e);
            throw new ProcessingException("Manual crop service is not available.");
        }
    }

    private CornersDto parseCorners(HttpHeaders headers, int origW, int origH) {
        String cornersStr = headers.getFirst("X-Corners");
        if (cornersStr != null && !cornersStr.isBlank()) {
            String[] parts = cornersStr.split(",");
            if (parts.length == 8) {
                try {
                    return new CornersDto(
                            new PointDto(Double.parseDouble(parts[0]), Double.parseDouble(parts[1])),
                            new PointDto(Double.parseDouble(parts[2]), Double.parseDouble(parts[3])),
                            new PointDto(Double.parseDouble(parts[4]), Double.parseDouble(parts[5])),
                            new PointDto(Double.parseDouble(parts[6]), Double.parseDouble(parts[7]))
                    );
                } catch (NumberFormatException ignored) {}
            }
        }
        if (origW > 0 && origH > 0) {
            return new CornersDto(
                    new PointDto(0, 0),
                    new PointDto(origW, 0),
                    new PointDto(origW, origH),
                    new PointDto(0, origH)
            );
        }
        return null;
    }

    /**
     * Result container for processed image data and metadata.
     */
    public record ProcessedImageResult(
            byte[] imageData,
            String status,
            double confidence,
            String confidenceLevel,
            String detectionMethod,
            int originalWidth,
            int originalHeight,
            int processedWidth,
            int processedHeight,
            String fileId,
            String message,
            CornersDto corners
    ) {}
}
