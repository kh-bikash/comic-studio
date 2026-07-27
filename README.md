---
title: Cosmic Comic Studio
emoji: 🚀
colorFrom: pink
colorTo: purple
sdk: docker
app_port: 7860
pinned: true
---

# 🚀 Cosmic Comic Studio

A beautiful AI-powered children's storybook comic creator. Generate illustrated comic book pages instantly using free serverless GPU acceleration — no model downloads, 0% CPU load.

## ✨ Features

- 🎨 Generate up to 4 illustrated comic panels per page
- 📖 Multi-page storybook with page navigation
- 🖼️ Multiple art styles: Watercolor, Pop Art, Claymation, Crayon
- 📄 PDF export of your entire comic book
- 💾 Auto-saves all your work in the browser (localStorage)
- 🔍 Full-size image preview modal
- 🖨️ Print-ready layout

## 🛠️ Tech Stack

- **Backend**: Python + FastAPI + Pillow
- **Frontend**: Vanilla HTML / CSS / JS (No frameworks)
- **AI API**: [Pollinations.ai](https://pollinations.ai) — Free serverless GPU image generation

## 🚀 Running Locally

```bash
pip install -r requirements.txt
python server.py
```

Open [http://localhost:8000](http://localhost:8000)

## ☁️ Deploying to Railway / Render

1. Push this repo to GitHub
2. Connect repo on [Railway.app](https://railway.app) or [Render.com](https://render.com)
3. Set **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. Deploy! 🎉

## 📸 How It Works

1. Enter illustration prompts for each panel
2. Choose art style, layout, and page dimensions
3. Click **Generate Comic Page**
4. Download as PNG, print, or export as PDF

---

Made with ❤️ by kh-bikash
