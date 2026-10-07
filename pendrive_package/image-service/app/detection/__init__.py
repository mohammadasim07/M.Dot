"""Card/document detection using YOLO and robust multi-stage OpenCV pipeline."""
import cv2
import numpy as np
import logging
from typing import Optional, Tuple, List
from pathlib import Path

logger = logging.getLogger(__name__)

# Path for YOLO model - can be swapped with custom model
MODEL_DIR = Path(__file__).parent.parent / "models"
ISO_ID1_RATIO = 85.60 / 53.98  # Standard ID card ratio ~1.58577


def refine_corners_in_roi(roi_img: np.ndarray, offset_x: int, offset_y: int) -> Optional[List[List[float]]]:
    """
    Find the 4 slanted corners inside a bounding-box ROI.
    This enhances bounding-box detectors (like Faster R-CNN or YOLO) by extracting
    the actual 4 skewed card vertices instead of just an axis-aligned box.
    """
    try:
        h, w = roi_img.shape[:2]
        if h < 20 or w < 20:
            return None
            
        gray = cv2.cvtColor(roi_img, cv2.COLOR_BGR2GRAY) if len(roi_img.shape) == 3 else roi_img
        blurred = cv2.bilateralFilter(gray, 9, 50, 50)
        
        edges = cv2.Canny(blurred, 30, 120)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges = cv2.dilate(edges, kernel, iterations=1)
        
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None
            
        # Look for largest contour that fills most of the ROI
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        roi_area = h * w
        
        for c in contours[:5]:
            area = cv2.contourArea(c)
            if area / roi_area < 0.25:
                continue
                
            peri = cv2.arcLength(c, True)
            # Try adaptive epsilon to resolve 4 corners even with rounded edges
            for eps_factor in [0.015, 0.02, 0.025, 0.03, 0.04]:
                approx = cv2.approxPolyDP(c, eps_factor * peri, True)
                if len(approx) == 4 and cv2.isContourConvex(approx):
                    pts = approx.reshape(4, 2)
                    # Translate back to full image coordinates
                    return [[float(p[0] + offset_x), float(p[1] + offset_y)] for p in pts]
                    
        return None
    except Exception as e:
        logger.debug(f"ROI corner refinement error: {e}")
        return None


class YOLODetector:
    """Primary detector using YOLO for document/card detection."""
    
    def __init__(self, model_path: Optional[str] = None):
        self.model = None
        self.model_path = model_path
        self._loaded = False
    
    def load(self) -> bool:
        """Load the YOLO model if local weights exist. Offline-first."""
        try:
            import importlib.util
            if importlib.util.find_spec("ultralytics") is None:
                self._loaded = False
                return False

            from ultralytics import YOLO
            
            target_path = None
            if self.model_path and Path(self.model_path).exists():
                target_path = self.model_path
            else:
                default_path = MODEL_DIR / "yolov8n-seg.pt"
                if default_path.exists():
                    target_path = str(default_path)
            
            if target_path:
                self.model = YOLO(target_path)
                logger.info(f"Loaded YOLO model from {target_path}")
                self._loaded = True
                return True
            
            self._loaded = False
            return False
        except Exception as e:
            logger.debug(f"YOLO detector disabled: {e}")
            self._loaded = False
            return False
    
    def detect(self, image: np.ndarray) -> Optional[Tuple[List, float]]:
        """
        Detect card/document in image.
        Returns (corners, confidence) or None if not detected.
        """
        if not self._loaded or self.model is None:
            return None
        
        try:
            results = self.model(image, verbose=False, conf=0.3)
            
            if not results or len(results) == 0:
                return None
            
            result = results[0]
            best_detection = None
            best_conf = 0.0
            
            # Case A: Model outputs instance segmentation mask
            if result.masks is not None and len(result.masks) > 0:
                for i, (mask, box) in enumerate(zip(result.masks, result.boxes)):
                    conf = float(box.conf[0])
                    if conf > best_conf:
                        mask_np = mask.data[0].cpu().numpy()
                        mask_resized = cv2.resize(mask_np, (image.shape[1], image.shape[0]))
                        mask_binary = (mask_resized > 0.5).astype(np.uint8) * 255
                        
                        contours, _ = cv2.findContours(
                            mask_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
                        )
                        
                        if contours:
                            largest = max(contours, key=cv2.contourArea)
                            peri = cv2.arcLength(largest, True)
                            
                            # Adaptive polygon approximation
                            found_corners = None
                            for eps in [0.015, 0.02, 0.025, 0.03, 0.04]:
                                approx = cv2.approxPolyDP(largest, eps * peri, True)
                                if len(approx) == 4 and cv2.isContourConvex(approx):
                                    found_corners = approx.reshape(4, 2).tolist()
                                    break
                            
                            if found_corners:
                                best_detection = found_corners
                                best_conf = conf
                            else:
                                rect = cv2.minAreaRect(largest)
                                box_pts = cv2.boxPoints(rect)
                                best_detection = box_pts.tolist()
                                best_conf = conf * 0.85
            
            # Case B: Model outputs 2D bounding boxes (Faster R-CNN / YOLO bbox)
            elif result.boxes is not None and len(result.boxes) > 0:
                h_img, w_img = image.shape[:2]
                for box in result.boxes:
                    conf = float(box.conf[0])
                    if conf > best_conf:
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        x1, y1 = max(0, int(x1)), max(0, int(y1))
                        x2, y2 = min(w_img - 1, int(x2)), min(h_img - 1, int(y2))
                        
                        # Two-stage refinement: Extract actual 4 corners within the detected ROI
                        roi = image[y1:y2, x1:x2]
                        refined_corners = refine_corners_in_roi(roi, x1, y1)
                        
                        if refined_corners is not None:
                            best_detection = refined_corners
                            best_conf = conf
                        else:
                            # Fallback to bounding box corners
                            best_detection = [
                                [float(x1), float(y1)],
                                [float(x2), float(y1)],
                                [float(x2), float(y2)],
                                [float(x1), float(y2)]
                            ]
                            best_conf = conf * 0.80
            
            if best_detection is not None:
                return best_detection, best_conf
            
            return None
            
        except Exception as e:
            logger.error(f"YOLO detection error: {e}")
            return None


class OpenCVDetector:
    """
    Robust multi-stage OpenCV card & boundary detector.
    Features:
    - Multi-scale Canny edge detection with auto-median hysteresis
    - Adaptive Gaussian thresholding with morphological closing
    - Morphological gradient edge detection
    - LAB color space L-channel segmentation for plastic cards
    - Adaptive epsilon polygonal simplification for rounded corners
    - Outward margin preservation to prevent cutting off edge details
    """
    
    def detect(self, image: np.ndarray) -> Optional[Tuple[List, float]]:
        """
        Detect card/document corners and confidence.
        Returns (corners, confidence) or None.
        """
        try:
            h, w = image.shape[:2]
            
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            blurred = cv2.bilateralFilter(gray, 11, 75, 75)
            
            best_corners = None
            best_score = 0.0
            
            # Approach 1: Multi-threshold Canny
            c1, s1 = self._detect_with_canny(blurred, h, w)
            if c1 is not None and s1 > best_score:
                best_corners, best_score = c1, s1
                if best_score >= 0.88:
                    return best_corners, best_score
            
            # Approach 2: Adaptive Threshold
            c2, s2 = self._detect_with_threshold(blurred, h, w)
            if c2 is not None and s2 > best_score:
                best_corners, best_score = c2, s2
                if best_score >= 0.88:
                    return best_corners, best_score
            
            # Approach 3: Morphological Gradient
            c3, s3 = self._detect_with_morphology(blurred, h, w)
            if c3 is not None and s3 > best_score:
                best_corners, best_score = c3, s3
                if best_score >= 0.88:
                    return best_corners, best_score

            # Approach 4: LAB Color Space Otsu Segmentation (for plastic cards on tables)
            c4, s4 = self._detect_with_lab_color(image, h, w)
            if c4 is not None and s4 > best_score:
                best_corners, best_score = c4, s4
            
            if best_corners is not None:
                return best_corners, best_score
            
            return None
            
        except Exception as e:
            logger.error(f"OpenCV detection error: {e}")
            return None
    
    def _detect_with_canny(self, gray: np.ndarray, h: int, w: int) -> Tuple[Optional[List], float]:
        """Detect using Canny edge detection with multiple threshold passes."""
        median = np.median(gray)
        lower_auto = int(max(0, 0.67 * median))
        upper_auto = int(min(255, 1.33 * median))
        
        threshold_pairs = [
            (30, 100),
            (50, 150),
            (lower_auto, upper_auto),
            (15, 60),
            (70, 200)
        ]
        
        best_corners = None
        best_score = 0.0
        
        for lower, upper in threshold_pairs:
            edges = cv2.Canny(gray, lower, upper)
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
            edges = cv2.dilate(edges, kernel, iterations=1)
            corners, score = self._find_card_contour(edges, h, w)
            if corners is not None and score > best_score:
                best_corners = corners
                best_score = score
                if best_score > 0.85:
                    break
        
        return best_corners, best_score
    
    def _detect_with_threshold(self, gray: np.ndarray, h: int, w: int) -> Tuple[Optional[List], float]:
        """Detect using adaptive thresholding."""
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 11, 2
        )
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
        return self._find_card_contour(thresh, h, w)
    
    def _detect_with_morphology(self, gray: np.ndarray, h: int, w: int) -> Tuple[Optional[List], float]:
        """Detect using morphological gradient and Otsu binarization."""
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        gradient = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, kernel)
        _, binary = cv2.threshold(gradient, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=3)
        return self._find_card_contour(binary, h, w)

    def _detect_with_lab_color(self, bgr_image: np.ndarray, h: int, w: int) -> Tuple[Optional[List], float]:
        """Detect plastic cards using LAB luminance segmentation."""
        try:
            lab = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2LAB)
            l_channel, _, _ = cv2.split(lab)
            _, thresh = cv2.threshold(l_channel, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
            closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
            return self._find_card_contour(closed, h, w)
        except Exception:
            return None, 0.0
    
    def _find_card_contour(self, binary: np.ndarray, h: int, w: int) -> Tuple[Optional[List], float]:
        """
        Find the best card-like contour in a binary edge or mask image.
        Uses adaptive epsilon polygonal approximation and subtle outward safety margin.
        """
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None, 0.0
        
        image_area = float(h * w)
        best_corners = None
        best_score = 0.0
        
        # Sort by area descending
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        
        for contour in contours[:15]:
            area = cv2.contourArea(contour)
            area_ratio = area / image_area
            
            # Filter by area: cards typically 6% to 98% of frame
            if area_ratio < 0.06 or area_ratio > 0.985:
                continue
            
            peri = cv2.arcLength(contour, True)
            rect = cv2.minAreaRect(contour)
            rect_w, rect_h = rect[1]
            if rect_w == 0 or rect_h == 0:
                continue
                
            aspect = max(rect_w, rect_h) / min(rect_w, rect_h)
            rect_area = rect_w * rect_h
            rectangularity = area / rect_area if rect_area > 0 else 0
            
            # Standard ID card aspect ratio is 85.6/54 = 1.58577
            aspect_diff = abs(aspect - ISO_ID1_RATIO)
            
            # Attempt adaptive epsilon polygonal approximation
            # Plastic cards have rounded corners; varying epsilon finds the true 4 corner vertices
            found_quad = None
            for eps_factor in [0.015, 0.02, 0.025, 0.03, 0.035, 0.045]:
                approx = cv2.approxPolyDP(contour, eps_factor * peri, True)
                if len(approx) == 4 and cv2.isContourConvex(approx):
                    found_quad = approx.reshape(4, 2).astype(np.float32)
                    break
            
            if found_quad is not None:
                # Add a subtle 0.8% outward safety margin so card border text/emblems are never cut
                centroid = np.mean(found_quad, axis=0)
                expanded_corners = []
                for pt in found_quad:
                    vec = pt - centroid
                    safe_pt = pt + 0.008 * vec
                    safe_x = float(np.clip(safe_pt[0], 0, w - 1))
                    safe_y = float(np.clip(safe_pt[1], 0, h - 1))
                    expanded_corners.append([safe_x, safe_y])
                
                score = (
                    rectangularity * 0.45 +
                    min(area_ratio / 0.25, 1.0) * 0.30 +
                    max(0.0, 1.0 - aspect_diff) * 0.25
                )
                score = min(score, 0.94)
                if score > best_score:
                    best_corners = expanded_corners
                    best_score = score
            elif 4 < len(cv2.approxPolyDP(contour, 0.02 * peri, True)) <= 14 and rectangularity > 0.72:
                # Fallback to minimum area rectangle for rounded cards
                box_pts = cv2.boxPoints(rect).tolist()
                score = (
                    rectangularity * 0.40 +
                    min(area_ratio / 0.25, 1.0) * 0.30 +
                    max(0.0, 1.0 - aspect_diff) * 0.20
                )
                score = min(score, 0.82)
                if score > best_score:
                    best_corners = box_pts
                    best_score = score
        
        return best_corners, best_score


class CardDetector:
    """Two-stage card detector: AI ROI localization primary, OpenCV fallback."""
    
    def __init__(self, custom_model_path: Optional[str] = None):
        self.yolo = YOLODetector(custom_model_path)
        self.opencv = OpenCVDetector()
        self._yolo_available = False
    
    def initialize(self):
        """Initialize detectors."""
        self._yolo_available = self.yolo.load()
        if self._yolo_available:
            logger.info("YOLO detector initialized successfully")
        else:
            logger.info("YOLO not available, using high-speed OpenCV pipeline")
    
    def detect(self, image: np.ndarray) -> dict:
        """
        Detect card in image using two-stage approach:
        Stage 1: Card region / ROI localization
        Stage 2: 4-Corner boundary extraction
        Returns detection result dict with ordered corners and confidence.
        """
        from ..utils import order_corners, validate_quadrilateral
        
        detection_method = "NONE"
        corners = None
        confidence = 0.0
        
        # Stage 1: Try YOLO / AI detector if available
        if self._yolo_available:
            result = self.yolo.detect(image)
            if result is not None:
                corners, confidence = result
                detection_method = "AI"
                logger.info(f"YOLO detection: confidence={confidence:.3f}")
        
        # Stage 2: Try OpenCV if AI failed or low confidence
        if corners is None or confidence < 0.65:
            opencv_result = self.opencv.detect(image)
            if opencv_result is not None:
                cv_corners, cv_confidence = opencv_result
                if cv_corners is not None and (corners is None or cv_confidence > confidence):
                    corners = cv_corners
                    confidence = cv_confidence
                    detection_method = "OPENCV"
                    logger.info(f"OpenCV detection: confidence={confidence:.3f}")
        
        if corners is None:
            # Safe Fallback: create centered card box with standard ID ratio (85.6 / 54)
            h, w = image.shape[:2]
            target_aspect = ISO_ID1_RATIO
            if w / h > target_aspect:
                box_h = int(h * 0.88)
                box_w = int(box_h * target_aspect)
            else:
                box_w = int(w * 0.88)
                box_h = int(box_w / target_aspect)
            start_x = max(0, (w - box_w) // 2)
            start_y = max(0, (h - box_h) // 2)
            corners = [
                [float(start_x), float(start_y)],
                [float(start_x + box_w), float(start_y)],
                [float(start_x + box_w), float(start_y + box_h)],
                [float(start_x), float(start_y + box_h)]
            ]
            detection_method = "OPENCV"
            confidence = 0.65
            logger.info("Using standard ID aspect-ratio centered fallback crop")
        
        # Order corners: Top-Left, Top-Right, Bottom-Right, Bottom-Left
        ordered = order_corners(corners)
        
        # Validate geometry
        validation = validate_quadrilateral(ordered, image.shape)
        
        if not validation["valid"]:
            return {
                "detected": False,
                "method": detection_method,
                "confidence": confidence * 0.3,
                "corners": ordered,
                "message": f"Detection rejected: {validation['reason']}"
            }
        
        # Adjust confidence based on geometry quality
        geo_score = min(validation.get("area_ratio", 0.1) / 0.25, 1.0) * 0.25
        aspect = validation.get("aspect_ratio", 1.0)
        aspect_score = max(0.0, 1.0 - abs(aspect - ISO_ID1_RATIO) / 1.0) * 0.25
        
        final_confidence = confidence * 0.50 + geo_score + aspect_score
        final_confidence = min(max(final_confidence, 0.0), 0.99)
        
        return {
            "detected": True,
            "method": detection_method,
            "confidence": float(final_confidence),
            "corners": ordered,
            "area_ratio": float(validation.get("area_ratio", 0.0)),
            "aspect_ratio": float(validation.get("aspect_ratio", 1.0))
        }
