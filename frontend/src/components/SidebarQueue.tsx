import { useRef } from 'react';
import type { Photo } from '../types';

interface SidebarQueueProps {
  photos: Photo[];
  selectedPhotoId: string | null;
  frontPhotoId: string | null;
  backPhotoId: string | null;
  copies?: number;
  onSelectPhoto: (id: string) => void;
  onRemovePhoto: (id: string) => void;
  onDuplicatePhoto: (id: string) => void;
  onAssignSide: (id: string, side: 'FRONT' | 'BACK') => void;
  onAddFiles: (files: File[]) => void;
  onClearQueue: () => void;
}

export function SidebarQueue({
  photos,
  selectedPhotoId,
  frontPhotoId,
  backPhotoId,
  onSelectPhoto,
  onRemovePhoto,
  onDuplicatePhoto,
  onAssignSide,
  onAddFiles,
  onClearQueue,
}: SidebarQueueProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) onAddFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <aside className="sidebar-left">
      {/* Queue Header */}
      <div className="sidebar-section">
        <div className="sidebar-section__title">
          <div className="sidebar-section__title-left">
            <span>DOCUMENTS QUEUE</span>
            <span className="queue-count-pill">{photos.length}</span>
          </div>
          <button
            type="button"
            className="queue-clear-text-btn"
            onClick={photos.length > 0 ? onClearQueue : undefined}
            disabled={photos.length === 0}
            title={photos.length === 0 ? 'Queue is empty' : 'Clear all documents from queue in one click'}
          >
            Clear All
          </button>
        </div>
        <button
          type="button"
          className="add-photo-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Upload ID Card Photo (JPG / PNG)"
        >
          <span>+</span> Add Document
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          className="hidden-input"
          onChange={handleFileChange}
        />
      </div>

      {/* Queue Items List */}
      <div
        className="queue-list"
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
          if (files.length > 0) onAddFiles(files);
        }}
      >
        {photos.length === 0 ? (
          <div className="queue-empty-state">
            <span style={{ fontSize: '28px' }}>📂</span>
            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>Queue is empty</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Drop photos in workspace or click Add Document
            </div>
          </div>
        ) : (
          photos.map((photo, index) => {
            const isSelected = photo.id === selectedPhotoId;
            const isFront = photo.id === frontPhotoId || photo.side === 'FRONT';
            const isBack = photo.id === backPhotoId || photo.side === 'BACK';

            let statusLabel = 'Ready';
            let statusBadgeClass = 'queue-badge--ready';
            if (photo.status === 'PROCESSING' || photo.status === 'PENDING') {
              statusLabel = 'Processing...';
              statusBadgeClass = 'queue-badge--processing';
            } else if (photo.status === 'FAILED') {
              statusLabel = 'Needs Manual';
              statusBadgeClass = 'queue-badge--failed';
            } else if (photo.confidenceLevel === 'LOW' || photo.status === 'NEEDS_REVIEW') {
              statusLabel = 'Verify';
              statusBadgeClass = 'queue-badge--warning';
            }

            const imgUrl = photo.processedUrl || photo.thumbnailUrl || photo.originalUrl;

            return (
              <div
                key={photo.id}
                className={`queue-card ${isSelected ? 'queue-card--selected' : ''}`}
                onClick={() => onSelectPhoto(photo.id)}
              >
                {/* Header row: Doc index, name & delete */}
                <div className="queue-card__header">
                  <div className="queue-card__title-group">
                    <span className="queue-card__index">#{index + 1}</span>
                    <span className="queue-card__name" title={photo.name}>
                      {photo.name}
                    </span>
                  </div>
                  <div className="queue-card__top-actions">
                    <button
                      type="button"
                      className="queue-card__action-btn"
                      title="Duplicate Document"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicatePhoto(photo.id);
                      }}
                    >
                      ⎘
                    </button>
                    <button
                      type="button"
                      className="queue-card__action-btn queue-card__action-btn--delete"
                      title="Delete from Queue"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePhoto(photo.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Body: Thumbnail & Details */}
                <div className="queue-card__body">
                  <div className="queue-card__thumb">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={photo.name}
                        onError={(e) => {
                          if (photo.originalUrl && (e.target as HTMLImageElement).src !== photo.originalUrl) {
                            (e.target as HTMLImageElement).src = photo.originalUrl;
                          }
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '20px' }}>📄</span>
                    )}
                  </div>

                  <div className="queue-card__meta">
                    {/* Status & Confidence */}
                    <div className="queue-card__status-row">
                      <span className={`queue-badge ${statusBadgeClass}`}>
                        {statusLabel}
                      </span>
                      {photo.confidence > 0 && (
                        <span className="queue-confidence">
                          {Math.round(photo.confidence * 100)}%
                        </span>
                      )}
                    </div>

                    {/* Side assignment pills */}
                    <div className="queue-card__side-pills" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`side-pill ${isFront ? 'side-pill--active-front' : ''}`}
                        onClick={() => onAssignSide(photo.id, 'FRONT')}
                        title="Assign as Front Side"
                      >
                        Front
                      </button>
                      <button
                        type="button"
                        className={`side-pill ${isBack ? 'side-pill--active-back' : ''}`}
                        onClick={() => onAssignSide(photo.id, 'BACK')}
                        title="Assign as Back Side"
                      >
                        Back
                      </button>
                    </div>

                    {/* Dimension / format info */}
                    <div className="queue-card__copies-tag">
                      {photo.processedWidth > 0 ? (
                        <span>{photo.processedWidth} × {photo.processedHeight} px</span>
                      ) : (
                        <span>Original</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Queue Footer Stats */}
      {photos.length > 0 && (
        <div className="sidebar-queue-footer">
          <div className="queue-stat">
            <span className="queue-stat__label">Total Documents</span>
            <span className="queue-stat__val">{photos.length}</span>
          </div>
          <div className="queue-stat">
            <span className="queue-stat__label">Assigned</span>
            <span className="queue-stat__val">
              {(frontPhotoId ? 1 : 0) + (backPhotoId ? 1 : 0)} / 2
            </span>
          </div>
        </div>
      )}

      {/* App Attribution Credits */}
      <div className="sidebar-app-credits">
        <div className="sidebar-app-credits__title">M.DoT Enterprises</div>
        <div className="sidebar-app-credits__meta">
          <span className="credits-owner">Shoeb Akther</span>
          <span className="credits-sep">·</span>
          <span className="credits-dev">Developed by Mohammad Asim</span>
        </div>
      </div>
    </aside>
  );
}
