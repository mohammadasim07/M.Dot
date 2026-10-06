package com.mdot.studio.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record PrintRequestDto(
    @NotNull String layout,
    @Min(1) int copies,
    double marginMm,
    double cardWidthMm,
    double cardHeightMm
) {
    public PrintRequestDto {
        if (layout == null) layout = "SIDE_BY_SIDE";
        if (copies < 1) copies = 1;
        if (marginMm <= 0) marginMm = 5.0;
        if (cardWidthMm <= 0) cardWidthMm = 85.6;
        if (cardHeightMm <= 0) cardHeightMm = 54.0;
    }
}
