# Lightweight Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system deps for Pillow
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy entire project
COPY . .

# Create outputs directory
RUN mkdir -p static/outputs

# HuggingFace Spaces uses port 7860
# Koyeb / local uses $PORT or 8000
EXPOSE 7860

# Start FastAPI — PORT env var: 7860 on HF Spaces, custom on Koyeb
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-7860}
