# Visualizing Systems with Mermaid

Mermaid lets you write diagrams as code — version-controlled, diff-able, and always in sync with your docs.

## Component Architecture

```mermaid
graph TD
    StudioPage --> ArticleList
    StudioPage --> EditorPane
    StudioPage --> SidePanel
    StudioPage --> VersionStrip
    EditorPane --> Monaco["Monaco Editor"]
    SidePanel --> LintTab["Lint Results"]
    SidePanel --> PublishTab["Publish Controls"]
    SidePanel --> TocTab["Table of Contents"]
```

Diagrams live next to the prose that describes them. No more stale architecture docs.
