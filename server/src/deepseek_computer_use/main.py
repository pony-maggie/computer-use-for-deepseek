from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from deepseek_computer_use.api.routes import router as api_router
from deepseek_computer_use.api.websocket import router as websocket_router


def create_app() -> FastAPI:
    app = FastAPI(title="Computer Use for DeepSeek", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):3000$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix="/api")
    app.include_router(websocket_router, prefix="/api")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
