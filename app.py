import os
import sys
import requests
from io import BytesIO
import urllib.parse
from PIL import Image
import gradio as gr
from concurrent.futures import ThreadPoolExecutor

# Add current dir to path
sys.path.append(os.path.dirname(__file__))

from generate_comic import add_comic_styling, generate_panel_from_api

# Store generated panel history in memory to allow instant narration updates
generated_raw_panels = [None, None, None, None]


def generate_single_panel_api(prompt, narration, panel_idx, width, height, seed):
    """Generates a single panel and caches the raw image."""
    global generated_raw_panels
    if not prompt.strip():
        return None
        
    raw_img = generate_panel_from_api(prompt, width, height, seed)
    generated_raw_panels[panel_idx] = raw_img
    
    styled_panel = add_comic_styling(raw_img, narration, panel_number=panel_idx + 1)
    return styled_panel


def generate_comic_strip_api(p1, n1, p2, n2, p3, n3, p4, n4, layout, width, height, seed):
    try:
        prompts = [p1, p2, p3, p4]
        narrations = [n1, n2, n3, n4]
        
        # Determine active panels
        active_indices = [i for i, p in enumerate(prompts) if p.strip()]
        
        if not active_indices:
            return None, "Please enter a prompt for at least one panel."
            
        print(f"[App] Generating {len(active_indices)} panel(s) concurrently...")
        
        # Fetch panels in parallel using a ThreadPoolExecutor
        # This makes generating 4 panels just as fast as 1 panel (approx 3 seconds)!
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = []
            for idx in active_indices:
                p_seed = int(seed) + idx
                futures.append(
                    executor.submit(generate_single_panel_api, prompts[idx], narrations[idx], idx, width, height, p_seed)
                )
            
            # Wait for all panels to complete
            styled_panels = [f.result() for f in futures]
            
        # Filter out any None values
        styled_panels = [p for p in styled_panels if p is not None]
        
        if not styled_panels:
            return None, "Generation failed."
            
        if len(styled_panels) == 1:
            return styled_panels[0], "Single panel generated successfully!"
            
        # Combine panels according to layout
        if layout == "Horizontal Strip (Side-by-Side)":
            total_width = sum(p.width for p in styled_panels)
            max_height = max(p.height for p in styled_panels)
            strip = Image.new("RGB", (total_width, max_height), "black")
            x_offset = 0
            for p in styled_panels:
                strip.paste(p, (x_offset, (max_height - p.height) // 2))
                x_offset += p.width
            return strip, f"Horizontal strip of {len(styled_panels)} panels created!"
            
        elif layout == "Vertical Stack":
            max_width = max(p.width for p in styled_panels)
            total_height = sum(p.height for p in styled_panels)
            strip = Image.new("RGB", (max_width, total_height), "black")
            y_offset = 0
            for p in styled_panels:
                strip.paste(p, ((max_width - p.width) // 2, y_offset))
                y_offset += p.height
            return strip, f"Vertical stack of {len(styled_panels)} panels created!"
            
        elif layout == "2x2 Grid" and len(styled_panels) >= 4:
            # Requires 4 panels
            w1 = max(styled_panels[0].width, styled_panels[2].width)
            w2 = max(styled_panels[1].width, styled_panels[3].width)
            h1 = max(styled_panels[0].height, styled_panels[1].height)
            h2 = max(styled_panels[2].height, styled_panels[3].height)
            
            grid = Image.new("RGB", (w1 + w2, h1 + h2), "black")
            grid.paste(styled_panels[0], (0, 0))
            grid.paste(styled_panels[1], (w1, 0))
            grid.paste(styled_panels[2], (0, h1))
            grid.paste(styled_panels[3], (w1, h1))
            return grid, "2x2 Comic Grid created!"
        else:
            # Fallback to horizontal if grid layout is selected but we don't have exactly 4 panels
            total_width = sum(p.width for p in styled_panels)
            max_height = max(p.height for p in styled_panels)
            strip = Image.new("RGB", (total_width, max_height), "black")
            x_offset = 0
            for p in styled_panels:
                strip.paste(p, (x_offset, (max_height - p.height) // 2))
                x_offset += p.width
            return strip, "Horizontal strip created (Need exactly 4 panels for 2x2 grid)."
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return None, f"Error: {str(e)}"


def update_panel_narration(n1, n2, n3, n4, layout, width, height):
    """
    Updates the text narration on the cached raw panels instantly 
    without re-requesting from the image API (saves time/bandwidth).
    """
    global generated_raw_panels
    try:
        styled_panels = []
        for i, raw_img in enumerate(generated_raw_panels):
            if raw_img is not None:
                text = [n1, n2, n3, n4][i]
                styled_panels.append(add_comic_styling(raw_img, text, panel_number=i+1))
                
        if not styled_panels:
            return None, "Please generate a comic first before editing narration."
            
        if len(styled_panels) == 1:
            return styled_panels[0], "Narration text updated!"
            
        if layout == "Horizontal Strip (Side-by-Side)":
            total_width = sum(p.width for p in styled_panels)
            max_height = max(p.height for p in styled_panels)
            strip = Image.new("RGB", (total_width, max_height), "black")
            x_offset = 0
            for p in styled_panels:
                strip.paste(p, (x_offset, (max_height - p.height) // 2))
                x_offset += p.width
            return strip, "Narration updated!"
        elif layout == "Vertical Stack":
            max_width = max(p.width for p in styled_panels)
            total_height = sum(p.height for p in styled_panels)
            strip = Image.new("RGB", (max_width, total_height), "black")
            y_offset = 0
            for p in styled_panels:
                strip.paste(p, ((max_width - p.width) // 2, y_offset))
                y_offset += p.height
            return strip, "Narration updated!"
        elif layout == "2x2 Grid" and len(styled_panels) >= 4:
            w1 = max(styled_panels[0].width, styled_panels[2].width)
            w2 = max(styled_panels[1].width, styled_panels[3].width)
            h1 = max(styled_panels[0].height, styled_panels[1].height)
            h2 = max(styled_panels[2].height, styled_panels[3].height)
            grid = Image.new("RGB", (w1 + w2, h1 + h2), "black")
            grid.paste(styled_panels[0], (0, 0))
            grid.paste(styled_panels[1], (w1, 0))
            grid.paste(styled_panels[2], (0, h1))
            grid.paste(styled_panels[3], (w1, h1))
            return grid, "Narration updated!"
        else:
            total_width = sum(p.width for p in styled_panels)
            max_height = max(p.height for p in styled_panels)
            strip = Image.new("RGB", (total_width, max_height), "black")
            x_offset = 0
            for p in styled_panels:
                strip.paste(p, (x_offset, (max_height - p.height) // 2))
                x_offset += p.width
            return strip, "Narration updated!"
            
    except Exception as e:
        return None, f"Error: {str(e)}"


# Custom dark-mode cosmic theme styling for premium visual experience
custom_css = """
body {
    background-color: #0b0f19;
    color: #e2e8f0;
    font-family: 'Outfit', 'Inter', system-ui, sans-serif;
}
.gradio-container {
    background: radial-gradient(circle at top, #1e1b4b 0%, #0f172a 100%) !important;
    border: 1px solid #334155;
    border-radius: 16px;
    padding: 30px !important;
}
h1 {
    background: linear-gradient(135deg, #a78bfa 0%, #f472b6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-weight: 800 !important;
    font-size: 2.8em !important;
    text-align: center;
    margin-bottom: 5px;
}
h2 {
    color: #f472b6 !important;
    font-weight: 700 !important;
}
.sidebar-info {
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 15px;
    margin-bottom: 20px;
}
.comic-box {
    border: 4px solid #f472b6;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 15px 35px rgba(244, 114, 182, 0.25);
    background-color: #000;
}
button.primary-btn {
    background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%) !important;
    color: white !important;
    border: none !important;
    font-weight: 700 !important;
    font-size: 1.1em !important;
    padding: 12px 24px !important;
    transition: all 0.3s ease !important;
    box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3) !important;
}
button.primary-btn:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 20px rgba(139, 92, 246, 0.5) !important;
}
button.secondary-btn {
    background: #1e293b !important;
    color: #e2e8f0 !important;
    border: 1px solid #475569 !important;
    font-weight: 600 !important;
    transition: all 0.3s ease !important;
}
button.secondary-btn:hover {
    background: #334155 !important;
}
"""

with gr.Blocks(css=custom_css, title="Cosmic Comic Book Studio - Free API") as demo:
    gr.HTML("""
    <div style='text-align: center; margin-bottom: 30px;'>
        <h1>🚀 Cosmic Comic Book Studio</h1>
        <p style='color: #94a3b8; font-size: 1.2em; margin-top: 5px;'>Create children's comic strips instantly using remote GPU acceleration (0% CPU Load)</p>
    </div>
    """)
    
    with gr.Row():
        # Left Side Inputs & Configurations
        with gr.Column(scale=5):
            gr.HTML("""
            <div class='sidebar-info'>
                <h3 style='margin-top:0; font-size: 1.1em; color: #a78bfa;'>🌐 Cloud Engine Active</h3>
                <p style='font-size: 0.9em; margin: 5px 0;'><b>API:</b> Pollinations.ai (Free Serverless GPU)</p>
                <p style='font-size: 0.9em; margin: 5px 0;'><b>Computer Load:</b> 0% CPU & 0 MB Disk Cache</p>
                <p style='font-size: 0.9em; margin: 5px 0; color: #34d399;'><b>Parallel Mode:</b> Active (Generates all panels concurrently)</p>
            </div>
            """)
            
            with gr.Tabs():
                with gr.TabItem("🖼️ Panel prompts"):
                    with gr.Accordion("Panel 1 (Title Panel)", open=True):
                        p1_prompt = gr.Textbox(
                            label="Illustration Prompt",
                            value="A cute happy green dragon flying in a starry sky over a small village",
                            lines=2
                        )
                        p1_text = gr.Textbox(
                            label="Narration / Text Box",
                            value="Once upon a time, there was a little dragon who dreamed of flying to the stars...",
                            lines=1
                        )
                        
                    with gr.Accordion("Panel 2", open=True):
                        p2_prompt = gr.Textbox(
                            label="Illustration Prompt",
                            value="A cute green dragon landing in a grassy meadow covered in giant glowing flowers",
                            lines=2
                        )
                        p2_text = gr.Textbox(
                            label="Narration / Text Box",
                            value="One day, he discovered a secret magical garden where the flowers glowed in the dark.",
                            lines=1
                        )
                        
                    with gr.Accordion("Panel 3", open=False):
                        p3_prompt = gr.Textbox(
                            label="Illustration Prompt",
                            placeholder="Prompt for Panel 3 (e.g. 'A cute green dragon eating giant cookies')",
                            lines=2
                        )
                        p3_text = gr.Textbox(
                            label="Narration / Text Box",
                            placeholder="Dialogue or narration for Panel 3...",
                            lines=1
                        )
                        
                    with gr.Accordion("Panel 4", open=False):
                        p4_prompt = gr.Textbox(
                            label="Illustration Prompt",
                            placeholder="Prompt for Panel 4 (e.g. 'A cute green dragon curling up to sleep under a large glowing leaf')",
                            lines=2
                        )
                        p4_text = gr.Textbox(
                            label="Narration / Text Box",
                            placeholder="Dialogue or narration for Panel 4...",
                            lines=1
                        )
            
            with gr.Accordion("🛠️ Styling & Dimensions", open=True):
                layout_sel = gr.Dropdown(
                    choices=["Horizontal Strip (Side-by-Side)", "Vertical Stack", "2x2 Grid (Requires 4 Panels)"],
                    value="Horizontal Strip (Side-by-Side)",
                    label="Comic Layout"
                )
                width_slider = gr.Slider(minimum=256, maximum=1024, step=64, value=512, label="Width per Panel")
                height_slider = gr.Slider(minimum=256, maximum=1024, step=64, value=512, label="Height per Panel")
                seed_input = gr.Number(value=42, label="Base Seed (different seeds will be applied to each panel)")

        # Right Side Output & Live Actions
        with gr.Column(scale=7):
            gr.Markdown("## Your Comic Book Page")
            comic_output = gr.Image(label="Comic Book Layout", type="pil", elem_classes="comic-box")
            status_box = gr.Textbox(label="System Status", interactive=False)
            
            with gr.Row():
                gen_strip_btn = gr.Button("🎨 Generate Comic Page", elem_classes="primary-btn")
                update_text_btn = gr.Button("✍️ Instant Update Narration", elem_classes="secondary-btn")
                
            gr.HTML("""
            <div style='background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 12px; margin-top: 15px;'>
                <p style='margin: 0; font-size: 0.9em; color: #94a3b8;'>
                    💡 <b>Tip:</b> If you want to change the text captions without waiting for image regeneration, just edit the narration boxes and click the <b>Instant Update Narration</b> button. It re-draws the borders and text immediately!
                </p>
            </div>
            """)
            
    # Click Events
    gen_strip_btn.click(
        fn=generate_comic_strip_api,
        inputs=[p1_prompt, p1_text, p2_prompt, p2_text, p3_prompt, p3_text, p4_prompt, p4_text, layout_sel, width_slider, height_slider, seed_input],
        outputs=[comic_output, status_box]
    )
    
    update_text_btn.click(
        fn=update_panel_narration,
        inputs=[p1_text, p2_text, p3_text, p4_text, layout_sel, width_slider, height_slider],
        outputs=[comic_output, status_box]
    )

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860)
