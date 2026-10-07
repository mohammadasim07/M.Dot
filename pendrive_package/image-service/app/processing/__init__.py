"""Image processing: perspective correction, de-skewing, and cropping."""
import cv2
import numpy as np
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)

ISO_ID1_RATIO = 85.60 / 53.98  # Standard ISO/IEC 7810 ID-1 ratio ~1.58577


def perspective_transform(
    image: np.ndarray, 
    corners: List[Tuple[float, float]],
    normalize_id_ratio: bool = True
) -> np.ndarray:
    """
    Apply perspective correction using four detected corners.
    Straightens and de-skews an ID card photographed at an angle.
    Corners must be ordered: Top-Left, Top-Right, Bottom-Right, Bottom-Left.
    
    If the card aspect ratio matches standard ID-1 card proportions (1.20 to 1.95),
    perspective foreshortening is corrected to restore true physical proportions
    so the card is never squashed or stretched on the printed page.
    """
    tl, tr, br, bl = corners
    
    # Calculate measured edge lengths in image projection
    width_top = np.sqrt((tr[0] - tl[0])**2 + (tr[1] - tl[1])**2)
    width_bottom = np.sqrt((br[0] - bl[0])**2 + (br[1] - bl[1])**2)
    w_est = max(width_top, width_bottom)
    
    height_left = np.sqrt((bl[0] - tl[0])**2 + (bl[1] - tl[1])**2)
    height_right = np.sqrt((br[0] - tr[0])**2 + (br[1] - tr[1])**2)
    h_est = max(height_left, height_right)
    
    if w_est <= 5 or h_est <= 5:
        raise ValueError("Invalid corner coordinates for perspective transform")
    
    aspect_est = max(w_est, h_est) / min(w_est, h_est)
    
    # Check if aspect ratio matches standard ID-card format (ISO/IEC 7810 ID-1)
    if normalize_id_ratio and (1.20 <= aspect_est <= 1.95):
        if w_est >= h_est:
            # Landscape orientation
            target_w = int(max(w_est, round(h_est * ISO_ID1_RATIO)))
            target_h = int(round(target_w / ISO_ID1_RATIO))
        else:
            # Portrait orientation
            target_h = int(max(h_est, round(w_est * ISO_ID1_RATIO)))
            target_w = int(round(target_h / ISO_ID1_RATIO))
    else:
        target_w = int(max(10, round(w_est)))
        target_h = int(max(10, round(h_est)))
    
    # Source points (detected corners in original image)
    src_pts = np.array([tl, tr, br, bl], dtype=np.float32)
    
    # Destination points (perfect upright rectangle)
    dst_pts = np.array([
        [0, 0],
        [target_w - 1, 0],
        [target_w - 1, target_h - 1],
        [0, target_h - 1]
    ], dtype=np.float32)
    
    # Compute homography / perspective transformation matrix
    matrix = cv2.getPerspectiveTransform(src_pts, dst_pts)
    
    # Warp with bicubic interpolation on high-res original for print shop quality
    result = cv2.warpPerspective(
        image, matrix, (target_w, target_h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE
    )
    
    logger.info(f"Perspective transform: {image.shape[:2]} -> {result.shape[:2]} (ratio: {target_w/target_h:.3f})")
    return result


def scale_corners_to_original(
    corners: List[Tuple[float, float]], 
    scale_x: float, 
    scale_y: float
) -> List[Tuple[int, int]]:
    """Scale corners from inference resolution to original resolution."""
    return [(int(round(x * scale_x)), int(round(y * scale_y))) for x, y in corners]


def rotate_image(image: np.ndarray, angle: int) -> np.ndarray:
    """Rotate image by 90, 180, or 270 degrees."""
    if angle == 90:
        return cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    elif angle == 180:
        return cv2.rotate(image, cv2.ROTATE_180)
    elif angle == 270:
        return cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return image


def manual_crop(image: np.ndarray, corners: List[Tuple[float, float]]) -> np.ndarray:
    """Crop image using manually specified corners with perspective correction."""
    return perspective_transform(image, corners, normalize_id_ratio=True)
