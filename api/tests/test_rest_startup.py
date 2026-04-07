"""Tests for REST server startup and initialization.

Tests that the REST API server initializes correctly with all required
configuration, routers, middleware, and error handlers.
"""

import httpx


def test_rest_app_imports_successfully():
    """Test that the main_rest module imports without errors."""
    import app.main_rest  # noqa: F401


def test_rest_app_has_routers():
    """Test that REST app has all required routers registered."""
    from app.main_rest import app

    # Check that routers are registered by checking routes
    routes = {route.path for route in app.routes}

    # Health router should have root path
    assert "/" in routes
    # Articles router should have /articles paths
    assert any("articles" in route for route in routes)
    # Auth router should have /auth paths
    assert any("auth" in route for route in routes)


def test_rest_app_has_cors_middleware():
    """Test that REST app has CORS middleware configured."""
    from app.main_rest import app

    # Check that CORSMiddleware is in the middleware stack
    middleware_names = [middleware.cls.__name__ for middleware in app.user_middleware]
    assert "CORSMiddleware" in middleware_names


def test_rest_app_has_error_handlers():
    """Test that REST app has error handlers configured."""
    from app.main_rest import app

    # Check that exception handlers are registered
    assert httpx.HTTPStatusError in app.exception_handlers
    assert ValueError in app.exception_handlers


def test_rest_app_metadata():
    """Test that REST app has proper metadata."""
    from app.main_rest import app

    assert app.title == "Inkwell API"
    assert app.version == "0.1.0"


def test_rest_app_cors_config_loads_from_config():
    """Test that CORS configuration is loaded from app.config."""
    from app.shared.config import get_cors_origins

    # Verify that CORS origins are derived from config
    origins = get_cors_origins()
    assert isinstance(origins, list)
    assert len(origins) > 0


def test_rest_app_error_handling_setup():
    """Test that error handling middleware is properly configured."""
    from app.main_rest import app

    # Verify that error handlers were registered on the app
    # by checking that exception handlers exist
    assert len(app.exception_handlers) > 0
