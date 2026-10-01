"""
Script to update WVA CRM Testing_latest_Updated.docx
Adds / replaces the "Supplemental Update - July 19th, 2026 (Follow-up)" section.
"""
import shutil
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
import copy

SRC  = "/Users/deeproot/data/21MARCH2026/my-ats-platform/docs/WVA CRM Testing_latest_Updated.docx"
DEST = "/Users/deeproot/data/21MARCH2026/my-ats-platform/docs/WVA CRM Testing_latest_Updated.docx"
BACKUP = SRC + ".bak"

# ── helpers ──────────────────────────────────────────────────────────────────

def heading(doc, text, level=2, green=False):
    p = doc.add_heading(text, level=level)
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    for run in p.runs:
        run.font.color.rgb = RGBColor(0x1F, 0x7A, 0x1F) if green else RGBColor(0x2E, 0x2E, 0x2E)
    return p


def body(doc, text, bold_prefix=None, indent=False):
    """Add a normal paragraph, optionally with a bold prefix."""
    p = doc.add_paragraph()
    if indent:
        p.paragraph_format.left_indent = Pt(18)
    if bold_prefix:
        r = p.add_run(bold_prefix)
        r.bold = True
        r.font.size = Pt(11)
    rest = p.add_run(text)
    rest.font.size = Pt(11)
    return p


def tick_line(doc, label, detail):
    """✅ Fixed – <label>: <detail>"""
    p = doc.add_paragraph()
    icon = p.add_run("✅ Fixed – ")
    icon.bold = True
    icon.font.color.rgb = RGBColor(0x1F, 0x7A, 0x1F)
    icon.font.size = Pt(11)
    lbl = p.add_run(label + ": ")
    lbl.bold = True
    lbl.font.size = Pt(11)
    rest = p.add_run(detail)
    rest.font.size = Pt(11)
    return p


def number_line(doc, num, bold_label, detail):
    """  1. <bold_label> <detail>"""
    p = doc.add_paragraph(style="normal")
    p.paragraph_format.left_indent = Pt(18)
    lbl = p.add_run(f"{num}. {bold_label} ")
    lbl.bold = True
    lbl.font.size = Pt(11)
    rest = p.add_run(detail)
    rest.font.size = Pt(11)
    return p


def resolution_line(doc, detail):
    p = doc.add_paragraph()
    r = p.add_run("Resolution: ")
    r.bold = True
    r.font.size = Pt(11)
    rest = p.add_run(detail)
    rest.font.size = Pt(11)
    return p


# ── remove old supplemental section if present ───────────────────────────────

def remove_supplemental_section(doc):
    """Delete every paragraph from the supplemental heading to the end."""
    start_idx = None
    for i, para in enumerate(doc.paragraphs):
        if "Supplemental Update" in para.text:
            start_idx = i
            break
    if start_idx is None:
        return  # not found — nothing to remove

    # collect all element refs from start_idx onwards
    to_remove = []
    for para in doc.paragraphs[start_idx:]:
        to_remove.append(para._element)

    for el in to_remove:
        el.getparent().remove(el)


# ── main ─────────────────────────────────────────────────────────────────────

shutil.copy2(SRC, BACKUP)
print(f"Backup saved to {BACKUP}")

doc = Document(SRC)

# Remove any existing supplemental section
remove_supplemental_section(doc)

# ── Horizontal rule (simulated with an empty paragraph + border) ──────────────
doc.add_paragraph()

# ── Section heading ───────────────────────────────────────────────────────────
h = doc.add_heading("🚀 Supplemental Update – July 19th, 2026 (Follow-up)", level=2)
for run in h.runs:
    run.font.color.rgb = RGBColor(0x1A, 0x56, 0xAA)
    run.font.size = Pt(14)

doc.add_paragraph()  # spacer

# ── Fix 1 ─────────────────────────────────────────────────────────────────────
tick_line(
    doc,
    "Warehouse Storeperson: Interview Date Stage Update",
    "We identified why setting the Interview Date wasn't changing the pipeline stage automatically. "
    "The backend was correctly transitioning the stage to \"Interview,\" but the candidate details page "
    "wasn't instantly reflecting this change on the dropdown. We've enhanced the system so the interface "
    "instantly updates the candidate's stage as soon as a new date is saved.",
)

doc.add_paragraph()  # spacer

# ── Fix 2 ─────────────────────────────────────────────────────────────────────
tick_line(
    doc,
    "Retail Team Member: Placement Date Added to New Vacancy",
    "When adding a new vacancy (e.g. Retail Team Member), it appeared as though a \"Placement Date\" "
    "was being automatically assigned, and there was no visible option to delete it on mobile devices.",
)

number_line(
    doc, 1,
    "The Date Assignment:",
    " This was due to seed data overlapping on existing candidate records or existing applications "
    "in the database, causing the application to show previously set dates.",
)

number_line(
    doc, 2,
    "The \"Cannot Remove\" Issue:",
    " Previously, the \"Clear\" button (the 'X') only appeared when hovering over the date with a mouse, "
    "making it impossible to delete dates on touch devices like phones or iPads.",
)

doc.add_paragraph()  # spacer before resolution

resolution_line(
    doc,
    "We have added a permanent \"Clear\" button inside the date editor. Now, when you tap/click on any "
    "date to edit it, a red \"Clear\" button will clearly be visible, allowing you to quickly remove the "
    "date from any device!",
)

doc.add_paragraph()  # trailing spacer

# ── Save ──────────────────────────────────────────────────────────────────────
doc.save(DEST)
print(f"Saved updated document to:\n  {DEST}")
