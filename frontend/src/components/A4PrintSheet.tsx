import type { Photo, LayoutMode } from '../types';

interface A4PrintSheetProps {
  frontPhoto: Photo | null;
  backPhoto: Photo | null;
  layout: LayoutMode;
}

export function A4PrintSheet({ frontPhoto, backPhoto, layout }: A4PrintSheetProps) {
  const frontImg = frontPhoto?.processedUrl || frontPhoto?.thumbnailUrl || frontPhoto?.originalUrl;
  const backImg = backPhoto?.processedUrl || backPhoto?.thumbnailUrl || backPhoto?.originalUrl;

  const isSideBySide = layout === 'SIDE_BY_SIDE';

  return (
    <div id="a4-print-sheet" className="a4-print-sheet" aria-hidden="true">
      <div className="a4-page a4-page--print">
        <div
          className={`a4-page__content ${
            isSideBySide ? 'a4-page__content--side-by-side' : 'a4-page__content--top-bottom'
          }`}
        >
          {frontImg ? (
            <div className="a4-card" title="Front Card">
              <img src={frontImg} alt="Card Front" />
            </div>
          ) : (
            <div className="a4-card a4-card--placeholder" title="Front Slot">
              <span style={{ color: '#aaa', fontSize: '12px' }}>Front Card Slot</span>
            </div>
          )}

          {backImg ? (
            <div className="a4-card" title="Back Card">
              <img src={backImg} alt="Card Back" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
