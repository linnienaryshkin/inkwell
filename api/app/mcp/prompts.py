"""MCP prompt definitions using @mcp.prompt decorator.

These prompts are registered with the FastMCP server and provide
guided interactions for complex tasks like generating article update reports.
"""

from mcp.server.fastmcp.prompts import base

from app.mcp.server import mcp


@mcp.prompt(
    name="article-update-report",
    description="Generate a comprehensive report about latest article updates using version history data.",
)
def article_update_report() -> list[base.Message]:
    """Generate a report of the latest article updates with version history.

    This prompt guides you through creating a comprehensive report that:
    1. Lists all articles with their latest updates
    2. Shows update timeline and commit history
    3. Identifies the most recently modified articles
    4. Summarizes changes across all articles
    5. Provides statistics on update frequency

    Returns:
        list[base.Message]: A list containing the assistant and user prompts.
    """
    assistant_context = """You are an expert analyst helping to generate comprehensive reports about article updates.
Your task is to analyze article version history and create meaningful insights about content changes.

When generating reports:
- Use the 'list_articles' tool to fetch all articles with their metadata
- For each article, use 'get_article' tool to retrieve full version history
- Analyze the commit messages and timestamps to understand the update patterns
- Create a well-structured report with sections for overview, timeline, and insights
- Format the report in markdown with clear sections, tables, and key metrics

Focus on:
- Latest updates: Show the most recent changes across all articles
- Update frequency: Identify which articles are being updated most frequently
- Timeline: Present changes chronologically
- Authors/Committers: Show who made the updates based on commit history
- Change summary: Highlight what kinds of changes are being made (new content, fixes, edits)
"""

    user_request = """Generate a comprehensive update report for all articles in the Inkwell system.

Please follow these steps:

1. **Fetch All Articles**: Use the 'list_articles' tool to get all article metadata.

2. **Gather Version History**: For each article (or at least the top 10 most active), use 'get_article' tool to retrieve:
   - Article slug and title
   - Latest content
   - Complete version history with commit timestamps and messages

3. **Analyze the Data**:
   - Identify the 5 most recently updated articles (by latest commit timestamp)
   - Find the 5 most frequently updated articles (by total number of commits)
   - Track update timeline (group by date/week)
   - Extract patterns from commit messages

4. **Generate Report** with these sections:
   - **Executive Summary**: Overview of article ecosystem health and activity
   - **Recent Updates**: List of 10 most recent commits across all articles (table format)
   - **Most Active Articles**: Top articles by update frequency
   - **Activity Timeline**: Chronological view of updates
   - **Statistics**: Key metrics (total articles, total commits, average updates per article, date range of updates)
   - **Insights**: Patterns observed (peak activity times, types of changes, content focus areas)

5. **Format Nicely**: Use markdown formatting with:
   - Headers for sections
   - Tables for data-heavy information
   - Bullet lists for insights
   - Code blocks for raw data if needed

Start by fetching all articles and their version histories. Then compile the report. Be thorough and analytical.
"""

    return [
        base.AssistantMessage(assistant_context),
        base.UserMessage(user_request),
    ]
