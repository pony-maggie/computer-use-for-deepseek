FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app/server

COPY pyproject.toml ./
COPY src ./src

RUN pip install --no-cache-dir .

RUN mkdir -p data workspace screenshots

EXPOSE 8000

CMD ["uvicorn", "deepseek_computer_use.main:app", "--host", "0.0.0.0", "--port", "8000"]
