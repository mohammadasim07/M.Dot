package com.mdot.studio.controller;

import com.mdot.studio.dto.CornersDto;
import com.mdot.studio.dto.PhotoDto;
import com.mdot.studio.service.PhotoService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/photos")
public class PhotoController {

    private final PhotoService photoService;

    public PhotoController(PhotoService photoService) {
        this.photoService = photoService;
    }

    /**
     * Upload and process a new photo.
     */
    @PostMapping("/process")
    public ResponseEntity<PhotoDto> processPhoto(@RequestParam("image") MultipartFile image) throws IOException {
        if (image.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        String filename = image.getOriginalFilename() != null ? image.getOriginalFilename() : "photo.jpg";
        PhotoDto result = photoService.addPhoto(filename, image.getBytes());
        return ResponseEntity.ok(result);
    }

    /**
     * Get all photos in the queue.
     */
    @GetMapping
    public ResponseEntity<List<PhotoDto>> getAllPhotos() {
        return ResponseEntity.ok(photoService.getAllPhotos());
    }

    /**
     * Get a specific photo's info.
     */
    @GetMapping("/{id}")
    public ResponseEntity<PhotoDto> getPhoto(@PathVariable String id) {
        return ResponseEntity.ok(photoService.getPhotoDto(id));
    }

    /**
     * Get the processed image for a photo.
     */
    @GetMapping("/{id}/image")
    public ResponseEntity<byte[]> getProcessedImage(@PathVariable String id) {
        byte[] imageData = photoService.getProcessedImage(id);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(imageData);
    }

    /**
     * Get the original image for a photo.
     */
    @GetMapping("/{id}/original")
    public ResponseEntity<byte[]> getOriginalImage(@PathVariable String id) {
        byte[] imageData = photoService.getOriginalImage(id);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(imageData);
    }

    /**
     * Set the side (FRONT/BACK) for a photo.
     */
    @PutMapping("/{id}/side")
    public ResponseEntity<PhotoDto> setSide(
            @PathVariable String id,
            @RequestBody Map<String, String> body
    ) {
        String side = body.get("side");
        return ResponseEntity.ok(photoService.setSide(id, side));
    }

    /**
     * Enhance a photo with new settings.
     */
    @PostMapping("/{id}/enhance")
    public ResponseEntity<PhotoDto> enhancePhoto(
            @PathVariable String id,
            @RequestBody Map<String, Object> body
    ) {
        String mode = (String) body.getOrDefault("mode", "AUTO");
        double brightness = ((Number) body.getOrDefault("brightness", 0)).doubleValue();
        double contrast = ((Number) body.getOrDefault("contrast", 0)).doubleValue();
        double sharpness = ((Number) body.getOrDefault("sharpness", 0)).doubleValue();

        return ResponseEntity.ok(photoService.enhancePhoto(id, mode, brightness, contrast, sharpness));
    }

    /**
     * Rotate a photo.
     */
    @PostMapping("/{id}/rotate")
    public ResponseEntity<PhotoDto> rotatePhoto(
            @PathVariable String id,
            @RequestBody Map<String, Integer> body
    ) {
        int angle = body.getOrDefault("angle", 90);
        return ResponseEntity.ok(photoService.rotatePhoto(id, angle));
    }

    /**
     * Apply manual crop with corners.
     */
    @PostMapping("/{id}/crop")
    public ResponseEntity<PhotoDto> cropPhoto(
            @PathVariable String id,
            @RequestBody CornersDto corners
    ) {
        return ResponseEntity.ok(photoService.cropPhoto(id, corners));
    }

    /**
     * Re-run auto detection and crop.
     */
    @PostMapping("/{id}/auto-crop")
    public ResponseEntity<PhotoDto> autoCropPhoto(@PathVariable String id) {
        return ResponseEntity.ok(photoService.reAutoCropPhoto(id));
    }

    /**
     * Duplicate a photo in the queue.
     */
    @PostMapping("/{id}/duplicate")
    public ResponseEntity<PhotoDto> duplicatePhoto(@PathVariable String id) {
        return ResponseEntity.ok(photoService.duplicatePhoto(id));
    }

    /**
     * Remove a photo from the queue.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> removePhoto(@PathVariable String id) {
        photoService.removePhoto(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Clear all photos.
     */
    @DeleteMapping
    public ResponseEntity<Void> clearAll() {
        photoService.clearAll();
        return ResponseEntity.noContent().build();
    }
}
