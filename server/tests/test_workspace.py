from pathlib import Path

import pytest

from deepseek_computer_use.workspace.manager import WorkspaceManager


def test_workspace_manager_creates_run_directory(tmp_path: Path) -> None:
    manager = WorkspaceManager(tmp_path)

    workspace = manager.create_run_workspace("run_123")

    assert workspace.root == tmp_path / "run_123"
    assert workspace.uploads_dir.exists()
    assert workspace.outputs_dir.exists()


def test_workspace_manager_blocks_path_escape(tmp_path: Path) -> None:
    manager = WorkspaceManager(tmp_path)
    workspace = manager.create_run_workspace("run_123")

    with pytest.raises(ValueError, match="outside workspace"):
        workspace.resolve_user_path("../secret.txt")
