"""
Tharavu (Data) — FastAPI Backend
OCR powered by Google Gemini Vision API.
Extended with PDF processing and AI Comic generation.
"""

from __future__ import annotations

import io
import json
import logging
import os
import re
import tempfile
import uuid
from pathlib import Path
from typing import Optional, Literal

# ── Load .env files before any other imports ───────────────────────────────────
# backend/.env wins; the project-root .env is used as a fallback so the key can
# live in either place. Real environment variables always take precedence.
_ROOT_DIR = Path(__file__).resolve().parent.parent
for _env_file in (Path(__file__).parent / ".env", _ROOT_DIR / ".env"):
    if not _env_file.exists():
        continue
    with open(_env_file) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _, _v = _line.partition("=")
                _k = _k.strip()
                _v = _v.strip().strip('"').strip("'")
                if _k and _k not in os.environ:
                    os.environ[_k] = _v

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── OCR engine ────────────────────────────────────────────────────────────────
try:
    from ocr_engine import get_engine_info, process_image_bytes
    ENGINE_LOADED = True
except ImportError as exc:
    logger.error(f"OCR engine import failed: {exc}")
    ENGINE_LOADED = False

    def process_image_bytes(image_bytes, lang="tam+eng", content_type=None):  # type: ignore
        return {
            "success": False,
            "error": "OCR engine could not be loaded (import error).",
            "api_key_configured": False,
        }

    def get_engine_info():  # type: ignore
        return {
            "engine": "gemini",
            "genai_available": False,
            "api_key_configured": False,
            "model": "",
            "ready": False,
        }

# ── PDF processing imports ───────────────────────────────────────────────────
try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False
    logger.warning("PyMuPDF not installed — PDF support disabled.")

# ── In-memory job storage (use Redis or DB in production) ────────────────────
pdf_jobs: dict[str, dict] = {}


# ── Response schemas ──────────────────────────────────────────────────────────
class WordConfidence(BaseModel):
    word: str
    confidence: int


class OCRResult(BaseModel):
    success: bool
    raw_text: str
    cleaned_text: str
    words_with_confidence: list[WordConfidence]
    regions_found: int
    engine: str
    engine_model: str
    api_key_configured: bool
    language: str
    error: Optional[str]


class SystemStatus(BaseModel):
    ocr_engine: str
    ocr_engine_loaded: bool
    api_key_configured: bool
    gemini_model: str
    ready: bool
    diagnostic_message: Optional[str]


# ── PDF schemas ───────────────────────────────────────────────────────────────
class PDFPageResult(BaseModel):
    page_number: int
    page_id: str
    text: str
    status: Literal["success", "failed", "empty", "processing"]
    error: Optional[str] = None
    ocr_engine: Optional[str] = None
    ocr_model: Optional[str] = None


class PDFProcessResponse(BaseModel):
    job_id: str
    filename: str
    total_pages: int
    processed_pages: int
    status: Literal["pending", "processing", "completed", "failed"]
    pages: list[PDFPageResult]
    error: Optional[str] = None


class PDFJobStatus(BaseModel):
    job_id: str
    filename: str
    total_pages: int
    processed_pages: int
    status: Literal["pending", "processing", "completed", "failed"]
    pages: list[PDFPageResult]
    error: Optional[str] = None


# ── Comic schemas ─────────────────────────────────────────────────────────────
class ComicGenerateRequest(BaseModel):
    source_type: Literal["image", "pdf"]
    text: str
    language: str = "tam+eng"
    scope: Literal["current_page", "selected_pages", "entire_document"] = "current_page"
    document_id: Optional[str] = None
    page_ids: Optional[list[str]] = None
    page_numbers: Optional[list[int]] = None


class ComicGenerateResponse(BaseModel):
    success: bool
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    storyboard: Optional[dict] = None
    source_pages: Optional[list[int]] = None
    error: Optional[str] = None


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Tharavu (Data) OCR API — Gemini Edition",
    description="Tamil OCR pipeline powered by Google Gemini Vision with PDF and Comic support",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helper: Save uploaded file to temp location ───────────────────────────────
def save_temp_file(upload_file: UploadFile, prefix: str = "") -> str:
    """Save uploaded file to a temporary location and return the path."""
    suffix = Path(upload_file.filename or "").suffix or ".tmp"
    temp_file = tempfile.NamedTemporaryFile(delete=False, prefix=prefix, suffix=suffix)
    temp_file.close()
    return temp_file.name


def cleanup_temp_file(path: str) -> None:
    """Safely remove a temporary file."""
    try:
        if path and os.path.exists(path):
            os.unlink(path)
    except Exception as e:
        logger.warning(f"Failed to cleanup temp file {path}: {e}")


# ── PDF Processing ────────────────────────────────────────────────────────────
async def process_pdf_job(job_id: str, file_path: str, filename: str, lang: str) -> None:
    """Background task to process a PDF file page by page."""
    job = pdf_jobs.get(job_id)
    if not job:
        return

    job["status"] = "processing"

    try:
        if not PYMUPDF_AVAILABLE:
            raise RuntimeError("PyMuPDF not available. Install pymupdf package.")

        doc = fitz.open(file_path)
        total_pages = len(doc)
        job["total_pages"] = total_pages

        pages_results: list[dict] = []

        for page_num in range(total_pages):
            page_id = f"{job_id}_page_{page_num + 1}"
            page = doc[page_num]

            # Update job progress
            job["processed_pages"] = page_num
            job["pages"] = pages_results + [
                PDFPageResult(
                    page_number=i + 1,
                    page_id=f"{job_id}_page_{i + 1}",
                    text="",
                    status="processing",
                )
                for i in range(page_num, total_pages)
            ]

            try:
                # Try to extract text directly from PDF
                text = page.get_text("text")

                if text.strip():
                    # Text-based PDF - use extracted text
                    pages_results.append(
                        PDFPageResult(
                            page_number=page_num + 1,
                            page_id=page_id,
                            text=text.strip(),
                            status="success",
                            ocr_engine="pdf_text",
                            ocr_model="pymupdf",
                        )
                    )
                else:
                    # Scanned/image-based page - render to image and OCR
                    # Render page at 2x resolution for better OCR
                    mat = fitz.Matrix(2, 2)
                    pix = page.get_pixmap(matrix=mat, alpha=False)
                    img_bytes = pix.tobytes("png")

                    if not img_bytes:
                        raise ValueError("Failed to render page to image")

                    # Process through existing OCR pipeline
                    ocr_result = process_image_bytes(img_bytes, lang=lang, content_type="image/png")

                    if ocr_result.get("success"):
                        pages_results.append(
                            PDFPageResult(
                                page_number=page_num + 1,
                                page_id=page_id,
                                text=ocr_result.get("cleaned_text", ""),
                                status="success" if ocr_result.get("cleaned_text") else "empty",
                                ocr_engine=ocr_result.get("engine", "gemini"),
                                ocr_model=ocr_result.get("engine_model", ""),
                            )
                        )
                    else:
                        pages_results.append(
                            PDFPageResult(
                                page_number=page_num + 1,
                                page_id=page_id,
                                text="",
                                status="failed",
                                error=ocr_result.get("error", "OCR failed"),
                            )
                        )

            except Exception as e:
                logger.exception(f"Error processing page {page_num + 1} of {filename}")
                pages_results.append(
                    PDFPageResult(
                        page_number=page_num + 1,
                        page_id=page_id,
                        text="",
                        status="failed",
                        error=str(e),
                    )
                )

        doc.close()

        # Finalize job
        job["pages"] = pages_results
        job["processed_pages"] = total_pages
        job["status"] = "completed"

    except Exception as e:
        logger.exception(f"PDF processing failed for job {job_id}")
        job["status"] = "failed"
        job["error"] = str(e)


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/", response_class=PlainTextResponse)
def root():
    return "Tharavu (Data) OCR API v2.1 (Gemini) — visit /docs"


@app.get("/status", response_model=SystemStatus)
def system_status():
    """Returns Gemini API readiness information."""
    info = get_engine_info()
    ready = info["ready"] and ENGINE_LOADED

    diag: Optional[str] = None
    if not ENGINE_LOADED:
        diag = (
            "OCR engine failed to load. "
            "Run:  .venv\\Scripts\\pip install -r backend/requirements.txt"
        )
    elif not info["genai_available"]:
        diag = (
            "google-genai package is not installed. "
            "Run:  .venv\\Scripts\\pip install google-genai"
        )
    elif not info["api_key_configured"]:
        diag = (
            "GEMINI_API_KEY is not set. "
            "Create backend/.env with:  GEMINI_API_KEY=your_key_here  "
            "then restart the backend. Get a free key at https://aistudio.google.com"
        )

    return SystemStatus(
        ocr_engine=info["engine"],
        ocr_engine_loaded=ENGINE_LOADED and info["genai_available"],
        api_key_configured=info["api_key_configured"],
        gemini_model=info["model"],
        ready=ready,
        diagnostic_message=diag,
    )


@app.post("/ocr", response_model=OCRResult)
async def ocr_image(
    file: UploadFile = File(..., description="Image file (JPEG/PNG/TIFF/BMP)"),
    lang: str = Form("tam+eng", description="Language code: tam+eng | tam | eng"),
):
    """
    Extract text from the uploaded image using Gemini Vision.
    Supports JPEG, PNG, TIFF, BMP (TIFF/BMP are auto-converted to PNG).
    """
    # ── Validate file type ────────────────────────────────────────────────────
    allowed_types = {
        "image/jpeg", "image/jpg", "image/png", "image/tiff",
        "image/bmp", "image/x-tiff", "image/tif", "image/x-bmp",
        "application/octet-stream",
    }
    allowed_exts = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp"}

    content_type = file.content_type or ""
    ext = Path(file.filename or "").suffix.lower()

    if content_type not in allowed_types and ext not in allowed_exts:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file type '{content_type}' / extension '{ext}'. "
                "Use JPEG, PNG, TIFF, or BMP."
            ),
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(image_bytes) > 20 * 1024 * 1024:   # 20 MB cap for Gemini inline upload
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum size is 20 MB.",
        )

    if not re.match(r"^[a-z+]+$", lang):
        raise HTTPException(
            status_code=400,
            detail="Invalid language code. Use one of: tam+eng, tam, eng.",
        )

    logger.info(
        f"OCR request: file={file.filename!r}  size={len(image_bytes)}B  "
        f"type={content_type}  lang={lang}"
    )

    result = process_image_bytes(image_bytes, lang=lang, content_type=content_type)

    # Return 503 when the engine itself is misconfigured so the frontend shows
    # the diagnostic message rather than an empty result.
    if not result.get("success") and not result.get("api_key_configured"):
        raise HTTPException(
            status_code=503,
            detail=result.get("error", "Gemini OCR engine is not configured."),
        )

    info = get_engine_info()
    return OCRResult(
        success=result["success"],
        raw_text=result.get("raw_text", ""),
        cleaned_text=result.get("cleaned_text", ""),
        words_with_confidence=[WordConfidence(**w) for w in result.get("words_with_confidence", [])],
        regions_found=result.get("regions_found", 0),
        engine=result.get("engine", "gemini"),
        engine_model=result.get("engine_model", info["model"]),
        api_key_configured=result.get("api_key_configured", False),
        language=result.get("language", lang),
        error=result.get("error"),
    )


# ── PDF Endpoints ─────────────────────────────────────────────────────────────
@app.post("/pdf/process", response_model=PDFProcessResponse)
async def process_pdf(
    file: UploadFile = File(..., description="PDF file to process"),
    lang: str = Form("tam+eng", description="Language code for OCR: tam+eng | tam | eng"),
):
    """
    Upload and process a PDF document page by page.
    Extracts embedded text where available, falls back to OCR for scanned pages.
    Returns a job ID for polling results.
    """
    # Validate file type
    content_type = file.content_type or ""
    ext = Path(file.filename or "").suffix.lower()

    if content_type != "application/pdf" and ext != ".pdf":
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type. Expected PDF, got '{content_type}' / '{ext}'.",
        )

    # Read file and validate
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(file_bytes) > 50 * 1024 * 1024:  # 50 MB limit for PDFs
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum size is 50 MB.",
        )

    # Validate it's actually a PDF
    if not PYMUPDF_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="PDF processing not available. Install pymupdf package.",
        )

    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page_count = len(doc)
        doc.close()

        if page_count == 0:
            raise HTTPException(status_code=400, detail="PDF has no pages.")
        if page_count > 100:
            raise HTTPException(
                status_code=413,
                detail="PDF has too many pages. Maximum is 100 pages.",
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid PDF file: {e}")

    # Validate language
    if not re.match(r"^[a-z+]+$", lang):
        raise HTTPException(
            status_code=400,
            detail="Invalid language code. Use one of: tam+eng, tam, eng.",
        )

    # Create job
    job_id = str(uuid.uuid4())[:12]
    temp_path = save_temp_file(file, prefix=f"pdf_{job_id}_")

    # Write file bytes to temp location
    with open(temp_path, "wb") as f:
        f.write(file_bytes)

    # Initialize job
    pdf_jobs[job_id] = {
        "job_id": job_id,
        "filename": file.filename,
        "total_pages": page_count,
        "processed_pages": 0,
        "status": "pending",
        "pages": [],
        "temp_path": temp_path,
        "lang": lang,
        "error": None,
    }

    # Start background processing
    import asyncio
    asyncio.create_task(process_pdf_job(job_id, temp_path, file.filename, lang))

    logger.info(f"PDF processing started: job={job_id} file={file.filename} pages={page_count}")

    return PDFProcessResponse(
        job_id=job_id,
        filename=file.filename or "unknown.pdf",
        total_pages=page_count,
        processed_pages=0,
        status="pending",
        pages=[],
    )


@app.get("/pdf/jobs/{job_id}", response_model=PDFJobStatus)
async def get_pdf_job(job_id: str):
    """Get the status and results of a PDF processing job."""
    job = pdf_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    return PDFJobStatus(
        job_id=job["job_id"],
        filename=job["filename"],
        total_pages=job["total_pages"],
        processed_pages=job["processed_pages"],
        status=job["status"],
        pages=job["pages"],
        error=job.get("error"),
    )


@app.post("/pdf/pages/{page_id}/retry", response_model=PDFPageResult)
async def retry_pdf_page(page_id: str, lang: str = Form("tam+eng")):
    """
    Retry OCR on a specific PDF page.
    The page_id format is: {job_id}_page_{page_number}
    """
    # Parse page_id
    try:
        job_id, _, page_num_str = page_id.rpartition("_page_")
        page_number = int(page_num_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page_id format.")

    job = pdf_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    if page_number < 1 or page_number > job["total_pages"]:
        raise HTTPException(status_code=404, detail="Page number out of range.")

    temp_path = job.get("temp_path")
    if not temp_path or not os.path.exists(temp_path):
        raise HTTPException(status_code=500, detail="Original PDF file not available for retry.")

    try:
        doc = fitz.open(temp_path)
        page = doc[page_number - 1]

        # Render page to image
        mat = fitz.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img_bytes = pix.tobytes("png")
        doc.close()

        if not img_bytes:
            raise ValueError("Failed to render page to image")

        # Process through existing OCR pipeline
        ocr_result = process_image_bytes(img_bytes, lang=lang, content_type="image/png")

        if ocr_result.get("success"):
            result = PDFPageResult(
                page_number=page_number,
                page_id=page_id,
                text=ocr_result.get("cleaned_text", ""),
                status="success" if ocr_result.get("cleaned_text") else "empty",
                ocr_engine=ocr_result.get("engine", "gemini"),
                ocr_model=ocr_result.get("engine_model", ""),
            )
        else:
            result = PDFPageResult(
                page_number=page_number,
                page_id=page_id,
                text="",
                status="failed",
                error=ocr_result.get("error", "OCR failed"),
            )

        # Update job with new result
        for i, p in enumerate(job["pages"]):
            if p.page_id == page_id:
                job["pages"][i] = result
                break

        return result

    except Exception as e:
        logger.exception(f"Retry failed for page {page_id}")
        raise HTTPException(status_code=500, detail=f"Retry failed: {e}")


# ── Comic Generation Endpoints ────────────────────────────────────────────────
async def generate_comic_storyboard(text: str, language: str, scope: str, page_numbers: Optional[list[int]] = None) -> dict:
    """Generate a storyboard from source text using Gemini."""
    from ocr_engine import _get_client, _model_candidates, genai_types, GENAI_AVAILABLE

    if not GENAI_AVAILABLE:
        raise RuntimeError("google-genai SDK not available")

    client = _get_client()
    if not client:
        raise RuntimeError("Gemini client not initialized - API key missing")

    # Build storyboard prompt
    lang_name = {"tam": "Tamil", "eng": "English", "tam+eng": "Tamil and English", "tam+eng+hin": "Tamil, English, and Hindi"}.get(language, "the selected language")

    scope_desc = {
        "current_page": "the current page",
        "selected_pages": f"pages {', '.join(map(str, page_numbers))}" if page_numbers else "the selected pages",
        "entire_document": "the entire document",
    }.get(scope, "the provided content")

    storyboard_prompt = f"""You are a comic storyboard creator for historical Tamil documents.
Convert the following text from {scope_desc} into a structured 4-panel comic storyboard.

Source text:
{text[:8000]}

Requirements:
1. Create exactly 4 panels in sequence
2. Each panel must have: scene_description, characters, setting, dialogue, visual_notes
3. Dialogue must be in {lang_name}
4. For historical/inscription content: label as "AI-generated interpretation" not factual reconstruction
5. Preserve historical meaning - do not invent facts
6. Note any uncertain OCR portions as "uncertain" in visual_notes
7. Return ONLY valid JSON with this structure:
{{
  "panels": [
    {{
      "panel_number": 1,
      "scene_description": "...",
      "characters": [...],
      "setting": "...",
      "dialogue": "...",
      "visual_notes": "..."
    }},
    ...
  ],
  "source_pages": {json.dumps(page_numbers) if page_numbers else "null"},
  "language": "{language}",
  "disclaimer": "AI-generated comic interpretation based on OCR text. Not a verified historical reconstruction."
}}"""

    candidates = _model_candidates()
    for model in candidates:
        try:
            response = client.models.generate_content(
                model=model,
                contents=[genai_types.Part.from_text(text=storyboard_prompt)],
            )
            raw_text = response.text or ""
            # Parse JSON from response
            import re
            json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except Exception as e:
            logger.warning(f"Storyboard generation failed with {model}: {e}")
            continue

    raise RuntimeError("All models failed for storyboard generation")


async def generate_comic_image(storyboard: dict, language: str) -> str:
    """Generate comic image from storyboard using Gemini image generation."""
    from ocr_engine import _get_client, _model_candidates, genai_types, GENAI_AVAILABLE

    if not GENAI_AVAILABLE:
        raise RuntimeError("google-genai SDK not available")

    client = _get_client()
    if not client:
        raise RuntimeError("Gemini client not initialized - API key missing")

    # Build image generation prompt from storyboard
    panels = storyboard.get("panels", [])
    panel_descriptions = []
    for p in panels:
        panel_descriptions.append(
            f"Panel {p.get('panel_number', 1)}: {p.get('scene_description', '')}. "
            f"Characters: {', '.join(p.get('characters', []))}. "
            f"Setting: {p.get('setting', '')}. "
            f"Dialogue: {p.get('dialogue', '')}. "
            f"Style: {p.get('visual_notes', 'clean line art, manga style')}"
        )

    image_prompt = f"""Create a single portrait-oriented comic page with 4 panels arranged vertically (2x2 grid).
Each panel must be clearly separated with gutters.
Style: Clean black and white manga/line art style, high contrast, suitable for printing.
Consistent character appearance across all panels.

Panels:
{chr(10).join(panel_descriptions)}

Text/dialogue should be rendered in the comic as speech bubbles in the appropriate language.
Overall composition: Professional comic page layout, readable panel flow top-to-bottom.
No watermarks, no signatures, no extra text outside panels."""

    # Try image generation models
    image_models = ["gemini-2.0-flash-exp-image-generation", "gemini-1.5-flash", "gemini-1.5-pro"]
    for model in image_models:
        try:
            response = client.models.generate_content(
                model=model,
                contents=[genai_types.Part.from_text(text=image_prompt)],
            )
            # Check for image in response
            if hasattr(response, 'candidates') and response.candidates:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data:
                        import base64
                        image_base64 = base64.b64encode(part.inline_data.data).decode('utf-8')
                        return f"data:image/png;base64,{image_base64}"
        except Exception as e:
            logger.warning(f"Image generation failed with {model}: {e}")
            continue

    # Fallback: return placeholder
    raise RuntimeError("Image generation not available with current model configuration")


@app.post("/comic/generate", response_model=ComicGenerateResponse)
async def generate_comic(request: ComicGenerateRequest):
    """
    Generate a comic page from extracted text.
    Supports three scopes: current_page, selected_pages, entire_document.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="No text provided for comic generation.")

    try:
        # Generate storyboard
        storyboard = await generate_comic_storyboard(
            text=request.text,
            language=request.language,
            scope=request.scope,
            page_numbers=request.page_numbers,
        )

        # Generate comic image
        try:
            image_base64 = await generate_comic_image(storyboard, request.language)
        except Exception as img_err:
            logger.warning(f"Image generation failed: {img_err}")
            # Return storyboard without image as partial success
            return ComicGenerateResponse(
                success=True,
                image_base64=None,
                storyboard=storyboard,
                source_pages=request.page_numbers,
                error=f"Storyboard generated but image generation failed: {img_err}",
            )

        return ComicGenerateResponse(
            success=True,
            image_base64=image_base64,
            storyboard=storyboard,
            source_pages=request.page_numbers,
            error=None,
        )

    except Exception as e:
        logger.exception("Comic generation failed")
        raise HTTPException(status_code=500, detail=f"Comic generation failed: {e}")


@app.get("/languages")
def available_languages():
    """Gemini supports all languages — returns the three configured options."""
    return {
        "engine": "gemini",
        "languages": [
            {"code": "tam+eng", "label": "Tamil + English"},
            {"code": "tam", "label": "Tamil only"},
            {"code": "eng", "label": "English only"},
        ],
    }


# ── Cleanup on shutdown ───────────────────────────────────────────────────────
@app.on_event("shutdown")
async def cleanup_temp_files():
    """Clean up temporary files on shutdown."""
    for job in pdf_jobs.values():
        temp_path = job.get("temp_path")
        if temp_path:
            cleanup_temp_file(temp_path)


# ── Dev entry point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)