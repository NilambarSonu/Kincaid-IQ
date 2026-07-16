import os
from PIL import Image

def process_favicon():
    icon_path = r"c:\Users\Asus\Downloads\Kincaid-IQ\Kincaid-IQ\client\public\icon.png"
    favicon_path = r"c:\Users\Asus\Downloads\Kincaid-IQ\Kincaid-IQ\client\public\favicon.png"
    
    try:
        # Open icon
        icon = Image.open(icon_path).convert("RGBA")
        
        # Create a new image with white background
        background = Image.new("RGBA", icon.size, (255, 255, 255, 255))
        
        # Paste the icon onto the background using the icon's alpha channel as mask
        background.paste(icon, (0, 0), icon)
        
        # Save as favicon
        background.save(favicon_path, "PNG")
        print("Favicon updated successfully.")
    except Exception as e:
        print(f"Error processing favicon: {e}")

if __name__ == "__main__":
    process_favicon()
