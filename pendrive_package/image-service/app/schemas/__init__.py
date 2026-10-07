"""Pydantic schemas for the image processing service."""
from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class Corner(BaseModel):
    x: float
    y: float


class DetectedCorners(BaseModel):
    top_left: Corner
    top_right: Corner
    bottom_right: Corner
    bottom_left: Corner


class DetectionMethod(str, Enum):
    AI = "AI"
    OPENCV = "OPENCV"
    MANUAL = "MANUAL"
    NONE = "NONE"


class ConfidenceLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ProcessingStatus(str, Enum):
    READY = "READY"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    FAILED = "FAILED"
    ERROR = "ERROR"


class EnhancementMode(str, Enum):
    ORIGINAL = "ORIGINAL"
    AUTO = "AUTO"
    SCAMCANNER = "SCAMCANNER"
    DOCUMENT = "DOCUMENT"
    GRAYSCALE = "GRAYSCALE"
    BLACK_AND_WHITE = "BLACK_AND_WHITE"


class EnhancementParams(BaseModel):
    mode: EnhancementMode = EnhancementMode.AUTO
    brightness: float = 0.0   # -100 to 100
    contrast: float = 0.0     # -100 to 100
    sharpness: float = 0.0    # -100 to 100


class ProcessingResult(BaseModel):
    status: ProcessingStatus
    confidence: float
    confidence_level: ConfidenceLevel
    detection_method: DetectionMethod
    corners: Optional[DetectedCorners] = None
    perspective_corrected: bool = False
    enhanced: bool = False
    original_width: int = 0
    original_height: int = 0
    processed_width: int = 0
    processed_height: int = 0
    message: Optional[str] = None


class RotateRequest(BaseModel):
    angle: int  # 90, 180, 270


class CropRequest(BaseModel):
    corners: DetectedCorners


class ErrorResponse(BaseModel):
    status: str = "ERROR"
    message: str
    detail: Optional[str] = None
