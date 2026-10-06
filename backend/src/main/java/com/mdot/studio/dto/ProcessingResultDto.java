package com.mdot.studio.dto;

public record ProcessingResultDto(
    String status,
    double confidence,
    String confidenceLevel,
    String detectionMethod,
    CornersDto corners,
    boolean perspectiveCorrected,
    boolean enhanced,
    int originalWidth,
    int originalHeight,
    int processedWidth,
    int processedHeight,
    String message,
    String fileId
) {}
