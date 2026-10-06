package com.mdot.studio.dto;

import jakarta.validation.constraints.NotNull;

public record EnhanceRequestDto(
    @NotNull String mode,
    double brightness,
    double contrast,
    double sharpness
) {
    public EnhanceRequestDto {
        if (mode == null) mode = "AUTO";
    }
}
