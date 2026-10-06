import type { Photo, LayoutMode, PrintSettings } from '../types';

interface A4PreviewProps {
  frontPhoto: Photo | null;
  backPhoto: Photo | null;
  layout: LayoutMode;
  printSettings: PrintSettings;
}

export function A4Preview({ frontPhoto, backPhoto, layout, printSettings }: A4PreviewProps) {
  const frontImg = frontPhoto?.processedUrl || frontPhoto?.thumbnailUrl || frontPhoto?.originalUrl;
  const backImg = backPhoto?.processedUrl || backPhoto?.thumbnailUrl || backPhoto?.originalUrl;

  const isSideBySide = layout === 'SIDE_BY_SIDE';

  return (
    <div className="a4-preview-container" id="a4-preview-root">
      <div className="a4-preview-wrapper">
        <div className="a4-page">
          <div
            className={`a4-page__content ${
              isSideBySide ? 'a4-page__content--side-by-side' : 'a4-page__content--top-bottom'
            }`}
          >
            {/* Front Card */}
            <div className={`a4-card ${!frontImg ? 'a4-card--placeholder' : ''}`} title="Front Card">
              {frontImg ? (
                <img src={frontImg} alt="Card Front" />
              ) : (
                <div style={{ color: '#999', fontSize: '11px', textAlign: 'center', padding: '8px' }}>
                  Front Card Slot
                </div>
              )}
            </div>

            {/* Back Card */}
            <div className={`a4-card ${!backImg ? 'a4-card--placeholder' : ''}`} title="Back Card">
              {backImg ? (
                <img src={backImg} alt="Card Back" />
              ) : (
                <div style={{ color: '#999', fontSize: '11px', textAlign: 'center', padding: '8px' }}>
                  Back Card Slot
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          className="btn btn--primary btn--md"
          onClick={() => window.print()}
          style={{ minWidth: '180px', fontWeight: 700 }}
        >
          🖨️ PRINT
        </button>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          A4 Sheet: 210 × 297 mm · Card Size: {printSettings.cardWidthMm} × {printSettings.cardHeightMm} mm · Manual Print Format
        </div>
      </div>
    </div>
  );
}
