"""Load and chunk the triage memory corpus for embedding.

Reads markdown files from data/, parses YAML front matter for metadata,
and splits each document on ## headings. Each heading section becomes one
Chunk that maps to a single Qdrant point after embedding.

Chunking strategy:
    - Split on ## headings (not # or ###)
    - Each chunk gets the parent doc's metadata (doc_type, component, etc.)
    - heading and text are stored separately: heading for display, text for
      the citation snippet, both concatenated at embed time for richer signal
"""

import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import yaml


@dataclass
class Chunk:
    """A single embeddable section from a corpus document."""

    doc_id: str  # relative path, e.g. "cases/CASE-003.md"
    doc_type: str  # "case" | "runbook" | "known_change"
    component: str  # e.g. "sidebar", "header", "global"
    date: str
    tags: list[str]
    heading: str  # the ## heading text, e.g. "Root Cause"
    text: str  # body content under the heading
    chunk_index: int  # position within the parent doc (0-based)


def parse_front_matter(content: str) -> tuple[dict, str]:
    """Extract YAML front matter and return (metadata, body)."""
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)", content, re.DOTALL)
    if not match:
        return {}, content
    metadata = yaml.safe_load(match.group(1)) or {}
    body = match.group(2)
    return metadata, body


def chunk_by_heading(body: str) -> list[tuple[str, str]]:
    """Split markdown body on ## headings into (heading, text) pairs."""
    sections = re.split(r"^(?=## )", body, flags=re.MULTILINE)
    chunks = []
    for section in sections:
        section = section.strip()
        if not section:
            continue
        lines = section.split("\n", 1)
        first_line = lines[0].strip()
        if first_line.startswith("## "):
            heading = first_line[3:].strip()
            text = lines[1].strip() if len(lines) > 1 else ""
        else:
            heading = ""
            text = section
        chunks.append((heading, text))
    return chunks


def load_corpus(data_dir: Path) -> list[Chunk]:
    """Load all markdown docs from data_dir, returning flat list of Chunks."""
    chunks = []
    for md_file in sorted(data_dir.rglob("*.md")):
        content = md_file.read_text(encoding="utf-8")
        metadata, body = parse_front_matter(content)

        required = ["doc_type", "component", "date", "tags"]
        if not all(k in metadata for k in required):
            print(f"WARN: skipping {md_file} — missing required fields")
            continue

        doc_id = str(md_file.relative_to(data_dir))
        doc_date = metadata["date"]
        if isinstance(doc_date, date):
            doc_date = str(doc_date)

        sections = chunk_by_heading(body)
        for i, (heading, text) in enumerate(sections):
            chunks.append(
                Chunk(
                    doc_id=doc_id,
                    doc_type=metadata["doc_type"],
                    component=metadata["component"],
                    date=doc_date,
                    tags=metadata["tags"],
                    heading=heading,
                    text=text,
                    chunk_index=i,
                )
            )
    return chunks
