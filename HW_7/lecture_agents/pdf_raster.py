from __future__ import annotations

import logging
from pathlib import Path

import fitz

log = logging.getLogger(__name__)


def rasterize_pdf(pdf_path: Path, slide_images_dir: Path, zoom: float = 2.0) -> int:
    """
    Render each PDF page to slide_images/slide_001.png ...
    Returns page count.
    """
    slide_images_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    try:
        matrix = fitz.Matrix(zoom, zoom)
        n = doc.page_count
        for i in range(n):
            page = doc.load_page(i)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            out = slide_images_dir / f"slide_{i + 1:03d}.png"
            pix.save(out.as_posix())
            log.info("Wrote %s", out.name)
        return n
    finally:
        doc.close()


def list_slide_images(slide_images_dir: Path) -> list[Path]:
    paths = sorted(slide_images_dir.glob("slide_*.png"))
    return paths
