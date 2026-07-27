import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional
from PIL import Image, ImageDraw, ImageFont, ImageOps
from concurrent.futures import ThreadPoolExecutor

# Ensure current dir is in python path
sys.path.append(os.path.dirname(__file__))

from generate_comic import add_comic_styling, generate_panel_from_api, wrap_text

app = FastAPI(title="Comic Book Studio API")

# Ensure directories exist
OUTPUTS_DIR = os.path.join(os.path.dirname(__file__), "static", "outputs")
os.makedirs(OUTPUTS_DIR, exist_ok=True)

# Art Style Presets prompt modifiers
STYLE_MODIFIERS = {
    "watercolor": ", watercolor painting, soft pastel colors, children's storybook illustration, textured paper",
    "popart": ", retro comic book style, pop art, halftone dot shading, bold black outlines, ink sketch",
    "claymation": ", 3d clay model style, stop-motion animation, plasticine textures, cute clay figurine, studio lighting",
    "crayon": ", colored pencil drawing, crayon scribble texture, hand-drawn child sketch, warm colors"
}


class PanelInput(BaseModel):
    prompt: str
    text: str


class ComicGenerationRequest(BaseModel):
    panels: List[PanelInput]
    layout: str  # "horizontal", "vertical", "grid"
    width: int = 512
    height: int = 512
    seed: int = 42
    style: str = "watercolor"
    is_cover: bool = False
    title: str = ""
    author: str = ""


class PdfDownloadRequest(BaseModel):
    urls: List[str]


def add_cover_styling(image, title, author):
    """Adds a solid comic border and overlays styled Book Title and Author boxes."""
    width, height = image.size
    
    # 1. Add thick black border
    border_width = 12
    bordered_image = ImageOps.expand(image, border=border_width, fill="black")
    b_width, b_height = bordered_image.size
    
    draw = ImageDraw.Draw(bordered_image)
    
    # Load fonts
    font_title = None
    font_author = None
    win_comic_font = r"C:\Windows\Fonts\comic.ttf"
    if os.path.exists(win_comic_font):
        try:
            font_title = ImageFont.truetype(win_comic_font, 36)
            font_author = ImageFont.truetype(win_comic_font, 20)
        except Exception:
            pass
            
    if font_title is None:
        font_title = ImageFont.load_default()
    if font_author is None:
        font_author = ImageFont.load_default()
        
    # 2. Draw Title Banner (Pastel Pink) at the top
    if title and title.strip():
        padding = 15
        max_w = b_width - (border_width * 2) - (padding * 2)
        wrapped_lines = wrap_text(title, font_title, draw, max_w)
        
        line_height = draw.textbbox((0, 0), "Abc", font=font_title)[3] - draw.textbbox((0, 0), "Abc", font=font_title)[1]
        box_height = (line_height * len(wrapped_lines)) + (padding * 2)
        
        box_left = border_width + 10
        box_right = b_width - border_width - 10
        box_top = border_width + 10
        box_bottom = box_top + box_height
        
        draw.rectangle([box_left, box_top, box_right, box_bottom], fill="#FF80AB", outline="black", width=4)
        
        y_cursor = box_top + padding
        for line in wrapped_lines:
            line_bbox = draw.textbbox((0, 0), line, font=font_title)
            line_w = line_bbox[2] - line_bbox[0]
            x_pos = box_left + (box_right - box_left - line_w) // 2
            draw.text((x_pos, y_cursor), line, fill="black", font=font_title)
            y_cursor += line_height
            
    # 3. Draw Author Badge (Pastel Cyan) at the bottom
    if author and author.strip():
        author_text = f"Created by {author}"
        padding = 10
        max_w = b_width - (border_width * 2) - (padding * 2)
        wrapped_lines = wrap_text(author_text, font_author, draw, max_w)
        
        line_height = draw.textbbox((0, 0), "Abc", font=font_author)[3] - draw.textbbox((0, 0), "Abc", font=font_author)[1]
        box_height = (line_height * len(wrapped_lines)) + (padding * 2)
        
        box_left = border_width + 40
        box_right = b_width - border_width - 40
        box_bottom = b_height - border_width - 20
        box_top = box_bottom - box_height
        
        draw.rectangle([box_left, box_top, box_right, box_bottom], fill="#80DEEA", outline="black", width=3)
        
        y_cursor = box_top + padding
        for line in wrapped_lines:
            line_bbox = draw.textbbox((0, 0), line, font=font_author)
            line_w = line_bbox[2] - line_bbox[0]
            x_pos = box_left + (box_right - box_left - line_w) // 2
            draw.text((x_pos, y_cursor), line, fill="black", font=font_author)
            y_cursor += line_height
            
    return bordered_image


def generate_single_panel_task(prompt: str, narration: str, idx: int, width: int, height: int, seed: int, style: str):
    """Worker task to generate and format a single panel with a style modifier."""
    # Apply style modifier
    style_mod = STYLE_MODIFIERS.get(style, "")
    full_prompt = prompt + style_mod
    
    print(f"[Server] Starting generation for Panel {idx+1}: {full_prompt[:50]}...")
    raw_img = generate_panel_from_api(full_prompt, width, height, seed)
    styled_panel = add_comic_styling(raw_img, narration, panel_number=idx+1)
    return styled_panel


@app.post("/api/generate")
async def generate_comic_endpoint(req: ComicGenerationRequest):
    try:
        # Check if this is a Cover Page
        if req.is_cover:
            if not req.panels[0].prompt.strip():
                raise HTTPException(status_code=400, detail="Please enter a cover illustration prompt.")
                
            prompt = req.panels[0].prompt
            style_mod = STYLE_MODIFIERS.get(req.style, "")
            full_prompt = prompt + style_mod
            
            # Form a nice vertical aspect ratio for cover page (2:3)
            cover_w = req.width
            cover_h = int(cover_w * 1.5)
            cover_h = max(16, 16 * (cover_h // 16))
            
            print(f"[Server] Starting Cover Page generation: {full_prompt[:50]}...")
            raw_img = generate_panel_from_api(full_prompt, cover_w, cover_h, req.seed)
            final_img = add_cover_styling(raw_img, req.title, req.author)
            layout = "cover"
            
        else:
            # Regular panels page generation
            active_panels = [(i, p) for i, p in enumerate(req.panels) if p.prompt.strip()]
            
            if not active_panels:
                raise HTTPException(status_code=400, detail="Please enter a prompt for at least one panel.")
                
            styled_panels = [None] * len(req.panels)
            
            # Concurrent execution using ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=min(4, len(active_panels))) as executor:
                futures = {}
                for idx, panel in active_panels:
                    panel_seed = req.seed + idx
                    futures[idx] = executor.submit(
                        generate_single_panel_task,
                        panel.prompt,
                        panel.text,
                        idx,
                        req.width,
                        req.height,
                        panel_seed,
                        req.style
                    )
                    
                # Gather results
                for idx, future in futures.items():
                    styled_panels[idx] = future.result()
                    
            # Remove any None values
            styled_panels = [p for p in styled_panels if p is not None]
            
            if not styled_panels:
                raise HTTPException(status_code=500, detail="Panel generation failed.")
                
            # Combine panels according to layout
            layout = req.layout.lower()
            
            if len(styled_panels) == 1:
                final_img = styled_panels[0]
            elif layout == "horizontal":
                total_width = sum(p.width for p in styled_panels)
                max_height = max(p.height for p in styled_panels)
                final_img = Image.new("RGB", (total_width, max_height), "black")
                x_offset = 0
                for p in styled_panels:
                    final_img.paste(p, (x_offset, (max_height - p.height) // 2))
                    x_offset += p.width
            elif layout == "vertical":
                max_width = max(p.width for p in styled_panels)
                total_height = sum(p.height for p in styled_panels)
                final_img = Image.new("RGB", (max_width, total_height), "black")
                y_offset = 0
                for p in styled_panels:
                    final_img.paste(p, ((max_width - p.width) // 2, y_offset))
                    y_offset += p.height
            elif layout == "grid" and len(styled_panels) >= 4:
                w1 = max(styled_panels[0].width, styled_panels[2].width)
                w2 = max(styled_panels[1].width, styled_panels[3].width)
                h1 = max(styled_panels[0].height, styled_panels[1].height)
                h2 = max(styled_panels[2].height, styled_panels[3].height)
                
                final_img = Image.new("RGB", (w1 + w2, h1 + h2), "black")
                final_img.paste(styled_panels[0], (0, 0))
                final_img.paste(styled_panels[1], (w1, 0))
                final_img.paste(styled_panels[2], (0, h1))
                final_img.paste(styled_panels[3], (w1, h1))
            else:
                total_width = sum(p.width for p in styled_panels)
                max_height = max(p.height for p in styled_panels)
                final_img = Image.new("RGB", (total_width, max_height), "black")
                x_offset = 0
                for p in styled_panels:
                    final_img.paste(p, (x_offset, (max_height - p.height) // 2))
                    x_offset += p.width
                    
        # Save output image
        filename = f"comic_{req.seed}_{layout}.png"
        filepath = os.path.join(OUTPUTS_DIR, filename)
        final_img.save(filepath)
        
        # Return static url path
        web_url = f"/static/outputs/{filename}"
        return JSONResponse({"url": web_url, "success": True})
        
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/download_pdf")
async def download_pdf_endpoint(req: PdfDownloadRequest):
    import time
    try:
        images = []
        for url in req.urls:
            # Get path relative to outputs dir
            filename = os.path.basename(url.split("?")[0])
            filepath = os.path.join(OUTPUTS_DIR, filename)
            
            if os.path.exists(filepath):
                # PDF saving requires RGB mode
                img = Image.open(filepath).convert("RGB")
                images.append(img)
                
        if not images:
            raise HTTPException(status_code=400, detail="No generated pages found to compile.")
            
        # Output PDF path
        pdf_filename = f"comic_book_{int(time.time())}.pdf"
        pdf_filepath = os.path.join(OUTPUTS_DIR, pdf_filename)
        
        # Save all images into a single PDF
        images[0].save(pdf_filepath, save_all=True, append_images=images[1:])
        
        web_url = f"/static/outputs/{pdf_filename}"
        return JSONResponse({"url": web_url, "success": True})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Serve static assets
static_path = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_path, exist_ok=True)

# Mount index file at root url
@app.get("/")
async def read_index():
    index_file = os.path.join(static_path, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return JSONResponse({"error": "index.html not found"}, status_code=404)

app.mount("/static", StaticFiles(directory=static_path), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
