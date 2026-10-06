import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Photo, LayoutMode, PrintSettings, EnhancementSettings, Corners } from './types';
import * as api from './services/api';
import { Header } from './components/Header';
import { SidebarQueue } from './components/SidebarQueue';
import { Workspace } from './components/Workspace';
import { RightPanel } from './components/RightPanel';
import { A4PrintSheet } from './components/A4PrintSheet';

export function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [frontPhotoId, setFrontPhotoId] = useState<string | null>(null);
  const [backPhotoId, setBackPhotoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'CARDS' | 'A4_PREVIEW'>('CARDS');

  const [layout, setLayout] = useState<LayoutMode>('SIDE_BY_SIDE');
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    layout: 'SIDE_BY_SIDE',
    copies: 1,
    marginMm: 5.0,
    cardWidthMm: 95.6,
    cardHeightMm: 60.3,
  });

  const [enhancementSettings, setEnhancementSettings] = useState<EnhancementSettings>({
    mode: 'ORIGINAL',
    brightness: 100,
    contrast: 100,
    sharpness: 0,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [serviceOnline, setServiceOnline] = useState(true);

  // Health check polling and initial photo fetch
  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const ok = await api.checkHealth();
      if (mounted) setServiceOnline(ok);
    };

    const loadPhotos = async () => {
      try {
        const fetched = await api.getAllPhotos();
        if (mounted && Array.isArray(fetched) && fetched.length > 0) {
          const mapped: Photo[] = fetched.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status || 'READY',
            side: p.side || null,
            originalWidth: p.originalWidth || 0,
            originalHeight: p.originalHeight || 0,
            processedWidth: p.processedWidth || 0,
            processedHeight: p.processedHeight || 0,
            confidence: p.confidence || 0,
            confidenceLevel: p.confidenceLevel || 'HIGH',
            detectionMethod: p.detectionMethod || 'OPENCV',
            message: p.message || null,
            corners: p.corners || null,
            processedUrl: `${api.getProcessedImageUrl(p.id)}?t=${Date.now()}`,
            originalUrl: api.getOriginalImageUrl(p.id),
          }));

          setPhotos(mapped);
          setSelectedPhotoId(mapped[0].id);

          const front = mapped.find((p) => p.side === 'FRONT') || mapped[0];
          const back = mapped.find((p) => p.side === 'BACK') || (mapped.length > 1 ? mapped[1] : null);

          if (front) setFrontPhotoId(front.id);
          if (back) setBackPhotoId(back.id);
        }
      } catch (err) {
        console.error('Failed to load initial photos:', err);
      }
    };

    check();
    loadPhotos();
    const timer = setInterval(check, 6000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  // Prevent browser from opening/navigating to image files if dropped outside target areas
  useEffect(() => {
    const preventDefault = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  // Sync layout changes
  const handleLayoutChange = useCallback((newLayout: LayoutMode) => {
    setLayout(newLayout);
    setPrintSettings((prev) => ({ ...prev, layout: newLayout }));
  }, []);

  // Upload & Process handler
  const handleFilesSelected = useCallback(async (files: File[], targetSide?: 'FRONT' | 'BACK') => {
    setIsProcessing(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${i}`;
      const optimisticPhoto: Photo = {
        id: tempId,
        name: file.name,
        status: 'PROCESSING',
        side: null,
        originalWidth: 0,
        originalHeight: 0,
        processedWidth: 0,
        processedHeight: 0,
        confidence: 0,
        confidenceLevel: 'HIGH',
        detectionMethod: 'OPENCV',
        message: 'Detecting card & correcting perspective...',
      };

      setPhotos((prev) => [...prev, optimisticPhoto]);
      setSelectedPhotoId(tempId);

      try {
        const result = await api.processPhoto(file);
        
        let finalResult = result;
        if (result.status === 'PROCESSING') {
          const startTime = Date.now();
          while (Date.now() - startTime < 10000) {
            await new Promise((r) => setTimeout(r, 250));
            try {
              const polled = await api.getPhoto(result.id);
              if (polled && polled.status !== 'PROCESSING') {
                finalResult = polled;
                break;
              }
            } catch {
              // retry
            }
          }
        }

        // Determine side assignment for this photo
        let assignedSide: 'FRONT' | 'BACK' | null = null;
        if (targetSide === 'FRONT') {
          assignedSide = i === 0 ? 'FRONT' : 'BACK';
        } else if (targetSide === 'BACK') {
          assignedSide = i === 0 ? 'BACK' : 'FRONT';
        } else {
          assignedSide = i === 0 && !frontPhotoId ? 'FRONT' : 'BACK';
        }

        if (assignedSide) {
          api.setPhotoSide(result.id, assignedSide).catch(() => {});
          if (assignedSide === 'FRONT') {
            setFrontPhotoId(result.id);
          } else {
            setBackPhotoId(result.id);
          }
        }

        const processedPhoto: Photo = {
          id: finalResult.id,
          name: finalResult.name || file.name,
          status: finalResult.status || 'READY',
          side: assignedSide || finalResult.side || null,
          originalWidth: finalResult.originalWidth || 0,
          originalHeight: finalResult.originalHeight || 0,
          processedWidth: finalResult.processedWidth || 0,
          processedHeight: finalResult.processedHeight || 0,
          confidence: finalResult.confidence || 0,
          confidenceLevel: finalResult.confidenceLevel || 'HIGH',
          detectionMethod: finalResult.detectionMethod || 'OPENCV',
          message: finalResult.message || null,
          corners: finalResult.corners || null,
          processedUrl: `${api.getProcessedImageUrl(finalResult.id)}?t=${Date.now()}`,
          originalUrl: api.getOriginalImageUrl(finalResult.id),
        };

        // Replace optimistic entry with real photo
        setPhotos((prev) =>
          prev.map((p) => (p.id === tempId ? processedPhoto : p))
        );
        setSelectedPhotoId(result.id);

      } catch (err: any) {
        console.error('Processing failed:', err);
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === tempId
              ? {
                  ...p,
                  status: 'FAILED',
                  message: err.message || 'Detection failed. Please retry.',
                }
              : p
          )
        );
      }
    }

    setIsProcessing(false);
  }, []);

  // Assign side
  const handleAssignSide = useCallback(
    async (id: string, side: 'FRONT' | 'BACK') => {
      try {
        await api.setPhotoSide(id, side);

        if (side === 'FRONT') {
          setFrontPhotoId(id);
          if (backPhotoId === id) setBackPhotoId(null);
        } else {
          setBackPhotoId(id);
          if (frontPhotoId === id) setFrontPhotoId(null);
        }

        setPhotos((prev) =>
          prev.map((p) => {
            if (p.id === id) return { ...p, side };
            if (p.side === side) return { ...p, side: null };
            return p;
          })
        );
      } catch (err) {
        console.error('Failed to set photo side:', err);
      }
    },
    [frontPhotoId, backPhotoId]
  );

  // Duplicate photo
  const handleDuplicatePhoto = useCallback(async (id: string) => {
    setIsProcessing(true);
    try {
      const dup = await api.duplicatePhoto(id);
      const mapped: Photo = {
        id: dup.id,
        name: dup.name,
        status: dup.status || 'READY',
        side: dup.side || null,
        originalWidth: dup.originalWidth || 0,
        originalHeight: dup.originalHeight || 0,
        processedWidth: dup.processedWidth || 0,
        processedHeight: dup.processedHeight || 0,
        confidence: dup.confidence || 0,
        confidenceLevel: dup.confidenceLevel || 'HIGH',
        detectionMethod: dup.detectionMethod || 'OPENCV',
        message: dup.message || null,
        corners: dup.corners || null,
        processedUrl: `${api.getProcessedImageUrl(dup.id)}?t=${Date.now()}`,
        originalUrl: api.getOriginalImageUrl(dup.id),
      };
      setPhotos((prev) => [...prev, mapped]);
      setSelectedPhotoId(dup.id);
      if (mapped.side === 'FRONT') setFrontPhotoId(dup.id);
      else if (mapped.side === 'BACK') setBackPhotoId(dup.id);
    } catch (err) {
      console.error('Duplicate failed:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Re-run Auto Crop
  const handleAutoCrop = useCallback(async (id: string) => {
    setIsProcessing(true);
    try {
      const res = await api.autoCropPhoto(id);
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: res.status || 'READY',
                confidence: res.confidence || p.confidence,
                confidenceLevel: res.confidenceLevel || p.confidenceLevel,
                detectionMethod: res.detectionMethod || p.detectionMethod,
                corners: res.corners || p.corners,
                processedWidth: res.processedWidth || p.processedWidth,
                processedHeight: res.processedHeight || p.processedHeight,
                processedUrl: `${api.getProcessedImageUrl(id)}?t=${Date.now()}`,
              }
            : p
        )
      );
    } catch (err) {
      console.error('Auto crop failed:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Manual Crop with perspective warp
  const handleManualCrop = useCallback(async (id: string, corners: Corners) => {
    setIsProcessing(true);
    try {
      const res = await api.cropPhoto(id, corners);
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: 'READY',
                confidence: 1.0,
                confidenceLevel: 'HIGH',
                detectionMethod: 'MANUAL',
                corners,
                processedWidth: res.processedWidth || p.processedWidth,
                processedHeight: res.processedHeight || p.processedHeight,
                processedUrl: `${api.getProcessedImageUrl(id)}?t=${Date.now()}`,
              }
            : p
        )
      );
    } catch (err) {
      console.error('Manual crop failed:', err);
      alert('Manual crop failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Remove photo
  const handleRemovePhoto = useCallback(
    async (id: string) => {
      try {
        await api.removePhoto(id);
      } catch {
        // Continue removing from local state
      }

      setPhotos((prev) => prev.filter((p) => p.id !== id));
      if (frontPhotoId === id) setFrontPhotoId(null);
      if (backPhotoId === id) setBackPhotoId(null);
      if (selectedPhotoId === id) {
        setSelectedPhotoId(null);
      }
    },
    [frontPhotoId, backPhotoId, selectedPhotoId]
  );

  // Clear all queue in one click
  const handleClearQueue = useCallback(async () => {
    try {
      await api.clearAllPhotos();
    } catch (err) {
      console.error('Failed to clear photos on backend:', err);
    }
    setPhotos([]);
    setSelectedPhotoId(null);
    setFrontPhotoId(null);
    setBackPhotoId(null);
  }, []);

  // Rotate photo
  const handleRotate = useCallback(
    async (angle: number) => {
      if (!selectedPhotoId) return;
      setIsProcessing(true);
      try {
        await api.rotatePhoto(selectedPhotoId, angle);
        // Bust image cache
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === selectedPhotoId
              ? {
                  ...p,
                  processedUrl: `${api.getProcessedImageUrl(selectedPhotoId)}?t=${Date.now()}`,
                }
              : p
          )
        );
      } catch (err) {
        console.error('Rotation failed:', err);
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedPhotoId]
  );

  // Apply enhancement filter
  const handleApplyEnhancement = useCallback(async (customSettings?: EnhancementSettings) => {
    if (!selectedPhotoId) return;
    const settings = customSettings || enhancementSettings;
    if (customSettings) {
      setEnhancementSettings(customSettings);
    }
    setIsProcessing(true);
    try {
      await api.enhancePhoto(
        selectedPhotoId,
        settings.mode,
        settings.brightness,
        settings.contrast,
        settings.sharpness
      );
      const newTimestamp = Date.now();
      // Bust image cache on active photo
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === selectedPhotoId
            ? {
                ...p,
                processedUrl: `${api.getProcessedImageUrl(selectedPhotoId)}?t=${newTimestamp}`,
              }
            : p
        )
      );
    } catch (err) {
      console.error('Enhancement failed:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPhotoId, enhancementSettings]);

  // Native print: simply call window.print() exactly like pressing Ctrl + P
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Listen for native Ctrl+P / Cmd+P keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrint]);

  // Derived objects
  const selectedPhoto = useMemo(
    () => photos.find((p) => p.id === selectedPhotoId) || (photos.length > 0 ? photos[0] : null),
    [photos, selectedPhotoId]
  );

  const frontPhoto = useMemo(() => {
    if (frontPhotoId) return photos.find((p) => p.id === frontPhotoId) || null;
    return photos.find((p) => p.side === 'FRONT') || null;
  }, [photos, frontPhotoId]);

  const backPhoto = useMemo(() => {
    if (backPhotoId) return photos.find((p) => p.id === backPhotoId) || null;
    return photos.find((p) => p.side === 'BACK') || null;
  }, [photos, backPhotoId]);

  return (
    <>
      <div className="app-layout">
        <Header serviceOnline={serviceOnline} />

        <div className="app-content">
          <SidebarQueue
            photos={photos}
            selectedPhotoId={selectedPhoto?.id || null}
            frontPhotoId={frontPhotoId}
            backPhotoId={backPhotoId}
            copies={printSettings.copies}
            onSelectPhoto={setSelectedPhotoId}
            onRemovePhoto={handleRemovePhoto}
            onDuplicatePhoto={handleDuplicatePhoto}
            onAssignSide={handleAssignSide}
            onAddFiles={handleFilesSelected}
            onClearQueue={handleClearQueue}
          />

          <Workspace
            photos={photos}
            selectedPhoto={selectedPhoto}
            frontPhoto={frontPhoto}
            backPhoto={backPhoto}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            layout={layout}
            printSettings={printSettings}
            enhancementSettings={enhancementSettings}
            onFilesSelected={handleFilesSelected}
            onAssignSide={handleAssignSide}
            onSelectPhoto={setSelectedPhotoId}
            onRotate={handleRotate}
            onAutoCrop={handleAutoCrop}
            onManualCrop={handleManualCrop}
            onApplyEnhancement={handleApplyEnhancement}
            isProcessing={isProcessing}
          />

          <RightPanel
            selectedPhoto={selectedPhoto}
            frontPhoto={frontPhoto}
            backPhoto={backPhoto}
            layout={layout}
            onChangeLayout={handleLayoutChange}
            enhancementSettings={enhancementSettings}
            onChangeEnhancement={setEnhancementSettings}
            onApplyEnhancement={handleApplyEnhancement}
            onRotate={handleRotate}
            onPrint={handlePrint}
            isProcessing={isProcessing}
          />
        </div>
      </div>

      {/* Standalone Native Print Container (Outside app-layout so it is visible during window.print()) */}
      <A4PrintSheet
        frontPhoto={frontPhoto || (photos.length > 0 ? photos[0] : null)}
        backPhoto={backPhoto || (photos.length > 1 ? photos[1] : null)}
        layout={layout}
      />
    </>
  );
}

export default App;
