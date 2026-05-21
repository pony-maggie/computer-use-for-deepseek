from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class RunWorkspace:
    root: Path

    @property
    def uploads_dir(self) -> Path:
        return self.root / "uploads"

    @property
    def outputs_dir(self) -> Path:
        return self.root / "outputs"

    def resolve_user_path(self, relative_path: str) -> Path:
        candidate = (self.root / relative_path).resolve()
        root = self.root.resolve()
        if root != candidate and root not in candidate.parents:
            raise ValueError(f"path {relative_path} is outside workspace")
        return candidate


class WorkspaceManager:
    def __init__(self, root: Path) -> None:
        self.root = root

    def create_run_workspace(self, run_id: str) -> RunWorkspace:
        workspace = RunWorkspace(root=self.root / run_id)
        workspace.uploads_dir.mkdir(parents=True, exist_ok=True)
        workspace.outputs_dir.mkdir(parents=True, exist_ok=True)
        return workspace
