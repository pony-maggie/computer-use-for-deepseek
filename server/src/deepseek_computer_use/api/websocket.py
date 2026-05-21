from fastapi import APIRouter, WebSocket

from deepseek_computer_use.api.routes import runs

router = APIRouter()


@router.websocket("/runs/{run_id}/events")
async def run_events(websocket: WebSocket, run_id: str) -> None:
    await websocket.accept()
    await websocket.send_json({"kind": "connected", "run_id": run_id})
    run = runs.get(run_id)
    if run is not None:
        for event in run.events:
            await websocket.send_json(event)
    await websocket.close()
