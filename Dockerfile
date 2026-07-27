# Lightweight Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system deps for Pillow
RUN apt-get update && apt-get install -y \
    libzbar0 \
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

# Expose port (Koyeb passes PORT via env)
EXPOSE 8000

# Start FastAPI server — reads $PORT from Koyeb env
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}
