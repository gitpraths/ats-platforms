import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

pdf_path = "/Users/deeproot/data/21MARCH2026/my-ats-platform/System_Updates_Report_10AUG2026.pdf"

doc = SimpleDocTemplate(
    pdf_path,
    pagesize=letter,
    rightMargin=36,
    leftMargin=36,
    topMargin=36,
    bottomMargin=36
)

styles = getSampleStyleSheet()

# Palette
PRIMARY = colors.HexColor("#1e293b")     # Dark Slate
ACCENT = colors.HexColor("#e88e2e")      # Brand Orange
SECONDARY = colors.HexColor("#475569")   # Muted Slate
LIGHT_BG = colors.HexColor("#f8fafc")    # Light Gray
BORDER_COLOR = colors.HexColor("#cbd5e1")# Border Slate

# Styles
title_style = ParagraphStyle(
    'DocTitle',
    parent=styles['Heading1'],
    fontName='Helvetica-Bold',
    fontSize=20,
    leading=24,
    textColor=PRIMARY,
    spaceAfter=4
)

subtitle_style = ParagraphStyle(
    'DocSubTitle',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=10,
    leading=14,
    textColor=SECONDARY,
    spaceAfter=12
)

section_heading = ParagraphStyle(
    'SectionHeading',
    parent=styles['Heading2'],
    fontName='Helvetica-Bold',
    fontSize=13,
    leading=16,
    textColor=PRIMARY,
    spaceBefore=10,
    spaceAfter=6
)

body_style = ParagraphStyle(
    'BodyTextCustom',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=9.5,
    leading=13.5,
    textColor=colors.HexColor("#334155"),
    spaceAfter=6
)

bullet_style = ParagraphStyle(
    'BulletCustom',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=9.5,
    leading=13.5,
    textColor=colors.HexColor("#334155"),
    leftIndent=12,
    spaceAfter=3
)

feature_title = ParagraphStyle(
    'FeatureTitle',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=10.5,
    leading=14,
    textColor=colors.HexColor("#0f172a"),
    spaceAfter=2
)

story = []

# Document Header
story.append(Paragraph("System Update & Feature Release Report", title_style))
story.append(Paragraph("Platform Enhancements & Operational Changes Summary — August 10, 2026", subtitle_style))
story.append(HRFlowable(width="100%", thickness=2, color=ACCENT, spaceBefore=0, spaceAfter=12))

# Executive Summary
story.append(Paragraph("Executive Summary", section_heading))
summary_text = (
    "This document summarizes the operational updates and user experience improvements completed on the platform today. "
    "These enhancements streamline daily recruitment workflows, enable flexible tracking of candidate employment lifecycles, "
    "ensure complete historical record keeping for compliance, and provide intuitive profile navigation."
)
story.append(Paragraph(summary_text, body_style))
story.append(Spacer(1, 6))

# Overview Table
story.append(Paragraph("Summary of Improvements", section_heading))

table_data = [
    [
        Paragraph("<b>Feature / Enhancement</b>", body_style),
        Paragraph("<b>What Changed</b>", body_style),
        Paragraph("<b>Key Benefit to Users</b>", body_style)
    ],
    [
        Paragraph("<b>Duplicate Candidate Redirect</b>", body_style),
        Paragraph("Automatic duplicate alert featuring a direct <b>'View Profile ↗'</b> button.", body_style),
        Paragraph("Prevents duplicate entries and opens existing candidate records in one click.", body_style)
    ],
    [
        Paragraph("<b>Placement Status & End Tracking</b>", body_style),
        Paragraph("Record placement status (Active, Resigned, Terminated, Completed), end dates, and reasons.", body_style),
        Paragraph("Enables complete employment tracking and lets you re-place available candidates immediately.", body_style)
    ],
    [
        Paragraph("<b>Application History Preservation</b>", body_style),
        Paragraph("Permanent record keeping of all job applications, even after removal from active views.", body_style),
        Paragraph("Maintains a 100% complete audit log of all candidate submissions and stages over time.", body_style)
    ],
    [
        Paragraph("<b>Same-Day Processing & Clean UI</b>", body_style),
        Paragraph("Full support for same-day interviews, ETS dates, and job start dates.", body_style),
        Paragraph("Eliminates date booking errors and cleans up clutter on candidate records.", body_style)
    ]
]

t = Table(table_data, colWidths=[125, 235, 180])
t.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), LIGHT_BG),
    ('TEXTCOLOR', (0,0), (-1,0), PRIMARY),
    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ('TOPPADDING', (0,0), (-1,-1), 6),
    ('LEFTPADDING', (0,0), (-1,-1), 6),
    ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ('GRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
]))

story.append(t)
story.append(Spacer(1, 10))

# Detailed Breakdown Section
story.append(Paragraph("Detailed Feature Overview", section_heading))

# Item 1
story.append(Paragraph("1. Smart Profile Link for Existing Candidates", feature_title))
story.append(Paragraph("• <b>Instant Duplicate Detection:</b> If a candidate being added matches an existing candidate by name or email, an alert is displayed right away.", bullet_style))
story.append(Paragraph("• <b>One-Click Navigation:</b> A prominent <b>'View Profile'</b> button appears in the warning banner, allowing team members to open the existing profile in a new tab immediately.", bullet_style))
story.append(Spacer(1, 5))

# Item 2
story.append(Paragraph("2. Employment Status & Placement End Records", feature_title))
story.append(Paragraph("• <b>Status Management:</b> Candidate placements can now be categorized as <b>Active</b>, <b>Resigned</b>, <b>Terminated</b>, or <b>Completed</b>.", bullet_style))
story.append(Paragraph("• <b>Termination Date & Reason Notes:</b> Users can select the exact End Date / Date of Termination and enter notes documenting why employment ended.", bullet_style))
story.append(Paragraph("• <b>Immediate Availability for New Placements:</b> As soon as a placement is marked as ended, the candidate's status updates to available, allowing them to be assigned to a new vacancy without restriction.", bullet_style))
story.append(Spacer(1, 5))

# Item 3
story.append(Paragraph("3. Full Application History & Audit Log", feature_title))
story.append(Paragraph("• <b>Permanent History:</b> Removing an application from active lists no longer deletes the historical record.", bullet_style))
story.append(Paragraph("• <b>Complete Visibility:</b> All past applications are preserved in the <b>Application History</b> section, displaying the job title, applied date, stage (e.g. ETS, Interview, Placed), and a <b>Removed</b> tag if applicable.", bullet_style))
story.append(Spacer(1, 5))

# Item 4
story.append(Paragraph("4. Flexible Date Validation", feature_title))
story.append(Paragraph("• <b>Same-Day Processing:</b> Interviews, ETS entries, and job placement start dates scheduled on the exact same day as the application date are fully accepted.", bullet_style))

story.append(Spacer(1, 12))
story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=5, spaceAfter=8))

# Document Footer Note
footer_text = "<b>Status:</b> All updates fully deployed & operational | <b>Date:</b> August 10, 2026"
story.append(Paragraph(footer_text, ParagraphStyle('FooterStyle', parent=styles['Normal'], fontName='Helvetica', fontSize=8.5, leading=11, textColor=SECONDARY, alignment=1)))

doc.build(story)
print("PDF created successfully at:", pdf_path)
