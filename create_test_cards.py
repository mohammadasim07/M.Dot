import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs(r"d:\project\MDotenterprises\test_cards", exist_ok=True)

# Create a background scene with a card placed at an angle (simulating real user photo)
def create_card_photo(filename, title, id_num, is_front=True):
    # Scene size 1200x800
    scene = Image.new('RGB', (1200, 800), color=(220, 225, 230))
    draw_scene = ImageDraw.Draw(scene)
    
    # Draw desk surface texture / lines
    for y in range(0, 800, 40):
        draw_scene.line([(0, y), (1200, y)], fill=(210, 215, 220), width=1)
        
    # Card size (aspect ratio 85.6 / 54 ~= 1.585) -> e.g. 634 x 400
    card = Image.new('RGB', (634, 400), color=(255, 255, 255))
    draw_card = ImageDraw.Draw(card)
    
    # Header banner on card
    banner_color = (25, 75, 160) if is_front else (40, 110, 80)
    draw_card.rectangle([(0, 0), (634, 70)], fill=banner_color)
    
    # Text
    draw_card.text((20, 20), title, fill=(255, 255, 255))
    draw_card.text((20, 90), f"ID NUMBER: {id_num}", fill=(20, 20, 20))
    
    if is_front:
        # Photo box
        draw_card.rectangle([(30, 140), (180, 320)], fill=(200, 210, 225), outline=(100, 100, 100), width=2)
        draw_card.text((65, 220), "PHOTO", fill=(80, 80, 80))
        
        # Details
        draw_card.text((210, 150), "NAME: ALEX R. MORGAN", fill=(20, 20, 20))
        draw_card.text((210, 190), "DOB: 14/08/1992", fill=(20, 20, 20))
        draw_card.text((210, 230), "NATIONALITY: DEMO CITIZEN", fill=(20, 20, 20))
        draw_card.text((210, 270), "EXPIRES: 31/12/2030", fill=(20, 20, 20))
    else:
        # Address & Barcode
        draw_card.text((30, 140), "PERMANENT ADDRESS:", fill=(20, 20, 20))
        draw_card.text((30, 170), "42 METRO BOULEVARD, SECTOR 9", fill=(50, 50, 50))
        draw_card.text((30, 200), "NEW CAPITAL CITY, 100001", fill=(50, 50, 50))
        
        # Barcode simulation
        for bx in range(30, 600, 8):
            draw_card.line([(bx, 270), (bx, 340)], fill=(0, 0, 0), width=4 if bx % 16 == 0 else 2)
            
    # Paste card onto scene
    # Place it centered: (1200 - 634)/2 = 283, (800 - 400)/2 = 200
    scene.paste(card, (283, 200))
    
    # Add a thin shadow around the card
    draw_scene.rectangle([(281, 198), (283 + 635, 200 + 401)], outline=(180, 185, 190), width=2)
    
    filepath = os.path.join(r"d:\project\MDotenterprises\test_cards", filename)
    scene.save(filepath, "JPEG", quality=95)
    print(f"Created {filepath}")

create_card_photo("id_front.jpg", "NATIONAL IDENTITY CARD - FRONT", "ID-9824-7120", is_front=True)
create_card_photo("id_back.jpg", "NATIONAL IDENTITY CARD - BACK", "ID-9824-7120", is_front=False)
