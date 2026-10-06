package com.mdot.studio.service;

import com.mdot.studio.dto.CornersDto;
import com.mdot.studio.dto.PhotoDto;
import com.mdot.studio.entity.Photo;
import com.mdot.studio.exception.PhotoNotFoundException;
import com.mdot.studio.exception.ProcessingException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.*;

/**
 * Manages photo queue, processing, and session state.
 */
@Service
public class PhotoService {

    private static final Logger log = LoggerFactory.getLogger(PhotoService.class);

    private final ImageProcessingService imageProcessingService;
    private final Map<String, Photo> photos = new ConcurrentHashMap<>();
    private final ExecutorService processingPool = Executors.newFixedThreadPool(
            Math.max(2, Runtime.getRuntime().availableProcessors() / 2)
    );

    public PhotoService(ImageProcessingService imageProcessingService) {
        this.imageProcessingService = imageProcessingService;
    }

    /**
     * Add a photo to the queue and start async processing.
     */
    public PhotoDto addPhoto(String name, byte[] imageData) {
        String id = UUID.randomUUID().toString();

        Photo photo = new Photo();
        photo.setId(id);
        photo.setName(name);
        photo.setStatus("PROCESSING");
        photo.setOriginalData(imageData);

        photos.put(id, photo);

        // Process synchronously so client immediately gets the detected & cropped card
        processPhoto(id);

        return toDto(photo);
    }

    /**
     * Get all photos as DTOs.
     */
    public List<PhotoDto> getAllPhotos() {
        return photos.values().stream()
                .sorted(Comparator.comparing(Photo::getCreatedAt))
                .map(this::toDto)
                .toList();
    }

    /**
     * Get a specific photo.
     */
    public Photo getPhoto(String id) {
        Photo photo = photos.get(id);
        if (photo == null) throw new PhotoNotFoundException(id);
        return photo;
    }

    public PhotoDto getPhotoDto(String id) {
        return toDto(getPhoto(id));
    }

    /**
     * Get the processed image bytes for a photo.
     */
    public byte[] getProcessedImage(String id) {
        Photo photo = getPhoto(id);
        if (photo.getProcessedData() != null) {
            return photo.getProcessedData();
        }
        if (photo.getOriginalData() != null) {
            return photo.getOriginalData();
        }
        throw new ProcessingException("No image data available for this photo.");
    }

    /**
     * Get the original image bytes for a photo.
     */
    public byte[] getOriginalImage(String id) {
        Photo photo = getPhoto(id);
        if (photo.getOriginalData() == null) {
            throw new ProcessingException("No original image data available.");
        }
        return photo.getOriginalData();
    }

    /**
     * Set the side (FRONT/BACK) for a photo.
     */
    public PhotoDto setSide(String id, String side) {
        Photo photo = getPhoto(id);
        photo.setSide(side);
        return toDto(photo);
    }

    /**
     * Remove a photo from the queue.
     */
    public void removePhoto(String id) {
        photos.remove(id);
    }

    /**
     * Clear all photos.
     */
    public void clearAll() {
        photos.clear();
    }

    /**
     * Enhance a photo with new settings.
     */
    public PhotoDto enhancePhoto(String id, String mode, double brightness, double contrast, double sharpness) {
        Photo photo = getPhoto(id);

        byte[] sourceData = photo.getCleanCroppedData() != null 
                ? photo.getCleanCroppedData() 
                : (photo.getProcessedData() != null ? photo.getProcessedData() : photo.getOriginalData());
        if (sourceData == null) {
            throw new ProcessingException("No image to enhance.");
        }

        // Normalize brightness: if user sent percentage 50..150, convert to offset -50..+50
        double bOffset = brightness;
        if (bOffset >= 40 && bOffset <= 160 && bOffset != 0) {
            bOffset = bOffset - 100.0;
        }

        // Normalize contrast: if user sent percentage 50..150, convert to offset -50..+50
        double cOffset = contrast;
        if (cOffset >= 40 && cOffset <= 160 && cOffset != 0) {
            cOffset = cOffset - 100.0;
        }

        // Normalize sharpness: 0..100
        double sVal = sharpness;
        if (sVal > 100) {
            sVal = Math.min(100.0, sVal - 100.0);
        } else if (sVal < 0) {
            sVal = 0.0;
        }

        // If resetting to ORIGINAL with neutral adjustments, restore clean cropped image directly
        if ("ORIGINAL".equalsIgnoreCase(mode) && bOffset == 0 && cOffset == 0 && sVal == 0 && photo.getCleanCroppedData() != null) {
            photo.setProcessedData(photo.getCleanCroppedData());
            return toDto(photo);
        }

        byte[] enhanced = imageProcessingService.enhanceImage(sourceData, mode, bOffset, cOffset, sVal);
        photo.setProcessedData(enhanced);

        return toDto(photo);
    }

    /**
     * Rotate a photo.
     */
    public PhotoDto rotatePhoto(String id, int angle) {
        Photo photo = getPhoto(id);

        byte[] data = photo.getProcessedData() != null ? photo.getProcessedData() : photo.getOriginalData();
        if (data == null) {
            throw new ProcessingException("No image data to rotate.");
        }

        byte[] rotated = imageProcessingService.rotateImage(data, angle);
        photo.setProcessedData(rotated);

        if (photo.getCleanCroppedData() != null) {
            byte[] rotatedCropped = imageProcessingService.rotateImage(photo.getCleanCroppedData(), angle);
            photo.setCleanCroppedData(rotatedCropped);
        }

        // Swap processed width and height
        int tempW = photo.getProcessedWidth();
        photo.setProcessedWidth(photo.getProcessedHeight());
        photo.setProcessedHeight(tempW);

        return toDto(photo);
    }

    /**
     * Get front photo (first photo with side=FRONT, or first photo).
     */
    public Photo getFrontPhoto() {
        return photos.values().stream()
                .filter(p -> "FRONT".equals(p.getSide()))
                .findFirst()
                .orElse(photos.values().stream()
                        .sorted(Comparator.comparing(Photo::getCreatedAt))
                        .findFirst()
                        .orElse(null));
    }

    /**
     * Get back photo (first photo with side=BACK, or second photo).
     */
    public Photo getBackPhoto() {
        return photos.values().stream()
                .filter(p -> "BACK".equals(p.getSide()))
                .findFirst()
                .orElse(photos.values().stream()
                        .sorted(Comparator.comparing(Photo::getCreatedAt))
                        .skip(1)
                        .findFirst()
                        .orElse(null));
    }

    /**
     * Perform manual crop with perspective transformation using given 4 corners.
     */
    public PhotoDto cropPhoto(String id, CornersDto corners) {
        Photo photo = getPhoto(id);
        byte[] original = photo.getOriginalData();
        if (original == null) {
            throw new ProcessingException("No original image data available for crop.");
        }
        var result = imageProcessingService.cropImage(original, corners);
        photo.setProcessedData(result.imageData());
        photo.setCleanCroppedData(result.imageData());
        photo.setStatus("READY");
        photo.setConfidence(1.0);
        photo.setConfidenceLevel("HIGH");
        photo.setDetectionMethod("MANUAL");
        photo.setCorners(corners);
        if (result.processedWidth() > 0) photo.setProcessedWidth(result.processedWidth());
        if (result.processedHeight() > 0) photo.setProcessedHeight(result.processedHeight());
        return toDto(photo);
    }

    /**
     * Re-run automatic detection and crop on original image.
     */
    public PhotoDto reAutoCropPhoto(String id) {
        processPhoto(id);
        return toDto(getPhoto(id));
    }

    /**
     * Duplicate a photo in the queue.
     */
    public PhotoDto duplicatePhoto(String id) {
        Photo original = getPhoto(id);
        String newId = UUID.randomUUID().toString();
        Photo duplicate = new Photo();
        duplicate.setId(newId);
        duplicate.setName(original.getName() + " (Copy)");
        duplicate.setStatus(original.getStatus());
        duplicate.setSide(original.getSide() == null ? null : (original.getSide().equals("FRONT") ? "BACK" : "FRONT"));
        duplicate.setOriginalData(original.getOriginalData());
        duplicate.setCleanCroppedData(original.getCleanCroppedData());
        duplicate.setProcessedData(original.getProcessedData());
        duplicate.setOriginalWidth(original.getOriginalWidth());
        duplicate.setOriginalHeight(original.getOriginalHeight());
        duplicate.setProcessedWidth(original.getProcessedWidth());
        duplicate.setProcessedHeight(original.getProcessedHeight());
        duplicate.setConfidence(original.getConfidence());
        duplicate.setConfidenceLevel(original.getConfidenceLevel());
        duplicate.setDetectionMethod(original.getDetectionMethod());
        duplicate.setCorners(original.getCorners());
        duplicate.setMessage(original.getMessage());

        photos.put(newId, duplicate);
        return toDto(duplicate);
    }

    private void processPhoto(String id) {
        Photo photo = photos.get(id);
        if (photo == null) return;

        try {
            log.info("Processing photo: {} ({})", id, photo.getName());

            var result = imageProcessingService.processImage(photo.getOriginalData(), photo.getName());

            if (result.imageData() != null) {
                photo.setProcessedData(result.imageData());
                photo.setCleanCroppedData(result.imageData());
                photo.setStatus(result.status());
            } else {
                photo.setStatus("FAILED");
            }

            photo.setConfidence(result.confidence());
            photo.setConfidenceLevel(result.confidenceLevel());
            photo.setDetectionMethod(result.detectionMethod());
            photo.setOriginalWidth(result.originalWidth());
            photo.setOriginalHeight(result.originalHeight());
            photo.setProcessedWidth(result.processedWidth());
            photo.setProcessedHeight(result.processedHeight());
            photo.setFileId(result.fileId());
            photo.setMessage(result.message());
            photo.setCorners(result.corners());

            log.info("Photo processed: {} status={} confidence={}", id, photo.getStatus(), photo.getConfidence());

        } catch (Exception e) {
            log.error("Failed to process photo: {}", id, e);
            photo.setStatus("FAILED");
            photo.setMessage("Processing failed. Please try again.");
        }
    }

    private PhotoDto toDto(Photo photo) {
        return new PhotoDto(
                photo.getId(),
                photo.getName(),
                photo.getStatus(),
                photo.getSide(),
                photo.getOriginalWidth(),
                photo.getOriginalHeight(),
                photo.getProcessedWidth(),
                photo.getProcessedHeight(),
                photo.getConfidence(),
                photo.getConfidenceLevel(),
                photo.getDetectionMethod(),
                photo.getMessage(),
                photo.getCorners()
        );
    }
}
