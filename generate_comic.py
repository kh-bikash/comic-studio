import os
import argparse
import sys
import requests
from io import BytesIO
import urllib.parse
from PIL import Image, ImageDraw, ImageFont, ImageOps


def wrap_text(text, font, draw, max_width):
    """Wrap text to fit within a maximum width in pixels."""
    words = text.split()
    lines = []
    current_line = []
    
    for word in words:
        current_line.append(word)
        # Check size of line with the new word
        line_text = " ".join(current_line)
        bbox = draw.textbbox((0, 0), line_text, font=font)
        line_width = bbox[2] - bbox[0]
        
        if line_width > max_width:
            if len(current_line) == 1:
                # Word is too long for a single line, must add it
                lines.append(line_text)
                current_line = []
            else:
                # Remove last word, add line, start new line with the word
                current_line.pop()
                lines.append(" ".join(current_line))
                current_line = [word]
                
    if current_line:
        lines.append(" ".join(current_line))
        
    return lines


def add_comic_styling(image, text, panel_number=None, font_path=None):
    """
    Adds a solid comic border and overlays a narration box at the bottom.
    """
    width, height = image.size
    
    # 1. Add thick black border around the generated panel
    border_width = 12
    bordered_image = ImageOps.expand(image, border=border_width, fill="black")
    b_width, b_height = bordered_image.size
    
    # Prepare to draw on the image
    draw = ImageDraw.Draw(bordered_image)
    
    # Load Comic Sans MS if on Windows, otherwise fall back to default
    font = None
    if font_path and os.path.exists(font_path):
        try:
            font = ImageFont.truetype(font_path, 20)
        except Exception:
            pass
            
    if font is None:
        # Check standard Windows path
        win_comic_font = r"C:\Windows\Fonts\comic.ttf"
        if os.path.exists(win_comic_font):
            try:
                font = ImageFont.truetype(win_comic_font, 22)
            except Exception:
                pass
                
    if font is None:
        font = ImageFont.load_default()

    # 2. Add Panel Number box in the top-left (e.g. "1")
    if panel_number is not None:
        num_str = f"PANEL {panel_number}"
        num_bbox = draw.textbbox((0, 0), num_str, font=font)
        num_w = num_bbox[2] - num_bbox[0] + 16
        num_h = num_bbox[3] - num_bbox[1] + 12
        
        # Draw small rectangular label for panel number
        draw.rectangle([border_width, border_width, border_width + num_w, border_width + num_h], fill="black")
        draw.text((border_width + 8, border_width + 6), num_str, fill="white", font=font)

    # 3. Add a yellow narration box at the bottom if text is provided
    if text and text.strip():
        # Text wrapping
        padding = 15
        max_text_width = b_width - (border_width * 2) - (padding * 2)
        wrapped_lines = wrap_text(text, font, draw, max_text_width)
        
        # Calculate narration box height based on wrapped lines
        line_height = draw.textbbox((0, 0), "Abc", font=font)[3] - draw.textbbox((0, 0), "Abc", font=font)[1]
        box_height = (line_height * len(wrapped_lines)) + (padding * 2)
        
        # Box coordinates
        box_left = border_width
        box_right = b_width - border_width
        box_bottom = b_height - border_width
        box_top = box_bottom - box_height
        
        # Draw narration box (pastel yellow with a black border)
        draw.rectangle([box_left, box_top, box_right, box_bottom], fill="#FFF9C4", outline="black", width=4)
        
        # Write wrapped text inside the box
        y_cursor = box_top + padding
        for line in wrapped_lines:
            line_bbox = draw.textbbox((0, 0), line, font=font)
            line_w = line_bbox[2] - line_bbox[0]
            # Center the text in the box
            x_pos = box_left + (max_text_width + padding * 2 - line_w) // 2
            draw.text((x_pos, y_cursor), line, fill="black", font=font)
            y_cursor += line_height

    return bordered_image


def generate_panel_from_api(prompt, width=512, height=512, seed=42):
    """
    Sends a request to the Pollinations.ai free API and returns a PIL Image.
    """
    # Enhance the prompt to enforce a children's comic book styling
    enhanced_prompt = f"{prompt}, children's comic book illustration, vibrant colors, clean vector outlines, child-friendly digital art"
    encoded_prompt = urllib.parse.quote(enhanced_prompt)
    
    # Pollinations.ai Text-to-Image API URL
    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&seed={seed}&nologo=true&private=true"
    
    print(f"Sending API request to Pollinations.ai...")
    response = requests.get(url, timeout=30)
    
    if response.status_code == 200:
        image = Image.open(BytesIO(response.content))
        return image
    else:
        raise Exception(f"API request failed with status code {response.status_code}: {response.text}")


def main():
    parser = argparse.ArgumentParser(description="Generate a styled children's comic panel using the free Pollinations.ai API.")
    parser.add_argument("--prompt", type=str, required=True, help="Illustration prompt for the comic panel.")
    parser.add_argument("--text", type=str, default="", help="Narration text/dialogue to put in the panel.")
    parser.add_argument("--panel_num", type=int, default=None, help="Optional panel number (e.g. 1, 2, 3...)")
    parser.add_argument("--output", type=str, default="comic_panel.png", help="Path to save the output image.")
    parser.add_argument("--height", type=int, default=512, help="Height of generated image (default 512).")
    parser.add_argument("--width", type=int, default=512, help="Width of generated image (default 512).")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (default 42).")
    parser.add_argument("--font", type=str, default=None, help="Optional path to a custom TTF font.")
    args = parser.parse_args()

    print("==================================================")
    print("       FREE API COMIC PANEL GENERATOR")
    print("==================================================")
    print(f"Prompt            : {args.prompt}")
    print(f"Narration Text    : {args.text}")
    print(f"Output Resolution : {args.width}x{args.height}")
    print(f"Seed              : {args.seed}")
    print("==================================================")
    
    try:
        print("\n[1/2] Fetching image from cloud API...")
        raw_image = generate_panel_from_api(args.prompt, args.width, args.height, args.seed)
        
        print("\n[2/2] Applying comic book styling and overlaying text...")
        comic_panel = add_comic_styling(raw_image, args.text, args.panel_num, args.font)
        
        # Save output
        comic_panel.save(args.output)
        print(f"\nSUCCESS! Comic panel saved to: {args.output}")
        print("==================================================")
        
    except Exception as e:
        print(f"\nERROR: Generation failed.")
        print(f"Details: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
