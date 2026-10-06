import time
import cv2
from app.utils import read_image_bytes, create_inference_copy
from app.detection import CardDetector
from app.processing import perspective_transform, scale_corners_to_original
from app.enhancement import apply_enhancement

detector = CardDetector()
detector.initialize()

with open(r'd:\project\MDotenterprises\test_cards\id_front.jpg', 'rb') as f:
    data = f.read()

t0 = time.perf_counter()
orig = read_image_bytes(data)

t1 = time.perf_counter()
inf_img, sx, sy = create_inference_copy(orig)

t2 = time.perf_counter()
det = detector.detect(inf_img)

t3 = time.perf_counter()
cor_orig = scale_corners_to_original(det['corners'], sx, sy)
cor = perspective_transform(orig, cor_orig)

t4 = time.perf_counter()
enh = apply_enhancement(cor, 'AUTO')

t5 = time.perf_counter()

print(f"1. Read bytes & EXIF: {t1 - t0:.4f}s")
print(f"2. Inference resize:  {t2 - t1:.4f}s")
print(f"3. Card Detection:    {t3 - t2:.4f}s")
print(f"4. Perspective warp:  {t4 - t3:.4f}s")
print(f"5. Auto Enhancement:  {t5 - t4:.4f}s")
print(f"Total pipeline time:  {t5 - t0:.4f}s")
