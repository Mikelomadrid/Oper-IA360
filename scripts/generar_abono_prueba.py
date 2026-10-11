from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


OUTPUT = Path(__file__).resolve().parents[1] / "output" / "pdf" / "Abono_prueba_A26-00573.pdf"


def build_pdf() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="Abono de prueba A26-00573",
        author="ORKALED - entorno de desarrollo",
    )

    story = [
        Paragraph("DOCUMENTO FICTICIO - SOLO PRUEBAS", styles["Title"]),
        Spacer(1, 5 * mm),
        Paragraph("FACTURA RECTIFICATIVA / ABONO", styles["Heading1"]),
        Spacer(1, 4 * mm),
    ]

    header = Table(
        [
            ["Proveedor", "Cliente"],
            ["ALMACENES CERROGORDO S.L.", "ORKALED INSTALACIONES SLU"],
            ["CIF: B88447735", "CIF: B88219837"],
        ],
        colWidths=[85 * mm, 85 * mm],
    )
    header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EAF6")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#9CA3AF")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.extend([header, Spacer(1, 7 * mm)])

    meta = Table(
        [
            ["Nº abono", "R-A26-00573-001"],
            ["Fecha", "08/10/2026"],
            ["Factura original", "A26-00573"],
            ["Motivo", "Devolución parcial de material al proveedor"],
        ],
        colWidths=[45 * mm, 125 * mm],
    )
    meta.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.extend([meta, Spacer(1, 8 * mm)])

    lines = Table(
        [
            ["Referencia", "Concepto", "Cantidad", "Precio", "Base"],
            ["MRT-M75", "Mortero seco M-7,5 saco 25 kg", "-1 saco", "3,90 EUR", "-3,90 EUR"],
        ],
        colWidths=[27 * mm, 80 * mm, 22 * mm, 22 * mm, 22 * mm],
    )
    lines.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#312E81")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#9CA3AF")),
                ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.extend([lines, Spacer(1, 7 * mm)])

    totals = Table(
        [
            ["Base imponible", "-3,90 EUR"],
            ["IVA 21%", "-0,82 EUR"],
            ["TOTAL ABONO", "-4,72 EUR"],
        ],
        colWidths=[45 * mm, 30 * mm],
        hAlign="RIGHT",
    )
    totals.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor("#ECFDF5")),
                ("TEXTCOLOR", (0, 2), (-1, 2), colors.HexColor("#065F46")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#9CA3AF")),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.extend([totals, Spacer(1, 12 * mm)])
    story.append(
        Paragraph(
            "Documento generado exclusivamente para validar el circuito del ERP de desarrollo. No tiene validez fiscal ni comercial.",
            styles["BodyText"],
        )
    )
    doc.build(story)


if __name__ == "__main__":
    build_pdf()
    print(OUTPUT)
