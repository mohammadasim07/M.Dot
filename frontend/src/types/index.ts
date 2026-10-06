export interface Point {
  x: number;
  y: number;
}

export interface Corners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface Photo {
  id: string;
  name: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'NEEDS_REVIEW';
  side: 'FRONT' | 'BACK' | null;
  originalWidth: number;
  originalHeight: number;
  processedWidth: number;
  processedHeight: number;
  confidence: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  detectionMethod: 'AI' | 'OPENCV' | 'MANUAL' | 'NONE';
  message: string | null;
  corners?: Corners | null;
  // Local state (not from API)
  thumbnailUrl?: string;
  processedUrl?: string;
  originalUrl?: string;
}

export type LayoutMode = 'SIDE_BY_SIDE' | 'TOP_BOTTOM';

export interface PrintSettings {
  layout: LayoutMode;
  copies: number;
  marginMm: number;
  cardWidthMm: number;
  cardHeightMm: number;
}

export interface EnhancementSettings {
  mode: 'ORIGINAL' | 'AUTO' | 'SCAMCANNER' | 'DOCUMENT' | 'GRAYSCALE' | 'BLACK_AND_WHITE';
  brightness: number;
  contrast: number;
  sharpness: number;
}

export interface AppState {
  photos: Photo[];
  selectedPhotoId: string | null;
  frontPhotoId: string | null;
  backPhotoId: string | null;
  layout: LayoutMode;
  printSettings: PrintSettings;
  enhancementSettings: EnhancementSettings;
  isProcessing: boolean;
  serviceOnline: boolean;
}
