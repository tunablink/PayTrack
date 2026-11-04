FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DATA_DIR=/var/data PORT=10000
WORKDIR /app
COPY backend/requirements.lock.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY backend/migrations ./migrations
COPY backend/scripts ./scripts
# Render mounts the persistent disk at runtime. This image uses the platform's
# default container user so a newly attached disk can be initialized directly.
CMD ["python", "-m", "app.render_start"]
