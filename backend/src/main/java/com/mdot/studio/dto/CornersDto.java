package com.mdot.studio.dto;

public record CornersDto(
    PointDto topLeft,
    PointDto topRight,
    PointDto bottomRight,
    PointDto bottomLeft
) {}
