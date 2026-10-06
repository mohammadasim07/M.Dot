import { useState, useCallback, useRef } from 'react';

interface DropZoneProps {
  onFilesSelected: (files: File[], side?: 'FRONT' | 'BACK') => void;
  side?: 'FRONT' | 'BACK';
  title?: string;
  hint?: string;
}

const isImageFile = (file: File): boolean => {
  if (file.type && file.type.startsWith('image/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext ? ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'jfif', 'tif', 'tiff', 'gif', 'svg'].includes(ext) : true;
};

const extractFiles = (e: React.DragEvent): File[] => {
  const result: File[] = [];
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const f = e.dataTransfer.files[i];
      if (f && isImageFile(f)) result.push(f);
    }
  } else if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
    for (let i = 0; i < e.dataTransfer.items.length; i++) {
      const item = e.dataTransfer.items[i];
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f && isImageFile(f)) result.push(f);
      }
    }
  }
  return result;
};

export function DropZone({ onFilesSelected, side, title, hint }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isFront = side === 'FRONT';
  const isBack = side === 'BACK';

  const badgeText = isFront ? '🪪 FRONT SIDE' : isBack ? '🔄 BACK SIDE' : '📄 ID CARD';
  const badgeClass = isFront ? 'drop-zone__badge--front' : isBack ? 'drop-zone__badge--back' : '';
  const sideClass = isFront ? 'drop-zone--front' : isBack ? 'drop-zone--back' : '';
  const defaultTitle = isFront ? 'Drop Front photo here' : isBack ? 'Drop Back photo here' : 'Drop photo here';
  const defaultHint = isFront
    ? 'or click to upload Front ID · JPG / PNG'
    : isBack
    ? 'or click to upload Back ID · JPG / PNG'
    : 'or click to upload · JPG / PNG';

  const displayTitle = title || defaultTitle;
  const displayHint = hint || defaultHint;

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const files = extractFiles(e);
      if (files.length > 0) {
        onFilesSelected(files, side);
      }
    },
    [onFilesSelected, side]
  );

  const handleClick = () => inputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files).filter(isImageFile) : [];
    if (files.length > 0) onFilesSelected(files, side);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      className={`drop-zone ${sideClass} ${isDragOver ? 'drop-zone--active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <div className={`drop-zone__badge ${badgeClass}`}>{badgeText}</div>
      <div className="drop-zone__icon">+</div>
      <div className="drop-zone__text">{displayTitle}</div>
      <div className="drop-zone__hint">{displayHint}</div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/bmp,image/*"
        multiple
        className="hidden-input"
        onChange={handleFileChange}
      />
    </div>
  );
}
