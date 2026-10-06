import { useState, useEffect, useRef, useCallback } from 'react';
import type { Photo, Corners, Point } from '../types';

interface ManualCropEditorProps {
  photo: Photo;
  onApplyCrop: (corners: Corners) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

type DragCorner = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft' | null;

export function ManualCropEditor({
  photo,
  onApplyCrop,
  onCancel,
  isProcessing = false,
}: ManualCropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({
    width: photo.originalWidth || 1000,
    height: photo.originalHeight || 700,
  });

  const [renderedSize, setRenderedSize] = useState<{ width: number; height: number }>({
    width: 600,
    height: 400,
  });

  // Corners in image pixel coordinates
  const [corners, setCorners] = useState<Corners>(() => {
    if (photo.corners) {
      return photo.corners;
    }
    const w = photo.originalWidth || 1000;
    const h = photo.originalHeight || 700;
    return {
      topLeft: { x: Math.round(w * 0.05), y: Math.round(h * 0.08) },
      topRight: { x: Math.round(w * 0.95), y: Math.round(h * 0.08) },
      bottomRight: { x: Math.round(w * 0.95), y: Math.round(h * 0.92) },
      bottomLeft: { x: Math.round(w * 0.05), y: Math.round(h * 0.92) },
    };
  });

  const [activeCorner, setActiveCorner] = useState<DragCorner>(null);

  // When image loads, compute exact natural & rendered dimensions
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const nw = img.naturalWidth || 1000;
    const nh = img.naturalHeight || 700;
    setNaturalSize({ width: nw, height: nh });

    const rect = img.getBoundingClientRect();
    setRenderedSize({ width: rect.width, height: rect.height });

    // If initial corners were unset or invalid, default to proportional frame
    if (!photo.corners) {
      setCorners({
        topLeft: { x: Math.round(nw * 0.05), y: Math.round(nh * 0.08) },
        topRight: { x: Math.round(nw * 0.95), y: Math.round(nh * 0.08) },
        bottomRight: { x: Math.round(nw * 0.95), y: Math.round(nh * 0.92) },
        bottomLeft: { x: Math.round(nw * 0.05), y: Math.round(nh * 0.92) },
      });
    }
  };

  // Resize listener to keep SVG overlay aligned with image
  useEffect(() => {
    const updateRendered = () => {
      if (imgRef.current) {
        const rect = imgRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setRenderedSize({ width: rect.width, height: rect.height });
        }
      }
    };

    window.addEventListener('resize', updateRendered);
    return () => window.removeEventListener('resize', updateRendered);
  }, []);

  // Coordinate transforms: Image pixels <-> Rendered SVG pixels
  const toSvgX = useCallback(
    (imgX: number) => (imgX / (naturalSize.width || 1)) * renderedSize.width,
    [naturalSize.width, renderedSize.width]
  );

  const toSvgY = useCallback(
    (imgY: number) => (imgY / (naturalSize.height || 1)) * renderedSize.height,
    [naturalSize.height, renderedSize.height]
  );

  const fromSvgPoint = useCallback(
    (svgX: number, svgY: number): Point => {
      const scaleX = naturalSize.width / (renderedSize.width || 1);
      const scaleY = naturalSize.height / (renderedSize.height || 1);
      const x = Math.max(0, Math.min(naturalSize.width, Math.round(svgX * scaleX)));
      const y = Math.max(0, Math.min(naturalSize.height, Math.round(svgY * scaleY)));
      return { x, y };
    },
    [naturalSize, renderedSize]
  );

  // Mouse / Touch handlers for dragging corners
  const handlePointerDown = (corner: DragCorner, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveCorner(corner);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeCorner || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const svgY = e.clientY - rect.top;

    const imgPt = fromSvgPoint(svgX, svgY);

    setCorners((prev) => ({
      ...prev,
      [activeCorner]: imgPt,
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeCorner) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setActiveCorner(null);
    }
  };

  const resetToDetected = () => {
    if (photo.corners) {
      setCorners(photo.corners);
    } else {
      const nw = naturalSize.width;
      const nh = naturalSize.height;
      setCorners({
        topLeft: { x: Math.round(nw * 0.05), y: Math.round(nh * 0.08) },
        topRight: { x: Math.round(nw * 0.95), y: Math.round(nh * 0.08) },
        bottomRight: { x: Math.round(nw * 0.95), y: Math.round(nh * 0.92) },
        bottomLeft: { x: Math.round(nw * 0.05), y: Math.round(nh * 0.92) },
      });
    }
  };

  const handleApply = () => {
    onApplyCrop(corners);
  };

  // Render SVG polygon points
  const pTL = { x: toSvgX(corners.topLeft.x), y: toSvgY(corners.topLeft.y) };
  const pTR = { x: toSvgX(corners.topRight.x), y: toSvgY(corners.topRight.y) };
  const pBR = { x: toSvgX(corners.bottomRight.x), y: toSvgY(corners.bottomRight.y) };
  const pBL = { x: toSvgX(corners.bottomLeft.x), y: toSvgY(corners.bottomLeft.y) };

  const polygonPath = `M ${pTL.x} ${pTL.y} L ${pTR.x} ${pTR.y} L ${pBR.x} ${pBR.y} L ${pBL.x} ${pBL.y} Z`;

  return (
    <div className="manual-crop-editor">
      {/* Top Banner with Guidelines */}
      <div className="manual-crop-editor__header">
        <div className="manual-crop-editor__badge">
          <span>✂ MANUAL CROP</span>
          <span style={{ opacity: 0.7 }}>· Drag the 4 corner handles to align card edges</span>
        </div>
        <div className="manual-crop-editor__actions-top">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={resetToDetected}
            disabled={isProcessing}
            title="Reset to detected or default boundaries"
          >
            ↺ Reset
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={onCancel}
            disabled={isProcessing}
          >
            ✕ Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleApply}
            disabled={isProcessing}
          >
            {isProcessing ? 'Cropping...' : '✓ Apply Perspective Crop'}
          </button>
        </div>
      </div>

      {/* Editor Canvas Container */}
      <div className="manual-crop-editor__canvas-wrap">
        <div
          ref={containerRef}
          className="manual-crop-editor__canvas"
          style={{ width: `${renderedSize.width}px`, height: `${renderedSize.height}px` }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <img
            ref={imgRef}
            src={photo.originalUrl || photo.processedUrl}
            alt="Original Document"
            className="manual-crop-editor__img"
            onLoad={handleImageLoad}
            draggable={false}
          />

          {/* SVG Corner & Quadrilateral Overlay */}
          <svg
            className="manual-crop-editor__svg"
            width={renderedSize.width}
            height={renderedSize.height}
            viewBox={`0 0 ${renderedSize.width} ${renderedSize.height}`}
          >
            {/* Shaded Area Inside Quadrilateral */}
            <path
              d={polygonPath}
              fill="rgba(0, 212, 170, 0.15)"
              stroke="#00d4aa"
              strokeWidth="2.5"
              strokeDasharray="4 2"
            />

            {/* Corner Drag Handles */}
            {[
              { id: 'topLeft', pt: pTL, label: 'TL', color: '#00d4aa' },
              { id: 'topRight', pt: pTR, label: 'TR', color: '#00d4aa' },
              { id: 'bottomRight', pt: pBR, label: 'BR', color: '#00d4aa' },
              { id: 'bottomLeft', pt: pBL, label: 'BL', color: '#00d4aa' },
            ].map(({ id, pt, label, color }) => (
              <g
                key={id}
                className="manual-crop-handle"
                transform={`translate(${pt.x}, ${pt.y})`}
                onPointerDown={(e) => handlePointerDown(id as DragCorner, e)}
                style={{ cursor: 'grab' }}
              >
                {/* Touch/mouse hit area */}
                <circle r="22" fill="transparent" />
                {/* Outer halo */}
                <circle r="12" fill={color} fillOpacity="0.3" stroke="#fff" strokeWidth="1.5" />
                {/* Center dot */}
                <circle r="6" fill="#fff" stroke={color} strokeWidth="2" />
                {/* Handle label badge */}
                <text
                  x="0"
                  y="-16"
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="10"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                >
                  {label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Footer Info */}
      <div className="manual-crop-editor__footer">
        <span className="dimension-indicator">
          Original: {naturalSize.width} × {naturalSize.height} px
        </span>
        <span style={{ color: 'var(--color-text-muted)' }}>
          High-resolution homography will be computed directly on the original document pixels.
        </span>
      </div>
    </div>
  );
}
