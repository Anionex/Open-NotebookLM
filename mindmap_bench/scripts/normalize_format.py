"""Convert Mermaid mindmap outputs to Markdown heading tree.

Mermaid:
    mindmap
      root((Title))
        ((Child))
          - bullet
          Grandchild
            Great-grandchild

→ Markdown heading tree:
    # Title
    ## Child
    ### bullet
    ### Grandchild
    #### Great-grandchild

Usage:
    python normalize_format.py --src results/original --dst results/original_md
MR outputs are already MD heading tree; this is only needed for OG.
"""
from __future__ import annotations
import argparse
import re
from pathlib import Path

WRAP_PATTERNS = [
    (re.compile(r"^\(\((.*)\)\)$"), r"\1"),   # ((x)) → x
    (re.compile(r"^\[\[(.*)\]\]$"), r"\1"),   # [[x]] → x
    (re.compile(r"^\{\{(.*)\}\}$"), r"\1"),   # {{x}} → x
    (re.compile(r"^\((.*)\)$"),   r"\1"),     # (x) → x
    (re.compile(r"^\[(.*)\]$"),   r"\1"),     # [x] → x
    (re.compile(r"^\{(.*)\}$"),   r"\1"),     # {x} → x
]
BULLET_RE = re.compile(r"^[-*+]\s+")


def unwrap(label: str) -> str:
    s = label.strip()
    s = BULLET_RE.sub("", s)  # strip leading "- "/"* "/"+ "
    # strip a "root" prefix if it survives, e.g. "root((Title))" → label was "Title"
    for pat, repl in WRAP_PATTERNS:
        new = pat.sub(repl, s)
        if new != s:
            return unwrap(new)
    return s


def split_root_line(line: str) -> str:
    """A root line looks like `root((Title))`. Return just the inner text."""
    m = re.match(r"^root\b[\(\[\{]*(.+?)[\)\]\}]*$", line.strip())
    if m:
        return unwrap(m.group(1))
    return unwrap(line)


def mermaid_to_markdown(text: str) -> str:
    lines = text.splitlines()
    # Find the `mindmap` marker; if absent, assume already flat
    start = 0
    for i, ln in enumerate(lines):
        if ln.strip().lower().startswith("mindmap"):
            start = i + 1
            break
    body = [ln for ln in lines[start:] if ln.strip()]
    if not body:
        return text.strip() + "\n"

    # Detect indent unit — smallest non-zero leading-space count
    indents = sorted({len(ln) - len(ln.lstrip(" ")) for ln in body})
    indents = [i for i in indents if i > 0]
    unit = indents[0] if indents else 2

    out_lines: list[str] = []
    first = True
    for ln in body:
        lead = len(ln) - len(ln.lstrip(" "))
        depth = lead // unit if unit else 0
        raw = ln.strip()
        if first:
            label = split_root_line(raw)
            if not label:
                continue
            out_lines.append(f"# {label}")
            first = False
            # root is at depth D; treat as depth 0 baseline
            root_depth = depth
            continue
        label = unwrap(raw)
        if not label:
            continue
        rel = max(1, depth - root_depth)  # heading levels 2..
        level = min(6, rel + 1)  # cap at h6
        out_lines.append("#" * level + " " + label)
    return "\n".join(out_lines) + "\n"


def is_mermaid(text: str) -> bool:
    return text.lstrip().lower().startswith("mindmap")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="source directory of .md files")
    ap.add_argument("--dst", required=True, help="destination directory")
    args = ap.parse_args()

    src = Path(args.src).resolve()
    dst = Path(args.dst).resolve()
    dst.mkdir(parents=True, exist_ok=True)

    converted = passthrough = 0
    for p in sorted(src.glob("*.md")):
        text = p.read_text(encoding="utf-8")
        if is_mermaid(text):
            out = mermaid_to_markdown(text)
            converted += 1
        else:
            out = text
            passthrough += 1
        (dst / p.name).write_text(out, encoding="utf-8")
    print(f"converted={converted}  passthrough={passthrough}  → {dst}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
