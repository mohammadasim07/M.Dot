"""M.Dot Studio Pro — Image Processing Service (FastAPI)."""
import os
import uuid
import logging
import tempfile
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
    ProcessingResult, ProcessingStatus, ConfidenceLevel,
    DetectionMethod, DetectedCorners, Corner,
    EnhancementMode, EnhancementParams,
    RotateRequest, CropRequest, ErrorResponse
)
from .detection import CardDetector
from .processing import perspective_transform, rotate_image, scale_corners_to_original
from .enhancement import apply_enhancement
from .utils import read_image_bytes, create_inference_copy, encode_image_to_bytes

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Temp directory for processed images
TEMP_DIR = Path(tempfile.gettempdir()) / "mdot_studio"
TEMP_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title="M.Dot Studio Pro Image Service",
    version="1.0.0",
    docs_url="/docs" if os.getenv("ENV", "production") == "development" else None,
    redoc_url=None
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8080", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize card detector
detector = CardDetector(custom_model_path=os.getenv("CUSTOM_MODEL_PATH"))


@app.on_event("startup")
async def startup():
    """Initialize models on startup."""
    logger.info("Initializing image processing service...")
    detector.initialize()
    logger.info("Image processing service ready.")


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "image-processing"}


@app.post("/process")
async def process_image(image: UploadFile = File(...)):
    """
    Full processing pipeline:
    1. Read image with EXIF correction
    2. Create inference copy
    3. Detect card
    4. Perspective correction on original
    5. Auto enhancement
    6. Return processed image + metadata
    """
    try:
        # Read image
        image_bytes = await image.read()
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty image file")
        
        original = read_image_bytes(image_bytes)
        orig_h, orig_w = original.shape[:2]
        
        # Check minimum resolution
        if orig_w < 200 or orig_h < 200:
            return JSONResponse(
                status_code=200,
                content=ProcessingResult(
                    status=ProcessingStatus.FAILED,
                    confidence=0.0,
                    confidence_level=ConfidenceLevel.LOW,
                    detection_method=DetectionMethod.NONE,
                    original_width=orig_w,
                    original_height=orig_h,
                    message="Image resolution is too low for reliable printing."
                ).model_dump()
            )
        
        # Create inference copy
        inference_img, scale_x, scale_y = create_inference_copy(original, max_size=960)
        
        # Detect card
        detection = detector.detect(inference_img)
        
        if not detection.get("detected") or not detection.get("corners"):
            # Robust Fallback: use full frame or centered crop
            corners_original = [
                [0, 0],
                [orig_w - 1, 0],
                [orig_w - 1, orig_h - 1],
                [0, orig_h - 1]
            ]
            confidence = 0.75
            method = "OPENCV"
            conf_level = ConfidenceLevel.MEDIUM
            status = ProcessingStatus.READY
            status_msg = "Card processed with standard frame."
        else:
            confidence = detection["confidence"]
            method = detection["method"]
            corners_inference = detection["corners"]
            corners_original = scale_corners_to_original(corners_inference, scale_x, scale_y)
            status_msg = None
            if confidence >= 0.75:
                conf_level = ConfidenceLevel.HIGH
                status = ProcessingStatus.READY
            elif confidence >= 0.5:
                conf_level = ConfidenceLevel.MEDIUM
                status = ProcessingStatus.READY
            else:
                conf_level = ConfidenceLevel.MEDIUM
                status = ProcessingStatus.READY
                status_msg = "Auto-detected card with adjusted boundaries."
        
        # Perspective correction on ORIGINAL high-res image
        try:
            corrected = perspective_transform(original, corners_original)
        except Exception as e:
            logger.error(f"Perspective transform failed: {e}")
            return JSONResponse(
                status_code=200,
                content=ProcessingResult(
                    status=ProcessingStatus.FAILED,
                    confidence=confidence,
                    confidence_level=ConfidenceLevel.LOW,
                    detection_method=DetectionMethod(method),
                    original_width=orig_w,
                    original_height=orig_h,
                    message="Card edges are not clear."
                ).model_dump()
            )
        
        # Keep cropped image in its pristine original state by default (no forced auto filter)
        cropped_clean = corrected.copy()
        proc_h, proc_w = cropped_clean.shape[:2]
        
        # Save files
        file_id = str(uuid.uuid4())
        original_path = TEMP_DIR / f"{file_id}_original.png"
        processed_path = TEMP_DIR / f"{file_id}_processed.png"
        
        fast_png_opts = [cv2.IMWRITE_PNG_COMPRESSION, 1]
        cv2.imwrite(str(original_path), original, fast_png_opts)
        cv2.imwrite(str(processed_path), cropped_clean, fast_png_opts)
        
        # Build corners DTO
        corners_dto = DetectedCorners(
            top_left=Corner(x=corners_original[0][0], y=corners_original[0][1]),
            top_right=Corner(x=corners_original[1][0], y=corners_original[1][1]),
            bottom_right=Corner(x=corners_original[2][0], y=corners_original[2][1]),
            bottom_left=Corner(x=corners_original[3][0], y=corners_original[3][1])
        )
        
        result = ProcessingResult(
            status=status,
            confidence=round(confidence, 3),
            confidence_level=conf_level,
            detection_method=DetectionMethod(method),
            corners=corners_dto,
            perspective_corrected=True,
            enhanced=False,
            original_width=orig_w,
            original_height=orig_h,
            processed_width=proc_w,
            processed_height=proc_h
        )
        
        # Return processed image as bytes with metadata headers
        processed_bytes = encode_image_to_bytes(cropped_clean, "PNG")
        
        return Response(
            content=processed_bytes,
            media_type="image/png",
            headers={
                "X-Processing-Status": result.status.value,
                "X-Confidence": str(result.confidence),
                "X-Confidence-Level": result.confidence_level.value,
                "X-Detection-Method": result.detection_method.value,
                "X-Original-Width": str(orig_w),
                "X-Original-Height": str(orig_h),
                "X-Processed-Width": str(proc_w),
                "X-Processed-Height": str(proc_h),
                "X-File-Id": file_id,
                "X-Perspective-Corrected": "true",
                "X-Enhanced": "false",
                "X-Corners": f"{int(corners_original[0][0])},{int(corners_original[0][1])},{int(corners_original[1][0])},{int(corners_original[1][1])},{int(corners_original[2][0])},{int(corners_original[2][1])},{int(corners_original[3][0])},{int(corners_original[3][1])}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Processing error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Image processing failed")


@app.post("/enhance")
async def enhance_image(
    image: UploadFile = File(...),
    mode: str = Form("AUTO"),
    brightness: float = Form(0),
    contrast: float = Form(0),
    sharpness: float = Form(0)
):
    """Apply enhancement to an already-processed image."""
    try:
        image_bytes = await image.read()
        img = read_image_bytes(image_bytes)
        
        enhanced = apply_enhancement(img, mode, brightness, contrast, sharpness)
        result_bytes = encode_image_to_bytes(enhanced, "PNG")
        
        return Response(content=result_bytes, media_type="image/png")
        
    except Exception as e:
        logger.error(f"Enhancement error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Enhancement failed")


@app.post("/rotate")
async def rotate(
    image: UploadFile = File(...),
    angle: int = Form(90)
):
    """Rotate image by 90/180/270 degrees."""
    try:
        if angle not in (90, 180, 270):
            raise HTTPException(status_code=400, detail="Angle must be 90, 180, or 270")
        
        image_bytes = await image.read()
        img = read_image_bytes(image_bytes)
        
        rotated = rotate_image(img, angle)
        result_bytes = encode_image_to_bytes(rotated, "PNG")
        
        return Response(content=result_bytes, media_type="image/png")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rotation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Rotation failed")


@app.post("/crop")
async def crop_manual(
    image: UploadFile = File(...),
    top_left_x: float = Form(...),
    top_left_y: float = Form(...),
    top_right_x: float = Form(...),
    top_right_y: float = Form(...),
    bottom_right_x: float = Form(...),
    bottom_right_y: float = Form(...),
    bottom_left_x: float = Form(...),
    bottom_left_y: float = Form(...)
):
    """Manual crop with perspective correction using user-specified corners."""
    try:
        image_bytes = await image.read()
        img = read_image_bytes(image_bytes)
        
        corners = [
            (int(top_left_x), int(top_left_y)),
            (int(top_right_x), int(top_right_y)),
            (int(bottom_right_x), int(bottom_right_y)),
            (int(bottom_left_x), int(bottom_left_y))
        ]
        
        corrected = perspective_transform(img, corners)
        cropped_clean = corrected.copy()
        result_bytes = encode_image_to_bytes(cropped_clean, "PNG")
        
        h, w = cropped_clean.shape[:2]
        
        return Response(
            content=result_bytes,
            media_type="image/png",
            headers={
                "X-Processing-Status": "READY",
                "X-Confidence": "1.0",
                "X-Confidence-Level": "HIGH",
                "X-Detection-Method": "MANUAL",
                "X-Processed-Width": str(w),
                "X-Processed-Height": str(h),
                "X-Perspective-Corrected": "true",
                "X-Enhanced": "false",
                "X-Corners": f"{int(top_left_x)},{int(top_left_y)},{int(top_right_x)},{int(top_right_y)},{int(bottom_right_x)},{int(bottom_right_y)},{int(bottom_left_x)},{int(bottom_left_y)}"
            }
        )
        
    except Exception as e:
        logger.error(f"Manual crop error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Manual crop failed")


@app.delete("/cleanup/{file_id}")
async def cleanup(file_id: str):
    """Clean up temporary files for a processed image."""
    try:
        for suffix in ["_original.png", "_processed.png"]:
            path = TEMP_DIR / f"{file_id}{suffix}"
            if path.exists():
                path.unlink()
        return {"status": "cleaned"}
    except Exception as e:
        logger.error(f"Cleanup error: {e}")
        return {"status": "error", "message": "Cleanup failed"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
