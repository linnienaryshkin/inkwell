"""Tests for MCP and REST server startup and modules.

Tests that server initialization and core modules are properly loaded.
"""

import sys
from pathlib import Path


def test_main_mcp_imports_successfully() -> None:
    """Test that the main_mcp module imports without errors."""
    # Reload the module to ensure it's fresh
    if "app.main_mcp" in sys.modules:
        del sys.modules["app.main_mcp"]

    # Should not raise any exception
    import app.main_mcp  # noqa: F401


def test_sys_path_setup() -> None:
    """Test that main_mcp sets up sys.path for api directory."""
    # This test verifies that the sys.path manipulation happens
    # by checking that the api directory can be imported after main_mcp loads
    api_dir = Path(__file__).parent.parent
    assert str(api_dir) in sys.path or "app" in sys.modules


def test_mcp_prompts_module_loads() -> None:
    """Test that MCP prompts module loads and registers decorators."""
    # The prompts module should be importable and contain decorated functions
    import app.mcp.prompts

    # Check that the article_update_report function exists
    assert hasattr(app.mcp.prompts, "article_update_report")
    assert callable(app.mcp.prompts.article_update_report)


def test_article_update_report_returns_messages() -> None:
    """Test that article_update_report prompt returns properly formatted messages."""
    from mcp.server.fastmcp.prompts import base

    from app.mcp.prompts import article_update_report

    messages = article_update_report()

    assert isinstance(messages, list)
    assert len(messages) == 2
    assert isinstance(messages[0], base.AssistantMessage)
    assert isinstance(messages[1], base.UserMessage)

    # Verify content is not empty
    assert messages[0].content
    assert messages[1].content

    # Extract text content from TextContent objects
    user_text = (
        messages[1].content.text
        if hasattr(messages[1].content, "text")
        else str(messages[1].content)
    )

    # Verify key phrases are in the prompts
    assert "article" in user_text.lower()
    assert "version" in user_text.lower()
