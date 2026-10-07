"""Image utility functions."""
import cv2
import numpy as np
from PIL import Image, ExifTags
import io
import logging

logger = logging.getLogger(__name__)


def read_image_bytes(image_bytes: bytes) -> np.ndarray:
    """Read image from bytes, applying EXIF orientation correction."""
    pil_image = Image.open(io.BytesIO(image_bytes))
    pil_image = correct_exif_orientation(pil_image)
    
    if pil_image.mode == 'RGBA':
        pil_image = pil_image.convert('RGB')
    elif pil_image.mode != 'RGB':
        pil_image = pil_image.convert('RGB')
    
    img_array = np.array(pil_image)
    return cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)


def correct_exif_orientation(image: Image.Image) -> Image.Image:
    """Correct image orientation based on EXIF data."""
    try:
        exif = image._getexif()
        if exif is None:
            return image
        
        orientation_key = None
        for key, val in ExifTags.TAGS.items():
            if val == 'Orientation':
                orientation_key = key
                break
        
        if orientation_key is None or orientation_key not in exif:
            return image
        
        orientation = exif[orientation_key]
        
        if orientation == 2:
            image = image.transpose(Image.FLIP_LEFT_RIGHT)
        elif orientation == 3:
            image = image.rotate(180, expand=True)
        elif orientation == 4:
            image = image.transpose(Image.FLIP_TOP_BOTTOM)
        elif orientation == 5:
            image = image.rotate(-90, expand=True).transpose(Image.FLIP_LEFT_RIGHT)
        elif orientation == 6:
            image = image.rotate(-90, expand=True)
        elif orientation == 7:
            image = image.rotate(90, expand=True).transpose(Image.FLIP_LEFT_RIGHT)
        elif orientation == 8:
            image = image.rotate(90, expand=True)
    except Exception as e:
        logger.debug(f"EXIF orientation correction skipped: {e}")
    
    return image


def create_inference_copy(image: np.ndarray, max_size: int = 960) -> tuple:
    """Create a smaller copy for detection inference, return (resized, scale_x, scale_y)."""
    h, w = image.shape[:2]
    
    if max(h, w) <= max_size:
        return image.copy(), 1.0, 1.0
    
    if w > h:
        new_w = max_size
        new_h = int(h * (max_size / w))
    else:
        new_h = max_size
        new_w = int(w * (max_size / h))
    
    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    scale_x = w / new_w
    scale_y = h / new_h
    
    return resized, scale_x, scale_y


def encode_image_to_bytes(image: np.ndarray, format: str = "PNG", quality: int = 95) -> bytes:
    """Encode OpenCV image to bytes quickly."""
    if format.upper() == "PNG":
        _, buffer = cv2.imencode('.png', image, [cv2.IMWRITE_PNG_COMPRESSION, 1])
    else:
        _, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buffer.tobytes()


def scale_corners(corners: list, scale_x: float, scale_y: float) -> list:
    """Scale corner coordinates back to original image size."""
    return [
        (int(round(x * scale_x)), int(round(y * scale_y)))
        for x, y in corners
    ]


def validate_quadrilateral(corners: list, image_shape: tuple) -> dict:
    """Validate detected quadrilateral geometry. Returns validation result."""
    if len(corners) != 4:
        return {"valid": False, "reason": "Not exactly 4 corners"}
    
    h, w = image_shape[:2]
    image_area = float(h * w)
    
    # Check corners are within image bounds (with small 3% tolerance)
    margin = max(w, h) * 0.03
    for x, y in corners:
        if x < -margin or y < -margin or x > w + margin or y > h + margin:
            return {"valid": False, "reason": "Corners outside image bounds"}
    
    # Calculate quadrilateral area
    corners_array = np.array(corners, dtype=np.float32)
    quad_area = float(cv2.contourArea(corners_array))
    
    # Area should be at least 4% of image
    area_ratio = quad_area / image_area
    if area_ratio < 0.04:
        return {"valid": False, "reason": "Detected area too small"}
    
    widths = [
        np.linalg.norm(corners_array[1] - corners_array[0]),
        np.linalg.norm(corners_array[2] - corners_array[3])
    ]
    heights = [
        np.linalg.norm(corners_array[3] - corners_array[0]),
        np.linalg.norm(corners_array[2] - corners_array[1])
    ]
    
    avg_width = float(np.mean(widths))
    avg_height = float(np.mean(heights))
    
    if avg_height == 0:
        return {"valid": False, "reason": "Zero height detected"}
    
    aspect_ratio = avg_width / avg_height
    if aspect_ratio < 0.25 or aspect_ratio > 4.0:
        return {"valid": False, "reason": "Aspect ratio unlikely for a card/document"}
    
    # Check convexity
    if not cv2.isContourConvex(corners_array.astype(np.int32)):
        return {"valid": False, "reason": "Detected shape is not convex"}
    
    return {
        "valid": True,
        "area_ratio": area_ratio,
        "aspect_ratio": aspect_ratio,
        "quad_area": quad_area
    }


def order_corners(corners: list) -> list:
    """
    Order 4 corners clockwise starting from Top-Left:
    Top-Left, Top-Right, Bottom-Right, Bottom-Left.
    Invariant to skew, tilt, and angle.
    """
    pts = np.array(corners, dtype=np.float32)
    center = np.mean(pts, axis=0)
    angles = np.arctan2(pts[:, 1] - center[1], pts[:, 0] - center[0])
    
    # Sort points radially
    sort_idx = np.argsort(angles)
    pts_sorted = pts[sort_idx]
    
    # Top-Left has smallest sum of coordinates (x + y)
    s = pts_sorted[:, 0] + pts_sorted[:, 1]
    tl_idx = np.argmin(s)
    
    # Shift so TL is at index 0
    ordered = np.roll(pts_sorted, -tl_idx, axis=0)
    
    # Ensure clockwise orientation
    v1 = ordered[1] - ordered[0]
    v2 = ordered[2] - ordered[1]
    cross = v1[0] * v2[1] - v1[1] * v2[0]
    if cross < 0:
        # Counter-clockwise -> swap index 1 and 3
        ordered = np.array([ordered[0], ordered[3], ordered[2], ordered[1]])
        
    return [(int(round(x)), int(round(y))) for x, y in ordered]
