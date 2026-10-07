"""Image enhancement: deterministic, safe processing for identity documents and ScamCanner filter."""
import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)


def scamcanner_filter(image: np.ndarray, block_size: int = 15, offset: int = 6) -> np.ndarray:
    """
    CamScanner / ScamCanner document threshold filter.
    Reference: https://github.com/Cypre55/ScamCanner/blob/master/transform.py
    
    Transforms the document using local adaptive Gaussian thresholding:
      T = threshold_local(warped, 11, offset = 5, method = "gaussian")
      warped = (warped > T).astype("uint8") * 255
    Eliminates shadows, uneven room lighting, and produces a clean, high-contrast document scan.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    # Bilateral smoothing to remove noise while preserving crisp text edges
    blurred = cv2.bilateralFilter(gray, 5, 40, 40)
    bs = block_size if block_size % 2 == 1 else block_size + 1
    bs = max(3, bs)
    
    bw = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        bs,
        offset
    )
    return cv2.cvtColor(bw, cv2.COLOR_GRAY2BGR)


def enhance_auto(image: np.ndarray) -> np.ndarray:
    """
    CamScanner / ScamCanner document auto-enhancement:
    Cleans background shadows and lighting gradients while preserving vibrant photo and sharp text.
    """
    result = image.copy()
    
    # 1. Background illumination normalization (CamScanner shadow removal)
    bg = cv2.GaussianBlur(result, (35, 35), 0).astype(np.float32) + 1.0
    normalized = np.clip((result.astype(np.float32) / bg) * 235.0, 0, 255).astype(np.uint8)
    
    # 2. Local contrast enhancement with CLAHE
    lab = cv2.cvtColor(normalized, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    enhanced = cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2BGR)
    
    # 3. Text edge sharpening
    sharpened = apply_sharpening(enhanced, 25)
    
    # 4. Fast bilateral filter to reduce camera sensor noise
    return reduce_noise(sharpened)


def enhance_document(image: np.ndarray) -> np.ndarray:
    """Optimize for document readability with CamScanner shadow-removal."""
    result = image.copy()
    
    # CamScanner background illumination division to eliminate shadows
    bg = cv2.GaussianBlur(result, (35, 35), 0).astype(np.float32) + 1.0
    normalized = np.clip((result.astype(np.float32) / bg) * 240.0, 0, 255).astype(np.uint8)
    
    # Text contrast and sharpening
    contrast = adjust_contrast(normalized, 25)
    sharpened = apply_sharpening(contrast, 35)
    return sharpened


def to_grayscale(image: np.ndarray) -> np.ndarray:
    """Convert to grayscale (3-channel for consistency)."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def to_black_and_white(image: np.ndarray) -> np.ndarray:
    """Convert to crisp black and white using ScamCanner adaptive local thresholding."""
    return scamcanner_filter(image, block_size=19, offset=8)


def normalize_brightness(image: np.ndarray, target: int = 170) -> np.ndarray:
    """Normalize overall brightness without destroying detail."""
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel = lab[:, :, 0].astype(np.float32)
    
    current_mean = l_channel.mean()
    if current_mean == 0:
        return image
    
    # Gentle adjustment
    ratio = target / current_mean
    ratio = np.clip(ratio, 0.7, 1.4)  # Limit adjustment range
    
    l_channel = np.clip(l_channel * ratio, 0, 255).astype(np.uint8)
    lab[:, :, 0] = l_channel
    
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)


def adjust_brightness(image: np.ndarray, value: float) -> np.ndarray:
    """Adjust brightness. Value range: -100 to 100."""
    value = np.clip(value, -100, 100)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[:, :, 2] = np.clip(hsv[:, :, 2] + value, 0, 255)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def adjust_contrast(image: np.ndarray, value: float) -> np.ndarray:
    """Adjust contrast. Value range: -100 to 100."""
    value = np.clip(value, -100, 100)
    factor = (259 * (value + 255)) / (255 * (259 - value))
    
    result = image.astype(np.float32)
    result = factor * (result - 128) + 128
    return np.clip(result, 0, 255).astype(np.uint8)


def apply_sharpening(image: np.ndarray, strength: float = 30) -> np.ndarray:
    """Apply controlled sharpening. Strength: 0-100."""
    strength = np.clip(strength, 0, 100)
    if strength <= 0:
        return image
    
    # Unsharp mask
    sigma = 1.0
    blurred = cv2.GaussianBlur(image, (0, 0), sigma)
    
    amount = (strength / 100.0) * 1.5  # Max 1.5x sharpening
    sharpened = cv2.addWeighted(image, 1.0 + amount, blurred, -amount, 0)
    
    return np.clip(sharpened, 0, 255).astype(np.uint8)


def reduce_noise(image: np.ndarray, strength: int = 5) -> np.ndarray:
    """Fast bilateral noise reduction that preserves sharp text and edges without CPU lag."""
    d = 5
    sigma = min(60, max(20, strength * 8))
    return cv2.bilateralFilter(image, d, sigma, sigma)


def reduce_shadows(image: np.ndarray) -> np.ndarray:
    """Reduce shadows for better document readability."""
    rgb_planes = cv2.split(image)
    result_planes = []
    
    for plane in rgb_planes:
        dilated = cv2.dilate(plane, np.ones((7, 7), np.uint8))
        bg = cv2.medianBlur(dilated, 21)
        diff = 255 - cv2.absdiff(plane, bg)
        result_planes.append(cv2.normalize(diff, None, 0, 255, cv2.NORM_MINMAX))
    
    return cv2.merge(result_planes)


def apply_enhancement(image: np.ndarray, mode: str = "AUTO", 
                      brightness: float = 0, contrast: float = 0, 
                      sharpness: float = 0) -> np.ndarray:
    """Apply enhancement based on mode and manual adjustments.
    Supports both percentage values (50-150 where 100 is normal) and signed offsets (-50 to +50).
    """
    mode_upper = (mode or "AUTO").upper()
    
    # Apply mode-based preset first
    if mode_upper in ("SCAMCANNER", "SCAN", "CAMSCANNER"):
        result = scamcanner_filter(image)
    elif mode_upper == "AUTO":
        result = enhance_auto(image)
    elif mode_upper == "DOCUMENT":
        result = enhance_document(image)
    elif mode_upper == "GRAYSCALE":
        result = to_grayscale(image)
    elif mode_upper in ("BLACK_AND_WHITE", "B&W"):
        result = to_black_and_white(image)
    else:  # ORIGINAL
        result = image.copy()
    
    # Normalize brightness input: if given as percentage 50..150, convert to offset -50..+50
    b_val = brightness
    if 40 <= b_val <= 160 and b_val != 0:
        b_val = b_val - 100.0
    
    # Normalize contrast input: if given as percentage 50..150, convert to offset -50..+50
    c_val = contrast
    if 40 <= c_val <= 160 and c_val != 0:
        c_val = c_val - 100.0
        
    # Normalize sharpness input: if given as percentage 50..150, convert to 0..100
    s_val = sharpness
    if s_val > 100:
        s_val = min(100.0, s_val - 100.0)
    elif s_val < 0:
        s_val = 0.0
    
    if b_val != 0:
        result = adjust_brightness(result, b_val)
    if c_val != 0:
        result = adjust_contrast(result, c_val)
    if s_val != 0:
        result = apply_sharpening(result, s_val)
    
    return result
