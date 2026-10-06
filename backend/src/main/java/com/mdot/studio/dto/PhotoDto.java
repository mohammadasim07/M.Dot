package com.mdot.studio.dto;

public record PhotoDto(
    String id,
    String name,
    String status,
    String side,
    int originalWidth,
    int originalHeight,
    int processedWidth,
    int processedHeight,
    double confidence,
    String confidenceLevel,
    String detectionMethod,
    String message,
    CornersDto corners
) {}
