"""Tests for MCP resources."""

import pytest

from app.mcp.resources import (
    get_article_schema,
    list_article_constants,
    list_article_schemas,
    list_article_statuses,
)


class TestListArticleSchemas:
    """Tests for list_article_schemas resource."""

    def test_returns_all_schemas(self):
        """Should return all available schema definitions."""
        schemas = list_article_schemas()

        assert isinstance(schemas, dict)
        assert "ArticleMeta" in schemas
        assert "Article" in schemas
        assert "ArticleCreate" in schemas
        assert "ArticlePatch" in schemas
        assert "ArticleSave" in schemas
        assert "ArticleVersion" in schemas

    def test_schemas_are_json_serializable(self):
        """Should return JSON-serializable schema objects."""
        schemas = list_article_schemas()

        for schema_name, schema in schemas.items():
            assert isinstance(schema, dict), f"{schema_name} is not a dict"
            assert "$defs" in schema or "properties" in schema


class TestGetArticleSchema:
    """Tests for get_article_schema resource."""

    def test_returns_specific_schema(self):
        """Should return schema for requested name."""
        schema = get_article_schema("ArticleMeta")

        assert isinstance(schema, dict)
        assert "properties" in schema

    def test_returns_all_schema_types(self):
        """Should return valid schema for all schema names."""
        schema_names = [
            "ArticleMeta",
            "Article",
            "ArticleCreate",
            "ArticlePatch",
            "ArticleSave",
            "ArticleVersion",
        ]

        for schema_name in schema_names:
            schema = get_article_schema(schema_name)
            assert isinstance(schema, dict)

    def test_raises_error_for_unknown_schema(self):
        """Should raise ValueError for unknown schema name."""
        with pytest.raises(ValueError) as exc_info:
            get_article_schema("UnknownSchema")

        assert "not found" in str(exc_info.value)
        assert "Available schemas" in str(exc_info.value)

    def test_error_lists_available_schemas(self):
        """Error message should list available schemas."""
        with pytest.raises(ValueError) as exc_info:
            get_article_schema("InvalidName")

        error_msg = str(exc_info.value)
        assert "ArticleMeta" in error_msg
        assert "Article" in error_msg


class TestListArticleStatuses:
    """Tests for list_article_statuses resource."""

    def test_returns_status_mapping(self):
        """Should return mapping of status codes to descriptions."""
        statuses = list_article_statuses()

        assert isinstance(statuses, dict)
        assert "draft" in statuses
        assert "published" in statuses

    def test_status_values_are_strings(self):
        """Status descriptions should be strings."""
        statuses = list_article_statuses()

        for status_code, description in statuses.items():
            assert isinstance(status_code, str)
            assert isinstance(description, str)

    def test_all_statuses_documented(self):
        """All statuses should have descriptions."""
        statuses = list_article_statuses()

        for status_code, description in statuses.items():
            assert len(description) > 0


class TestListArticleConstants:
    """Tests for list_article_constants resource."""

    def test_returns_constants_dict(self):
        """Should return dict with constant definitions."""
        constants = list_article_constants()

        assert isinstance(constants, dict)
        assert "statuses" in constants
        assert "article_fields" in constants

    def test_statuses_section_structure(self):
        """Statuses section should have valid values and description."""
        constants = list_article_constants()
        statuses = constants["statuses"]

        assert "valid_values" in statuses
        assert "description" in statuses
        assert isinstance(statuses["valid_values"], list)
        assert len(statuses["valid_values"]) > 0

    def test_article_fields_structure(self):
        """Article fields should document field definitions."""
        constants = list_article_constants()
        fields = constants["article_fields"]

        expected_fields = ["slug", "title", "content", "tags", "status"]
        for field_name in expected_fields:
            assert field_name in fields
            assert isinstance(fields[field_name], dict)

    def test_field_definitions_complete(self):
        """Each field should have type and description."""
        constants = list_article_constants()
        fields = constants["article_fields"]

        for field_name, field_def in fields.items():
            assert "type" in field_def or "enum" in field_def
            assert "description" in field_def

    def test_slug_field_has_pattern(self):
        """Slug field should include validation pattern."""
        constants = list_article_constants()
        slug_def = constants["article_fields"]["slug"]

        assert "pattern" in slug_def
        assert "a-z0-9" in slug_def["pattern"]

    def test_status_field_has_enum(self):
        """Status field should define allowed values."""
        constants = list_article_constants()
        status_def = constants["article_fields"]["status"]

        assert "enum" in status_def
        assert "draft" in status_def["enum"]
        assert "published" in status_def["enum"]
