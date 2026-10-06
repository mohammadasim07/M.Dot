const API_BASE = 'http://localhost:8080/api';

export async function processPhoto(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('image', file);
  
  const response = await fetch(`${API_BASE}/photos/process`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(error.message || 'Failed to process photo');
  }
  
  return response.json();
}

export async function getAllPhotos(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/photos`);
  if (!response.ok) throw new Error('Failed to fetch photos');
  return response.json();
}

export async function getPhoto(id: string): Promise<any> {
  const response = await fetch(`${API_BASE}/photos/${id}`);
  if (!response.ok) throw new Error('Failed to fetch photo');
  return response.json();
}

export function getProcessedImageUrl(id: string): string {
  return `${API_BASE}/photos/${id}/image`;
}

export function getOriginalImageUrl(id: string): string {
  return `${API_BASE}/photos/${id}/original`;
}

export async function setPhotoSide(id: string, side: string): Promise<any> {
  const response = await fetch(`${API_BASE}/photos/${id}/side`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ side }),
  });
  if (!response.ok) throw new Error('Failed to set photo side');
  return response.json();
}

export async function enhancePhoto(
  id: string,
  mode: string,
  brightness: number,
  contrast: number,
  sharpness: number
): Promise<any> {
  const response = await fetch(`${API_BASE}/photos/${id}/enhance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, brightness, contrast, sharpness }),
  });
  if (!response.ok) throw new Error('Enhancement failed');
  return response.json();
}

export async function rotatePhoto(id: string, angle: number): Promise<any> {
  const response = await fetch(`${API_BASE}/photos/${id}/rotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ angle }),
  });
  if (!response.ok) throw new Error('Rotation failed');
  return response.json();
}

export async function cropPhoto(id: string, corners: import('../types').Corners): Promise<any> {
  const response = await fetch(`${API_BASE}/photos/${id}/crop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corners),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Manual crop failed' }));
    throw new Error(error.message || 'Crop failed');
  }
  return response.json();
}

export async function autoCropPhoto(id: string): Promise<any> {
  const response = await fetch(`${API_BASE}/photos/${id}/auto-crop`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Auto-crop failed');
  return response.json();
}

export async function duplicatePhoto(id: string): Promise<any> {
  const response = await fetch(`${API_BASE}/photos/${id}/duplicate`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Duplicate failed');
  return response.json();
}

export async function removePhoto(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/photos/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to remove photo');
}

export async function clearAllPhotos(): Promise<void> {
  const response = await fetch(`${API_BASE}/photos`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to clear photos');
}

export async function exportPdf(settings: {
  layout: string;
  copies: number;
  marginMm: number;
  cardWidthMm: number;
  cardHeightMm: number;
  frontId?: string;
  backId?: string;
}): Promise<Blob> {
  const response = await fetch(`${API_BASE}/pdf/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'PDF export failed' }));
    throw new Error(error.message || 'PDF export failed');
  }
  
  return response.blob();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`, { 
      signal: AbortSignal.timeout(3000) 
    });
    return response.ok;
  } catch {
    return false;
  }
}
