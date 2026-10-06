import { useState, useRef, useEffect } from 'react';
import type { Photo, LayoutMode, PrintSettings, Corners, EnhancementSettings } from '../types';
import { DropZone } from './DropZone';
import { A4Preview } from './A4Preview';
import { ManualCropEditor } from './ManualCropEditor';

interface WorkspaceProps {
  photos: Photo[];
  selectedPhoto: Photo | null;
  frontPhoto: Photo | null;
  backPhoto: Photo | null;
  activeTab: 'CARDS' | 'A4_PREVIEW';
  onTabChange: (tab: 'CARDS' | 'A4_PREVIEW') => void;
  layout: LayoutMode;
  printSettings: PrintSettings;
  enhancementSettings?: EnhancementSettings;
  onFilesSelected: (files: File[], targetSide?: 'FRONT' | 'BACK') => void;
  onAssignSide: (id: string, side: 'FRONT' | 'BACK') => void;
  onSelectPhoto: (id: string) => void;
  onRotate: (angle: number) => void;
  onAutoCrop: (id: string) => void;
  onManualCrop: (id: string, corners: Corners) => void;
  onApplyEnhancement: (settings?: import('../types').EnhancementSettings) => void;
  isProcessing: boolean;
}

type ViewSubMode = 'CROPPED' | 'BOUNDARY' | 'MANUAL';

const FILTER_OPTIONS = [
  { id: 'SCAMCANNER', label: 'Scan (ScamCanner)', icon: '⚡', desc: 'Whitened document background & crisp text' },
  { id: 'AUTO', label: 'Auto Enhance', icon: '🎨', desc: 'Balanced dynamic contrast & color booster' },
  { id: 'DOCUMENT', label: 'Clean Doc', icon: '📄', desc: 'High-clarity document enhancement' },
  { id: 'GRAYSCALE', label: 'Grayscale', icon: '🩶', desc: 'Clean monochrome official ID tone' },
  { id: 'BLACK_AND_WHITE', label: 'B&W Threshold', icon: '⬛', desc: 'Sharp black & white binary threshold' },
  { id: 'ORIGINAL', label: 'Original (No Filter)', icon: '↩', desc: 'Untouched natural card colors' },
] as const;

interface UploadedCardSlotProps {
  photo: Photo;
  side: 'FRONT' | 'BACK';
  onSelect: () => void;
  onRotate: () => void;
  onCrop: () => void;
  onOpenFullEditor: () => void;
  onReplace: (files: File[]) => void;
  isProcessing: boolean;
}

function UploadedCardSlot({
  photo,
  side,
  onSelect,
  onRotate,
  onCrop,
  onOpenFullEditor,
  onReplace,
  isProcessing,
}: UploadedCardSlotProps) {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const isFront = side === 'FRONT';
  const badgeClass = isFront ? 'drop-zone__badge--front' : 'drop-zone__badge--back';
  const badgeText = isFront ? '🪪 FRONT SIDE ✓' : '🔄 BACK SIDE ✓';
  const slotClass = isFront ? 'uploaded-card-slot--front' : 'uploaded-card-slot--back';

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) =>
        (f.type && f.type.startsWith('image/')) ||
        /\.(jpe?g|png|webp|bmp|jfif|tiff?)$/i.test(f.name)
    );
    if (files.length > 0) {
      onReplace(files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) onReplace(files);
    if (replaceInputRef.current) replaceInputRef.current.value = '';
  };

  return (
    <div
      className={`uploaded-card-slot ${slotClass} ${isDragOver ? 'uploaded-card-slot--dragover' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="uploaded-card-slot__header">
        <span className={`drop-zone__badge ${badgeClass}`}>{badgeText}</span>
        <span className="uploaded-card-slot__status">
          {photo.status === 'READY'
            ? '✓ Ready'
            : photo.status === 'PROCESSING'
            ? 'Processing...'
            : 'Uploaded'}
        </span>
      </div>

      <div
        className="uploaded-card-slot__preview"
        onClick={() => {
          onSelect();
          onOpenFullEditor();
        }}
        title="Click to view & edit in full editor"
      >
        <img
          src={photo.processedUrl || photo.originalUrl}
          alt={photo.name}
          className="uploaded-card-slot__img"
        />
        {isProcessing && (
          <div className="processing-overlay">
            <div className="spinner"></div>
          </div>
        )}
      </div>

      <div className="uploaded-card-slot__meta">
        <div className="uploaded-card-slot__name" title={photo.name}>
          {photo.name}
        </div>
        <div className="uploaded-card-slot__actions">
          <button
            type="button"
            className="btn btn--secondary btn--xs"
            onClick={onRotate}
            disabled={isProcessing}
            title="Rotate 90° clockwise"
          >
            ↻ Rotate
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--xs"
            onClick={onCrop}
            disabled={isProcessing}
            title="Adjust 4-corner crop handles"
          >
            ✂ Crop
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--xs"
            onClick={onOpenFullEditor}
            title="Open in full editor"
          >
            🔍 Edit
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--xs"
            onClick={() => replaceInputRef.current?.click()}
            disabled={isProcessing}
            title="Replace this photo with another image"
          >
            🔄 Replace
          </button>
        </div>
      </div>

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/bmp,image/*"
        className="hidden-input"
        onChange={handleFileChange}
      />
    </div>
  );
}

export function Workspace({
  photos,
  selectedPhoto,
  frontPhoto,
  backPhoto,
  activeTab,
  onTabChange,
  layout,
  printSettings,
  enhancementSettings,
  onFilesSelected,
  onAssignSide,
  onSelectPhoto,
  onRotate,
  onAutoCrop,
  onManualCrop,
  onApplyEnhancement,
  isProcessing,
}: WorkspaceProps) {
  const hasPhotos = photos.length > 0;
  const [subMode, setSubMode] = useState<ViewSubMode>('CROPPED');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const currentMode = enhancementSettings?.mode || 'ORIGINAL';
  const activeFilterInfo = FILTER_OPTIONS.find((f) => f.id === currentMode);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setFilterMenuOpen(false);
      }
    }
    if (filterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filterMenuOpen]);

  const hasBothSides = Boolean(frontPhoto && backPhoto);
  const [forceFullEditor, setForceFullEditor] = useState(false);

  useEffect(() => {
    if (photos.length === 0) {
      setForceFullEditor(false);
    }
  }, [photos.length]);

  const activePhoto = selectedPhoto || (photos.length > 0 ? photos[0] : null);

  // Confidence assessment
  const confPercent = activePhoto ? Math.round(activePhoto.confidence * 100) : 0;
  const isHighConfidence = confPercent >= 75;
  const isLowConfidence = confPercent > 0 && confPercent < 50;

  return (
    <main className="workspace">
      {/* Top Workspace Header Bar */}
      <div className="workspace__tabs">
        <div className="workspace__tab-group">
          <button
            type="button"
            className={`workspace__tab ${activeTab === 'CARDS' ? 'workspace__tab--active' : ''}`}
            onClick={() => {
              onTabChange('CARDS');
            }}
          >
            🪪 ID Card Workspace {hasPhotos ? `(${photos.length})` : ''}
          </button>
          <button
            type="button"
            className={`workspace__tab ${activeTab === 'A4_PREVIEW' ? 'workspace__tab--active' : ''}`}
            onClick={() => onTabChange('A4_PREVIEW')}
          >
            📄 A4 Print Sheet Preview
          </button>
        </div>

        {hasPhotos && activeTab === 'CARDS' && activePhoto && (hasBothSides || forceFullEditor) && (
          <div className="workspace__view-switch">
            <button
              type="button"
              className={`view-switch-btn ${subMode === 'CROPPED' ? 'view-switch-btn--active' : ''}`}
              onClick={() => setSubMode('CROPPED')}
              title="Show perspective-corrected clean crop"
            >
              ✓ Cropped Result
            </button>
            <button
              type="button"
              className={`view-switch-btn ${subMode === 'BOUNDARY' ? 'view-switch-btn--active' : ''}`}
              onClick={() => setSubMode('BOUNDARY')}
              title="Show detected card boundaries on original photo"
            >
              🔍 Detected Boundary
            </button>
            <button
              type="button"
              className={`view-switch-btn ${subMode === 'MANUAL' ? 'view-switch-btn--active' : ''}`}
              onClick={() => setSubMode('MANUAL')}
              title="Manually adjust 4 corner handles"
            >
              ✂ Manual Crop
            </button>
          </div>
        )}
      </div>

      {/* Main Workspace Body */}
      <div
        className="workspace__body"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const files = Array.from(e.dataTransfer.files).filter(
            (f) =>
              (f.type && f.type.startsWith('image/')) ||
              /\.(jpe?g|png|webp|bmp|jfif|tiff?)$/i.test(f.name)
          );
          if (files.length > 0) {
            onFilesSelected(files);
          }
        }}
      >
        {activeTab === 'A4_PREVIEW' ? (
          <A4Preview
            frontPhoto={frontPhoto}
            backPhoto={backPhoto}
            layout={layout}
            printSettings={printSettings}
          />
        ) : subMode === 'MANUAL' && activePhoto ? (
          /* Interactive Manual Crop Mode */
          <ManualCropEditor
            photo={activePhoto}
            isProcessing={isProcessing}
            onCancel={() => setSubMode('CROPPED')}
            onApplyCrop={(corners) => {
              onManualCrop(activePhoto.id, corners);
              setSubMode('CROPPED');
            }}
          />
        ) : !hasBothSides && !forceFullEditor ? (
          <div className="dual-drop-zone-container">
            {/* Front Slot: either uploaded Front card or Front DropZone */}
            {frontPhoto ? (
              <UploadedCardSlot
                photo={frontPhoto}
                side="FRONT"
                onSelect={() => onSelectPhoto(frontPhoto.id)}
                onRotate={() => onRotate(90)}
                onCrop={() => {
                  onSelectPhoto(frontPhoto.id);
                  setSubMode('MANUAL');
                }}
                onOpenFullEditor={() => {
                  onSelectPhoto(frontPhoto.id);
                  setForceFullEditor(true);
                }}
                onReplace={(files) => onFilesSelected(files, 'FRONT')}
                isProcessing={isProcessing}
              />
            ) : (
              <DropZone
                side="FRONT"
                onFilesSelected={(files) => onFilesSelected(files, 'FRONT')}
              />
            )}

            {/* Back Slot: either uploaded Back card or Back DropZone */}
            {backPhoto ? (
              <UploadedCardSlot
                photo={backPhoto}
                side="BACK"
                onSelect={() => onSelectPhoto(backPhoto.id)}
                onRotate={() => onRotate(90)}
                onCrop={() => {
                  onSelectPhoto(backPhoto.id);
                  setSubMode('MANUAL');
                }}
                onOpenFullEditor={() => {
                  onSelectPhoto(backPhoto.id);
                  setForceFullEditor(true);
                }}
                onReplace={(files) => onFilesSelected(files, 'BACK')}
                isProcessing={isProcessing}
              />
            ) : (
              <DropZone
                side="BACK"
                onFilesSelected={(files) => onFilesSelected(files, 'BACK')}
              />
            )}
          </div>
        ) : !activePhoto ? (
          <div className="empty-selection-placeholder">
            <span>Select a document from the left queue to view and edit.</span>
          </div>
        ) : (
          /* Active Document Prominent Display */
          <div className="document-display-container">
            {/* Status & Confidence Banner */}
            <div className="document-status-banner">
              <div className="document-status-banner__left">
                {isHighConfidence ? (
                  <span className="status-indicator status-indicator--success">
                    ✓ Document detected
                  </span>
                ) : isLowConfidence ? (
                  <span className="status-indicator status-indicator--warning">
                    ⚠️ Low confidence — verify or use manual crop
                  </span>
                ) : (
                  <span className="status-indicator status-indicator--info">
                    ℹ️ Document detected — review corners
                  </span>
                )}
                {confPercent > 0 && (
                  <span className="confidence-pill">
                    Confidence: {confPercent}%
                  </span>
                )}
                <span className="document-name-tag">{activePhoto.name}</span>
                {activePhoto.detectionMethod && (
                  <span className="method-pill">{activePhoto.detectionMethod}</span>
                )}
              </div>

              <div className="document-status-banner__right">
                {!hasBothSides && (
                  <button
                    type="button"
                    className="btn btn--secondary btn--xs"
                    onClick={() => setForceFullEditor(false)}
                    title="Return to side-by-side drop view"
                    style={{ marginRight: '8px' }}
                  >
                    ⊞ Show {frontPhoto ? 'Back Drop Slot' : 'Front Drop Slot'}
                  </button>
                )}
                <span className="iso-badge">ISO ID-1 (85.6 × 54 mm)</span>
              </div>
            </div>

            {/* Prominent Image Viewport */}
            <div className="document-viewport">
              {subMode === 'BOUNDARY' ? (
                /* Original image with Adobe-Scan-style detected boundary overlay */
                <div className="boundary-overlay-wrap">
                  <img
                    src={activePhoto.originalUrl || activePhoto.processedUrl}
                    alt="Original Document"
                    className="document-viewport__img"
                  />
                  {activePhoto.corners && (
                    <svg
                      className="boundary-svg"
                      viewBox={`0 0 ${activePhoto.originalWidth || 1000} ${activePhoto.originalHeight || 700}`}
                    >
                      <polygon
                        points={`
                          ${activePhoto.corners.topLeft.x},${activePhoto.corners.topLeft.y}
                          ${activePhoto.corners.topRight.x},${activePhoto.corners.topRight.y}
                          ${activePhoto.corners.bottomRight.x},${activePhoto.corners.bottomRight.y}
                          ${activePhoto.corners.bottomLeft.x},${activePhoto.corners.bottomLeft.y}
                        `}
                        fill="rgba(0, 212, 170, 0.18)"
                        stroke="#00d4aa"
                        strokeWidth="4"
                        strokeDasharray="8 4"
                      />
                      {[
                        activePhoto.corners.topLeft,
                        activePhoto.corners.topRight,
                        activePhoto.corners.bottomRight,
                        activePhoto.corners.bottomLeft,
                      ].map((corner, i) => (
                        <circle
                          key={i}
                          cx={corner.x}
                          cy={corner.y}
                          r="14"
                          fill="#00d4aa"
                          stroke="#fff"
                          strokeWidth="3"
                        />
                      ))}
                    </svg>
                  )}
                  <div className="boundary-hint-pill">
                    Detected Document Boundary · Click [Manual Crop] to adjust handles
                  </div>
                </div>
              ) : (
                /* Cropped & Perspective-Corrected Result */
                <div className="cropped-result-wrap">
                  <img
                    src={activePhoto.processedUrl || activePhoto.originalUrl}
                    alt="Cropped Document"
                    className="document-viewport__img document-viewport__img--shadowed"
                    onError={(e) => {
                      if (activePhoto.originalUrl && (e.target as HTMLImageElement).src !== activePhoto.originalUrl) {
                        (e.target as HTMLImageElement).src = activePhoto.originalUrl;
                      }
                    }}
                  />
                  {isProcessing && (
                    <div className="processing-overlay">
                      <div className="spinner"></div>
                      <span>Correcting perspective & enhancing...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* PRIMARY IMAGE ACTIONS TOOLBAR (Section 14) */}
            <div className="primary-actions-toolbar">
              <div className="toolbar-left-group">
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => onAutoCrop(activePhoto.id)}
                  disabled={isProcessing}
                  title="Re-run automatic edge detection & perspective crop"
                >
                  ✓ Auto Crop
                </button>

                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setSubMode('MANUAL')}
                  disabled={isProcessing}
                  title="Open 4-corner draggable handles editor"
                >
                  ✂ Manual Crop
                </button>

                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => onRotate(90)}
                  disabled={isProcessing}
                  title="Rotate 90 degrees clockwise"
                >
                  ↻ Rotate 90°
                </button>

                {/* Dedicated Filter Button with Interactive Dropdown Menu */}
                <div className="filter-dropdown-wrapper" ref={filterMenuRef}>
                  <button
                    type="button"
                    className={`btn btn--secondary btn--sm filter-trigger-btn ${currentMode !== 'ORIGINAL' ? 'filter-trigger-btn--active' : ''}`}
                    onClick={() => setFilterMenuOpen((prev) => !prev)}
                    disabled={isProcessing}
                    title="Choose and apply a filter according to your preference"
                  >
                    <span className="filter-trigger-label">
                      {activeFilterInfo && currentMode !== 'ORIGINAL'
                        ? `${activeFilterInfo.icon} ${activeFilterInfo.label}`
                        : '✨ Select Filter'}
                    </span>
                    <span className="filter-trigger-arrow">{filterMenuOpen ? '▴' : '▾'}</span>
                  </button>

                  {filterMenuOpen && (
                    <div className="filter-dropdown-popover">
                      <div className="filter-dropdown-title">SELECT FILTER</div>
                      <div className="filter-dropdown-items">
                        {FILTER_OPTIONS.map((opt) => {
                          const isSelected = currentMode === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              className={`filter-popover-item ${isSelected ? 'filter-popover-item--selected' : ''}`}
                              onClick={() => {
                                setFilterMenuOpen(false);
                                onApplyEnhancement({
                                  mode: opt.id,
                                  brightness: 100,
                                  contrast: 100,
                                  sharpness: 0,
                                });
                              }}
                            >
                              <span className="filter-popover-icon">{opt.icon}</span>
                              <div className="filter-popover-info">
                                <span className="filter-popover-name">{opt.label}</span>
                                <span className="filter-popover-desc">{opt.desc}</span>
                              </div>
                              {isSelected && <span className="filter-popover-check">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Dedicated Reset Button (Restores clean original crop) */}
                <button
                  type="button"
                  className={`btn btn--secondary btn--sm reset-filter-btn ${currentMode !== 'ORIGINAL' ? 'reset-filter-btn--active' : ''}`}
                  onClick={() => {
                    onApplyEnhancement({
                      mode: 'ORIGINAL',
                      brightness: 100,
                      contrast: 100,
                      sharpness: 0,
                    });
                  }}
                  disabled={isProcessing}
                  title="Reset all filters and restore clean original crop"
                >
                  ↺ Reset
                </button>
              </div>

              <div className="toolbar-right-group">
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => onTabChange('A4_PREVIEW')}
                  title="View this card arranged on A4 print sheet"
                >
                  📄 Add to A4 & Preview →
                </button>
              </div>
            </div>

            {/* Front & Back Assigned Mini-Strip */}
            <div className="assigned-slots-bar">
              {/* Front Slot */}
              <div
                className={`mini-slot ${frontPhoto?.id === activePhoto.id ? 'mini-slot--active' : ''}`}
                onClick={() => {
                  if (frontPhoto) onSelectPhoto(frontPhoto.id);
                  else onAssignSide(activePhoto.id, 'FRONT');
                }}
              >
                <div className="mini-slot__thumb">
                  {frontPhoto?.processedUrl ? (
                    <img src={frontPhoto.processedUrl} alt="Front" />
                  ) : (
                    <span>🪪</span>
                  )}
                </div>
                <div className="mini-slot__info">
                  <div className="mini-slot__title">
                    Front Side {frontPhoto?.id === activePhoto.id ? '(Active)' : ''}
                  </div>
                  <div className="mini-slot__sub">
                    {frontPhoto ? frontPhoto.name : 'Empty · Click to assign'}
                  </div>
                </div>
              </div>

              {/* Back Slot */}
              <div
                className={`mini-slot ${backPhoto?.id === activePhoto.id ? 'mini-slot--active' : ''}`}
                onClick={() => {
                  if (backPhoto) onSelectPhoto(backPhoto.id);
                  else onAssignSide(activePhoto.id, 'BACK');
                }}
              >
                <div className="mini-slot__thumb">
                  {backPhoto?.processedUrl ? (
                    <img src={backPhoto.processedUrl} alt="Back" />
                  ) : (
                    <span>🔄</span>
                  )}
                </div>
                <div className="mini-slot__info">
                  <div className="mini-slot__title">
                    Back Side {backPhoto?.id === activePhoto.id ? '(Active)' : ''}
                  </div>
                  <div className="mini-slot__sub">
                    {backPhoto ? backPhoto.name : 'Empty · Click to assign'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
