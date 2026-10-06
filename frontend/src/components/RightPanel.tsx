import { useState } from 'react';
import type { Photo, LayoutMode, EnhancementSettings } from '../types';

interface RightPanelProps {
  selectedPhoto: Photo | null;
  frontPhoto: Photo | null;
  backPhoto: Photo | null;
  layout: LayoutMode;
  onChangeLayout: (layout: LayoutMode) => void;
  enhancementSettings: EnhancementSettings;
  onChangeEnhancement: (settings: EnhancementSettings) => void;
  onApplyEnhancement: (customSettings?: EnhancementSettings) => void;
  onRotate: (angle: number) => void;
  onPrint: () => void;
  isProcessing: boolean;
}

export function RightPanel({
  selectedPhoto,
  frontPhoto,
  backPhoto,
  layout,
  onChangeLayout,
  enhancementSettings,
  onChangeEnhancement,
  onApplyEnhancement,
  onRotate,
  onPrint,
  isProcessing,
}: RightPanelProps) {
  // Collapsible sections state
  const [layoutOpen, setLayoutOpen] = useState(true);
  const [enhanceOpen, setEnhanceOpen] = useState(true);

  const filterModes: Array<{ id: EnhancementSettings['mode']; label: string }> = [
    { id: 'ORIGINAL', label: 'Original' },
    { id: 'AUTO', label: 'Auto' },
    { id: 'SCAMCANNER', label: 'Scan' },
    { id: 'DOCUMENT', label: 'Doc' },
    { id: 'GRAYSCALE', label: 'Gray' },
    { id: 'BLACK_AND_WHITE', label: 'B&W' },
  ];

  const frontImg = frontPhoto?.processedUrl || frontPhoto?.originalUrl;
  const backImg = backPhoto?.processedUrl || backPhoto?.originalUrl;

  return (
    <aside className="sidebar-right">
      {/* 1. Live A4 Sheet Thumbnail */}
      <div className="mini-a4-panel">
        <div className="mini-a4-panel__title">
          <span>A4 PRINT PREVIEW</span>
          <span className="mini-a4-dim">210 × 297 mm</span>
        </div>
        <div className="mini-a4-sheet-wrap">
          <div className="mini-a4-sheet">
            <div
              className={`mini-a4-content ${
                layout === 'SIDE_BY_SIDE'
                  ? 'mini-a4-content--side-by-side'
                  : 'mini-a4-content--top-bottom'
              }`}
            >
              {/* Front Card slot */}
              <div className={`mini-a4-card ${!frontImg ? 'mini-a4-card--placeholder' : ''}`} title="Front Card">
                {frontImg ? (
                  <img src={frontImg} alt="Front" />
                ) : (
                  <span className="mini-a4-slot-placeholder">Front</span>
                )}
              </div>

              {/* Back Card slot */}
              <div className={`mini-a4-card ${!backImg ? 'mini-a4-card--placeholder' : ''}`} title="Back Card">
                {backImg ? (
                  <img src={backImg} alt="Back" />
                ) : (
                  <span className="mini-a4-slot-placeholder">Back</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Primary Final Action Button */}
      <div className="primary-print-actions">
        <button
          type="button"
          className="btn btn--primary btn--lg btn--full print-btn-hero"
          onClick={onPrint}
        >
          🖨️ PRINT
        </button>
      </div>

      {/* Collapsible Accordion Sections */}
      <div className="accordion-sections">
        {/* SECTION: LAYOUT */}
        <div className="accordion-section">
          <div
            className="accordion-header"
            onClick={() => setLayoutOpen(!layoutOpen)}
          >
            <span className="accordion-title">LAYOUT</span>
            <span className="accordion-arrow">{layoutOpen ? '▾' : '▸'}</span>
          </div>

          {layoutOpen && (
            <div className="accordion-body">
              <div className="layout-options">
                <div
                  className={`layout-option ${layout === 'SIDE_BY_SIDE' ? 'layout-option--active' : ''}`}
                  onClick={() => onChangeLayout('SIDE_BY_SIDE')}
                >
                  <div className="layout-option__visual layout-visual--sbs">
                    <div className="layout-visual__card"></div>
                    <div className="layout-visual__card"></div>
                  </div>
                  <div className="layout-option__label">Side by Side</div>
                </div>

                <div
                  className={`layout-option ${layout === 'TOP_BOTTOM' ? 'layout-option--active' : ''}`}
                  onClick={() => onChangeLayout('TOP_BOTTOM')}
                >
                  <div className="layout-option__visual layout-visual--tb">
                    <div className="layout-visual__card"></div>
                    <div className="layout-visual__card"></div>
                  </div>
                  <div className="layout-option__label">Top - Bottom</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION: CROP & ENHANCE */}
        <div className="accordion-section">
          <div
            className="accordion-header"
            onClick={() => setEnhanceOpen(!enhanceOpen)}
          >
            <span className="accordion-title">CROP & ENHANCE</span>
            <span className="accordion-arrow">{enhanceOpen ? '▾' : '▸'}</span>
          </div>

          {enhanceOpen && (
            <div className="accordion-body">
              {/* Presets */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span className="sub-label" style={{ marginBottom: 0 }}>PRESET FILTER</span>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    onClick={() => {
                      const resetVal: EnhancementSettings = { mode: 'ORIGINAL', brightness: 100, contrast: 100, sharpness: 0 };
                      onChangeEnhancement(resetVal);
                      onApplyEnhancement(resetVal);
                    }}
                    title="Reset all filters back to original"
                  >
                    ↺ Reset to Original
                  </button>
                </div>
                <div className="filter-group">
                  {filterModes.map((fm) => (
                    <button
                      key={fm.id}
                      type="button"
                      className={`filter-btn ${enhancementSettings.mode === fm.id ? 'filter-btn--active' : ''}`}
                      disabled={!selectedPhoto || isProcessing}
                      onClick={() => {
                        const updated = { ...enhancementSettings, mode: fm.id };
                        onChangeEnhancement(updated);
                        onApplyEnhancement(updated);
                      }}
                    >
                      {fm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div className="slider-row">
                <div className="slider-row__header">
                  <span className="slider-row__label">Brightness</span>
                  <span className="slider-row__value">{enhancementSettings.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={enhancementSettings.brightness}
                  className="slider-input"
                  disabled={!selectedPhoto || isProcessing}
                  onChange={(e) => {
                    onChangeEnhancement({
                      ...enhancementSettings,
                      brightness: Number(e.target.value),
                    });
                  }}
                  onPointerUp={() => onApplyEnhancement()}
                  onKeyUp={() => onApplyEnhancement()}
                />
              </div>

              <div className="slider-row">
                <div className="slider-row__header">
                  <span className="slider-row__label">Contrast</span>
                  <span className="slider-row__value">{enhancementSettings.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={enhancementSettings.contrast}
                  className="slider-input"
                  disabled={!selectedPhoto || isProcessing}
                  onChange={(e) => {
                    onChangeEnhancement({
                      ...enhancementSettings,
                      contrast: Number(e.target.value),
                    });
                  }}
                  onPointerUp={() => onApplyEnhancement()}
                  onKeyUp={() => onApplyEnhancement()}
                />
              </div>

              <div className="slider-row">
                <div className="slider-row__header">
                  <span className="slider-row__label">Sharpness</span>
                  <span className="slider-row__value">{enhancementSettings.sharpness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={enhancementSettings.sharpness}
                  className="slider-input"
                  disabled={!selectedPhoto || isProcessing}
                  onChange={(e) => {
                    onChangeEnhancement({
                      ...enhancementSettings,
                      sharpness: Number(e.target.value),
                    });
                  }}
                  onPointerUp={() => onApplyEnhancement()}
                  onKeyUp={() => onApplyEnhancement()}
                />
              </div>

              <div className="action-row" style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  style={{ flex: 1 }}
                  disabled={!selectedPhoto || isProcessing}
                  onClick={() => onRotate(90)}
                  title="Rotate 90 degrees clockwise"
                >
                  ↻ Rotate 90°
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  style={{ flex: 1 }}
                  disabled={!selectedPhoto || isProcessing}
                  onClick={() => {
                    const resetVal: EnhancementSettings = { mode: 'ORIGINAL', brightness: 100, contrast: 100, sharpness: 0 };
                    onChangeEnhancement(resetVal);
                    onApplyEnhancement(resetVal);
                  }}
                  title="Reset all filters back to original"
                >
                  ↺ Reset
                </button>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  style={{ flex: 1 }}
                  disabled={!selectedPhoto || isProcessing}
                  onClick={() => onApplyEnhancement()}
                >
                  {isProcessing ? 'Applying...' : 'Apply Filter'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
