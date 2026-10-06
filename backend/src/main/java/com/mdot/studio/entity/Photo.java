package com.mdot.studio.entity;

import com.mdot.studio.dto.CornersDto;
import java.time.Instant;

/**
 * In-memory photo entity representing a photo in the processing queue.
 */
public class Photo {
    private String id;
    private String name;
    private String status; // PENDING, PROCESSING, READY, FAILED, NEEDS_REVIEW
    private String side;   // FRONT, BACK, or null
    private byte[] originalData;
    private byte[] cleanCroppedData;
    private byte[] processedData;
    private int originalWidth;
    private int originalHeight;
    private int processedWidth;
    private int processedHeight;
    private double confidence;
    private String confidenceLevel;
    private String detectionMethod;
    private String message;
    private String fileId;
    private CornersDto corners;
    private Instant createdAt;

    public Photo() {
        this.createdAt = Instant.now();
    }

    // Getters and setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getSide() { return side; }
    public void setSide(String side) { this.side = side; }

    public byte[] getOriginalData() { return originalData; }
    public void setOriginalData(byte[] originalData) { this.originalData = originalData; }

    public byte[] getCleanCroppedData() { return cleanCroppedData; }
    public void setCleanCroppedData(byte[] cleanCroppedData) { this.cleanCroppedData = cleanCroppedData; }

    public byte[] getProcessedData() { return processedData; }
    public void setProcessedData(byte[] processedData) { this.processedData = processedData; }

    public int getOriginalWidth() { return originalWidth; }
    public void setOriginalWidth(int originalWidth) { this.originalWidth = originalWidth; }

    public int getOriginalHeight() { return originalHeight; }
    public void setOriginalHeight(int originalHeight) { this.originalHeight = originalHeight; }

    public int getProcessedWidth() { return processedWidth; }
    public void setProcessedWidth(int processedWidth) { this.processedWidth = processedWidth; }

    public int getProcessedHeight() { return processedHeight; }
    public void setProcessedHeight(int processedHeight) { this.processedHeight = processedHeight; }

    public double getConfidence() { return confidence; }
    public void setConfidence(double confidence) { this.confidence = confidence; }

    public String getConfidenceLevel() { return confidenceLevel; }
    public void setConfidenceLevel(String confidenceLevel) { this.confidenceLevel = confidenceLevel; }

    public String getDetectionMethod() { return detectionMethod; }
    public void setDetectionMethod(String detectionMethod) { this.detectionMethod = detectionMethod; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getFileId() { return fileId; }
    public void setFileId(String fileId) { this.fileId = fileId; }

    public CornersDto getCorners() { return corners; }
    public void setCorners(CornersDto corners) { this.corners = corners; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
