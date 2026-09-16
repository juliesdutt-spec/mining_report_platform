"""
Generate a corpus of mock mining reports for exercising the prototype.

Every file here is fictional, but each one is shaped to exercise a specific
path through DataForge rather than just to look like a mining report:

  EN-01  baseline English report, complete
  EN-02  a second mine, opencast, large producer
  EN-03  EN-02's mine and period again with a DIFFERENT figure -> conflict
  EN-04  a different reporting period -> must NOT conflict with EN-02/03
  EN-05  iron ore rather than coal -> a second mineral in the corpus
  EN-06  production figure deliberately absent -> missing-data finding
  EN-07  EN-01 again under another filename -> duplicate finding
  HI-01  Hindi (Devanagari) report, complete
  HI-02  HI-01's mine and period with a different figure -> conflict in Hindi
  TE-01  Telugu report, complete
  TE-02  a second Telugu report, different mine
  SCAN-01  EN-08 with no text layer at all -> forces the OCR path (English)
  SCAN-02  HI-03 with no text layer -> forces OCR in Devanagari

Run:  python samples/generate_test_corpus.py
"""
import io
import os
import sys

from fpdf import FPDF

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, "corpus")
FONT_DIR = os.path.join(ROOT, "assets", "fonts")

# Scanned pages are rendered at this DPI. High enough that tesseract reads
# Devanagari conjuncts reliably; low enough that the files stay small.
SCAN_DPI = 200


# --------------------------------------------------------------------------- 
# rendering


class Report(FPDF):
    """One mining report. `script` picks the font that can draw its text."""

    def __init__(self, spec):
        super().__init__()
        self.spec = spec
        self.script = spec.get("script", "latin")
        self.set_auto_page_break(auto=True, margin=18)
        if self.script != "latin":
            family, files = {
                "devanagari": ("NotoDevanagari", ("NotoSansDevanagari-Regular.ttf",
                                                 "NotoSansDevanagari-Bold.ttf")),
                "telugu": ("NotoTelugu", ("NotoSansTelugu-Regular.ttf",
                                          "NotoSansTelugu-Bold.ttf")),
            }[self.script]
            for style, filename in zip(("", "B"), files):
                self.add_font(family, style, os.path.join(FONT_DIR, filename))
            self.family = family
            # Without shaping, fpdf2 lays vowel signs out in logical order and
            # the text is silently wrong to anyone who reads the script.
            self.set_text_shaping(True)
        else:
            self.family = "Helvetica"

    def header(self):
        self.set_font(self.family, "B", 13)
        self.multi_cell(0, 7, self.spec["title"], align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font(self.family, "", 9)
        self.cell(0, 5, self.spec["org"], align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 5, self.spec["ref"], align="C", new_x="LMARGIN", new_y="NEXT")
        self.line(10, self.get_y() + 1, 200, self.get_y() + 1)
        self.ln(5)

    def footer(self):
        self.set_y(-14)
        self.set_font(self.family, "", 7)
        self.cell(0, 8, f"{self.spec['footer']}  |  {self.page_no()}", align="C")

    def heading(self, text):
        self.ln(2)
        self.set_font(self.family, "B", 11)
        self.multi_cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")
        self.set_font(self.family, "", 9.5)

    def field_rows(self, rows):
        self.set_font(self.family, "", 9.5)
        for label, value in rows:
            self.set_font(self.family, "B", 9.5)
            self.cell(58, 6.5, f"{label}:", new_x="RIGHT")
            self.set_font(self.family, "", 9.5)
            self.multi_cell(0, 6.5, value, new_x="LMARGIN", new_y="NEXT")

    def bullets(self, items):
        self.set_font(self.family, "", 9.5)
        for item in items:
            self.cell(4, 6.5, "-", new_x="RIGHT")
            self.multi_cell(0, 6.5, f" {item}", new_x="LMARGIN", new_y="NEXT")

    def paragraph(self, text):
        self.set_font(self.family, "", 9.5)
        self.multi_cell(0, 6, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)


def build(spec) -> bytes:
    pdf = Report(spec)
    pdf.add_page()
    for block in spec["blocks"]:
        if block[0] == "page":
            pdf.add_page()
        elif block[0] == "heading":
            pdf.heading(block[1])
        elif block[0] == "fields":
            pdf.field_rows(block[1])
        elif block[0] == "bullets":
            pdf.bullets(block[1])
        elif block[0] == "text":
            pdf.paragraph(block[1])
    return bytes(pdf.output())


def flatten(pdf_bytes: bytes) -> bytes:
    """Re-render a PDF as page images, leaving no text layer.

    This is what makes a file a genuine test of the OCR path: PyMuPDF finds no
    text in it, so the processor has to fall back to tesseract, exactly as it
    would for the scanned 1990s reports this corpus stands in for.
    """
    import pymupdf

    src = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    out = pymupdf.open()
    for page in src:
        pix = page.get_pixmap(dpi=SCAN_DPI, colorspace=pymupdf.csGRAY)
        target = out.new_page(width=page.rect.width, height=page.rect.height)
        target.insert_image(target.rect, stream=pix.tobytes("png"))
    return out.tobytes(deflate=True)


# ---------------------------------------------------------------------------
# content


def english(*, title, org, ref, footer, mine, location, district, state,
            company, method, mineral, period, date, production, reserves,
            geology, extras=None, safety_note="Zero fatalities recorded during the reporting period."):
    rows = [
        ("Mine Name", mine),
        ("Location", location),
        ("District", district),
        ("State", state),
        ("Company", company),
        ("Mineral", mineral),
        ("Mining Method", method),
        ("Report Period", period),
        ("Date of Report", date),
    ]
    blocks = [
        ("heading", "1. MINE DETAILS"),
        ("fields", rows),
        ("heading", "2. PRODUCTION SUMMARY"),
        ("bullets", production),
        ("heading", "3. GEOLOGICAL FINDINGS"),
        ("text", geology),
        ("heading", "4. RESERVE POSITION"),
        ("bullets", reserves),
        ("page", None),
        ("heading", "5. ENVIRONMENTAL COMPLIANCE"),
        ("bullets", [
            "Ambient air quality monitored continuously at four stations; PM10 within NAAQS limits.",
            "Mine water treated and recycled for dust suppression and washery make-up.",
            "Plantation of 42 hectares completed during the year under the progressive mine closure plan.",
            "Quarterly returns filed with the State Pollution Control Board without adverse observation.",
        ]),
        ("heading", "6. SAFETY"),
        ("bullets", [
            safety_note,
            "All statutory inspections completed as per DGMS circulars.",
            "Reportable injury rate of 0.11 per lakh tonnes, against a corporate target of 0.20.",
        ]),
        ("heading", "7. RECOMMENDATIONS"),
        ("bullets", extras or [
            "Continue exploratory drilling in the eastern block to firm up inferred reserves.",
            "Commission the second conveyor to reduce road haulage and diesel consumption.",
            "Review the overburden dump slope design ahead of the monsoon.",
        ]),
    ]
    return {"title": title, "org": org, "ref": ref, "footer": footer,
            "script": "latin", "blocks": blocks}


JHARIA_GEO = (
    "The Jharia coalfield remains the principal source of prime coking coal in the country. "
    "Exploration during the year covered 18.4 square kilometres of the lease, of which 6.2 square "
    "kilometres was surveyed for the first time. Seams II, III and IV were intersected in all "
    "twenty-two boreholes drilled during the period, with seam III continuing to be the most "
    "productive horizon.\n\n"
    "Seam thickness ranges from 3.5 metres to 8.2 metres across the block. The dip varies between "
    "1 in 12 and 1 in 15 towards the north-east. Roof conditions in the western panels are rated "
    "moderate to difficult and continue to require systematic support rules. The water table lies "
    "below the current working horizon and no significant inflow was encountered."
)

GEVRA_GEO = (
    "Gevra is worked as a large mechanised opencast mine using shovel-dumper combination supported "
    "by surface miners. Exploration during the year was directed at the southern extension, where "
    "fourteen boreholes confirmed the continuity of the principal seam over a strike length of "
    "2.8 kilometres.\n\n"
    "The stripping ratio for the reporting period averaged 1.62 cubic metres per tonne, marginally "
    "better than the 1.71 assumed in the approved mining plan. Coal quality remained in the G9 to "
    "G11 band, consistent with the grade declared for despatches to linked power stations."
)

SPECS = []

SPECS.append(("EN-01_Jharia_BCCL_FY2024-25.pdf", english(
    title="ANNUAL MINING REPORT 2024-25",
    org="Bharat Coking Coal Limited - Jharia Division",
    ref="Report Reference: BCCL/JHR/2024-25/MR/017",
    footer="BCCL Jharia Division - For Official Use Only",
    mine="Jharia Coal Mine", location="Dhanbad, Jharkhand, India",
    district="Dhanbad", state="Jharkhand",
    company="Bharat Coking Coal Limited (BCCL)",
    method="Underground", mineral="Coking Coal",
    period="FY 2024-25 (April 2024 to March 2025)", date="15-04-2025",
    production=[
        "Total coal extracted during FY 2024-25: 3,50,000 MT",
        "Peak monthly production: 35,000 MT (December 2024)",
        "Average daily production: 1,200 MT",
        "Grade: Coking Coal, Grade III",
        "Calorific value: 5,200 kcal/kg",
        "Ash content: 18 to 22 per cent",
    ],
    reserves=[
        "Proved reserves: 15.0 million tonnes",
        "Indicated reserves: 8.4 million tonnes",
        "Estimated mine life at current rate of extraction: 42 years",
    ],
    geology=JHARIA_GEO,
)))

SPECS.append(("EN-02_Gevra_SECL_FY2024-25.pdf", english(
    title="ANNUAL MINING REPORT 2024-25",
    org="South Eastern Coalfields Limited - Gevra Area",
    ref="Report Reference: SECL/GEV/2024-25/MR/004",
    footer="SECL Gevra Area - For Official Use Only",
    mine="Gevra Opencast Mine", location="Korba, Chhattisgarh, India",
    district="Korba", state="Chhattisgarh",
    company="South Eastern Coalfields Limited (SECL)",
    method="Opencast", mineral="Non-Coking Coal",
    period="FY 2024-25 (April 2024 to March 2025)", date="28-04-2025",
    production=[
        "Total coal extracted during FY 2024-25: 52.5 million tonnes",
        "Overburden removed: 85.1 million cubic metres",
        "Stripping ratio: 1.62 cubic metres per tonne",
        "Grade band: G9 to G11",
        "Despatch by rail: 41.2 million tonnes",
        "Despatch by road: 11.3 million tonnes",
    ],
    reserves=[
        "Proved reserves: 780 million tonnes",
        "Indicated reserves: 245 million tonnes",
        "Estimated mine life at current rate of extraction: 21 years",
    ],
    geology=GEVRA_GEO,
)))

# Same mine, same period, a different production figure. This is the pair the
# cross-document conflict detector is meant to surface.
SPECS.append(("EN-03_Gevra_SECL_FY2024-25_REVISED.pdf", english(
    title="REVISED ANNUAL MINING REPORT 2024-25",
    org="South Eastern Coalfields Limited - Gevra Area",
    ref="Report Reference: SECL/GEV/2024-25/MR/004-R1",
    footer="SECL Gevra Area - Revised Return - For Official Use Only",
    mine="Gevra Opencast Mine", location="Korba, Chhattisgarh, India",
    district="Korba", state="Chhattisgarh",
    company="South Eastern Coalfields Limited (SECL)",
    method="Opencast", mineral="Non-Coking Coal",
    period="FY 2024-25 (April 2024 to March 2025)", date="11-06-2025",
    production=[
        "Total coal extracted during FY 2024-25: 49.8 million tonnes",
        "Overburden removed: 85.1 million cubic metres",
        "Stripping ratio: 1.71 cubic metres per tonne",
        "Grade band: G9 to G11",
        "Figures revised following reconciliation of weighbridge records for Q3.",
    ],
    reserves=[
        "Proved reserves: 780 million tonnes",
        "Indicated reserves: 245 million tonnes",
        "Estimated mine life at current rate of extraction: 22 years",
    ],
    geology=GEVRA_GEO,
    extras=[
        "Reconcile weighbridge and despatch records monthly rather than quarterly.",
        "Withdraw the figures circulated in MR/004 and treat this return as final.",
    ],
)))

# A different reporting period. Nothing here should be reported as conflicting
# with EN-02 or EN-03 - that is the point of including it.
SPECS.append(("EN-04_Talcher_MCL_FY2023-24.pdf", english(
    title="ANNUAL MINING REPORT 2023-24",
    org="Mahanadi Coalfields Limited - Talcher Area",
    ref="Report Reference: MCL/TAL/2023-24/MR/009",
    footer="MCL Talcher Area - For Official Use Only",
    mine="Talcher Opencast Mine", location="Angul, Odisha, India",
    district="Angul", state="Odisha",
    company="Mahanadi Coalfields Limited (MCL)",
    method="Opencast", mineral="Non-Coking Coal",
    period="FY 2023-24 (April 2023 to March 2024)", date="30-05-2024",
    production=[
        "Total coal extracted during FY 2023-24: 38.4 million tonnes",
        "Overburden removed: 47.9 million cubic metres",
        "Stripping ratio: 1.25 cubic metres per tonne",
        "Grade band: G11 to G13",
    ],
    reserves=[
        "Proved reserves: 512 million tonnes",
        "Indicated reserves: 190 million tonnes",
        "Estimated mine life at current rate of extraction: 18 years",
    ],
    geology=(
        "The Talcher coalfield is characterised by thick, gently dipping seams that lend themselves "
        "to large-scale opencast working. Drilling during the year was concentrated in the north-western "
        "block, where nine boreholes established seam continuity beneath the Brahmani alluvium.\n\n"
        "Overburden consists predominantly of unconsolidated sandstone and shale with an average "
        "thickness of 62 metres. Slope stability monitoring was extended to the full length of the "
        "western dump following minor tension cracking observed in September 2023."
    ),
)))

SPECS.append(("EN-05_Bailadila_NMDC_FY2024-25.pdf", english(
    title="ANNUAL MINING REPORT 2024-25",
    org="NMDC Limited - Bailadila Iron Ore Project",
    ref="Report Reference: NMDC/BIOM/2024-25/MR/002",
    footer="NMDC Bailadila Project - For Official Use Only",
    mine="Bailadila Deposit 14/11C", location="Dantewada, Chhattisgarh, India",
    district="Dantewada", state="Chhattisgarh",
    company="NMDC Limited",
    method="Opencast", mineral="Iron Ore (Haematite)",
    period="FY 2024-25 (April 2024 to March 2025)", date="22-05-2025",
    production=[
        "Total iron ore extracted during FY 2024-25: 12.8 million tonnes",
        "Lump ore: 6.1 million tonnes",
        "Fines: 6.7 million tonnes",
        "Average Fe content: 64.8 per cent",
        "Silica: 2.1 per cent, Alumina: 1.9 per cent",
    ],
    reserves=[
        "Proved reserves: 210 million tonnes",
        "Indicated reserves: 96 million tonnes",
        "Estimated mine life at current rate of extraction: 24 years",
    ],
    geology=(
        "The Bailadila range hosts high-grade haematite within the Bailadila Iron Ore Formation of the "
        "Bastar craton. The ore body at Deposit 14 is a tabular lode conformable with the banded "
        "haematite quartzite host rock, traceable along strike for 4.2 kilometres.\n\n"
        "Exploration during the year comprised 4,100 metres of core drilling across eighteen holes. "
        "Fe grades in the upper benches remain consistent with the resource model; a localised zone of "
        "higher alumina was delineated in the southern bench and will be blended at the crushing plant."
    ),
)))

# No production figure anywhere in the document.
SPECS.append(("EN-06_Korba_SECL_FY2024-25_INCOMPLETE.pdf", english(
    title="INTERIM MINING REPORT 2024-25",
    org="South Eastern Coalfields Limited - Korba Area",
    ref="Report Reference: SECL/KOR/2024-25/MR/011-INT",
    footer="SECL Korba Area - Interim Return - For Official Use Only",
    mine="Kusmunda Opencast Mine", location="Korba, Chhattisgarh, India",
    district="Korba", state="Chhattisgarh",
    company="South Eastern Coalfields Limited (SECL)",
    method="Opencast", mineral="Non-Coking Coal",
    period="FY 2024-25 (April 2024 to March 2025)", date="09-01-2025",
    production=[
        "Production figures for the year are not yet available and will be furnished in the final return.",
        "Weighbridge data for the third quarter is under reconciliation.",
        "Grade band: G10 to G12",
    ],
    reserves=[
        "Reserve statement to be revised after the ongoing exploration programme concludes.",
    ],
    geology=(
        "This interim return covers exploration and compliance activity only. A full geological "
        "statement, together with production and reserve figures, will accompany the final return "
        "for the year.\n\n"
        "Drilling in the eastern extension continued through the period. Results are being compiled "
        "and have not been incorporated into the resource model at the date of this return."
    ),
    extras=["Submit the final return with audited production figures by 31 May 2025."],
)))

# Byte-for-byte the same content as EN-01 under a different filename.
SPECS.append(("EN-07_Jharia_BCCL_FY2024-25_copy.pdf", SPECS[0][1]))


# --------------------------------------------------------------------------- Hindi

HI_GEO = (
    "सिंगरौली कोयला क्षेत्र देश के सबसे बड़े ताप विद्युत संयंत्रों को कोयला उपलब्ध कराता है। "
    "रिपोर्ट अवधि के दौरान पट्टा क्षेत्र में कुल 22.6 वर्ग किलोमीटर में भूवैज्ञानिक सर्वेक्षण किया गया। "
    "कुल सत्रह बोरहोल खोदे गए, जिनमें मुख्य कोयला सीम की निरंतरता की पुष्टि हुई।\n\n"
    "कोयला सीम की मोटाई 9.5 मीटर से 14.2 मीटर के बीच पाई गई। ढाल उत्तर-पूर्व दिशा में 1:18 है। "
    "अधिभार की औसत मोटाई 58 मीटर दर्ज की गई। खनन स्तर पर जल रिसाव सामान्य सीमा के भीतर रहा।"
)


def hindi(*, ref, date, production_line, extra_production, note=None,
          period="वित्तीय वर्ष 2024-25 (अप्रैल 2024 से मार्च 2025)",
          title="वार्षिक खनन रिपोर्ट 2024-25"):
    rows = [
        ("खान का नाम", "जयंत खुली खदान"),
        ("स्थान", "सिंगरौली, मध्य प्रदेश, भारत"),
        ("जिला", "सिंगरौली"),
        ("राज्य", "मध्य प्रदेश"),
        ("कंपनी", "नॉर्दर्न कोलफील्ड्स लिमिटेड (एनसीएल)"),
        ("खनिज", "गैर-कोकिंग कोयला"),
        ("खनन विधि", "खुली खदान"),
        ("रिपोर्ट अवधि", period),
        ("रिपोर्ट की तिथि", date),
    ]
    production = [production_line] + extra_production
    blocks = [
        ("heading", "1. खान का विवरण"),
        ("fields", rows),
        ("heading", "2. उत्पादन सारांश"),
        ("bullets", production),
        ("heading", "3. भूवैज्ञानिक निष्कर्ष"),
        ("text", HI_GEO),
        ("heading", "4. भंडार की स्थिति"),
        ("bullets", [
            "सिद्ध भंडार: 1,240 मिलियन टन",
            "संकेतित भंडार: 385 मिलियन टन",
            "वर्तमान उत्पादन दर पर अनुमानित खदान आयु: 28 वर्ष",
        ]),
        ("page", None),
        ("heading", "5. पर्यावरण अनुपालन"),
        ("bullets", [
            "परिवेशी वायु गुणवत्ता की निगरानी चार स्थानों पर लगातार की गई।",
            "खदान के जल का उपचार कर धूल दमन हेतु पुनः उपयोग किया गया।",
            "वर्ष के दौरान 65 हेक्टेयर क्षेत्र में वृक्षारोपण पूर्ण किया गया।",
            "राज्य प्रदूषण नियंत्रण बोर्ड को त्रैमासिक विवरणी समय पर प्रस्तुत की गई।",
        ]),
        ("heading", "6. सुरक्षा"),
        ("bullets", [
            "रिपोर्ट अवधि में कोई घातक दुर्घटना दर्ज नहीं की गई।",
            "डीजीएमएस के परिपत्रों के अनुसार सभी वैधानिक निरीक्षण पूर्ण किए गए।",
            "प्रति लाख टन पर सूचनीय चोट दर 0.09 रही।",
        ]),
        ("heading", "7. सिफारिशें"),
        ("bullets", [
            "पूर्वी खंड में अन्वेषण हेतु ड्रिलिंग जारी रखी जाए।",
            "सड़क परिवहन घटाने के लिए दूसरी कन्वेयर प्रणाली चालू की जाए।",
            "मानसून से पूर्व अधिभार डंप की ढाल संरचना की समीक्षा की जाए।",
        ]),
    ]
    if note:
        blocks.insert(3, ("text", note))
    return {
        "title": title,
        "org": "नॉर्दर्न कोलफील्ड्स लिमिटेड - जयंत परियोजना",
        "ref": ref,
        "footer": "एनसीएल जयंत परियोजना - केवल कार्यालयीन उपयोग हेतु",
        "script": "devanagari",
        "blocks": blocks,
    }


SPECS.append(("HI-01_Jayant_NCL_FY2024-25.pdf", hindi(
    ref="रिपोर्ट संदर्भ: एनसीएल/जेवाई/2024-25/एमआर/006",
    date="18-04-2025",
    production_line="वित्तीय वर्ष 2024-25 में कुल कोयला उत्पादन: 23.6 मिलियन टन",
    extra_production=[
        "हटाया गया अधिभार: 41.8 मिलियन घन मीटर",
        "अनुपात: 1.77 घन मीटर प्रति टन",
        "श्रेणी: जी10 से जी12",
        "रेल द्वारा प्रेषण: 19.4 मिलियन टन",
    ],
)))

# The same mine and the same year, restated. This pair exercises conflict
# detection when both documents are in Devanagari.
SPECS.append(("HI-02_Jayant_NCL_FY2024-25_sanshodhit.pdf", hindi(
    ref="रिपोर्ट संदर्भ: एनसीएल/जेवाई/2024-25/एमआर/006-आर1",
    date="27-06-2025",
    production_line="वित्तीय वर्ष 2024-25 में कुल कोयला उत्पादन: 21.9 मिलियन टन",
    extra_production=[
        "हटाया गया अधिभार: 41.8 मिलियन घन मीटर",
        "अनुपात: 1.91 घन मीटर प्रति टन",
        "श्रेणी: जी10 से जी12",
        "तीसरी तिमाही के तौल-सेतु अभिलेखों के मिलान के बाद आंकड़े संशोधित किए गए।",
    ],
    note="यह संशोधित विवरणी पूर्व में प्रसारित विवरणी एमआर/006 का स्थान लेती है।",
)))


# --------------------------------------------------------------------------- Telugu

def telugu(*, title, org, ref, footer, mine, place, district, company,
           method, period, date, production, reserves, geology):
    rows = [
        ("గని పేరు", mine),
        ("ప్రదేశం", place),
        ("జిల్లా", district),
        ("రాష్ట్రం", "తెలంగాణ"),
        ("సంస్థ", company),
        ("ఖనిజం", "బొగ్గు"),
        ("తవ్వకం విధానం", method),
        ("నివేదిక కాలం", period),
        ("నివేదిక తేదీ", date),
    ]
    blocks = [
        ("heading", "1. గని వివరాలు"),
        ("fields", rows),
        ("heading", "2. ఉత్పత్తి సారాంశం"),
        ("bullets", production),
        ("heading", "3. భూగర్భ శాస్త్ర పరిశీలనలు"),
        ("text", geology),
        ("heading", "4. నిల్వల స్థితి"),
        ("bullets", reserves),
        ("page", None),
        ("heading", "5. పర్యావరణ అనుసరణ"),
        ("bullets", [
            "నాలుగు కేంద్రాల వద్ద గాలి నాణ్యత నిరంతరం పర్యవేక్షించబడింది.",
            "గని నీటిని శుద్ధి చేసి ధూళి అణచివేతకు తిరిగి ఉపయోగించారు.",
            "ఈ సంవత్సరంలో 38 హెక్టార్లలో మొక్కల పెంపకం పూర్తయింది.",
            "రాష్ట్ర కాలుష్య నియంత్రణ మండలికి త్రైమాసిక నివేదికలు సకాలంలో సమర్పించబడ్డాయి.",
        ]),
        ("heading", "6. భద్రత"),
        ("bullets", [
            "నివేదిక కాలంలో ఎటువంటి ప్రాణాంతక ప్రమాదం నమోదు కాలేదు.",
            "డిజిఎంఎస్ ఆదేశాల ప్రకారం అన్ని చట్టబద్ధ తనిఖీలు పూర్తి చేయబడ్డాయి.",
            "లక్ష టన్నులకు నివేదించదగిన గాయాల రేటు 0.12గా ఉంది.",
        ]),
        ("heading", "7. సిఫారసులు"),
        ("bullets", [
            "తూర్పు బ్లాక్‌లో అన్వేషణ డ్రిల్లింగ్ కొనసాగించాలి.",
            "రోడ్డు రవాణాను తగ్గించేందుకు రెండవ కన్వేయర్ వ్యవస్థను ప్రారంభించాలి.",
            "వర్షాకాలానికి ముందు వ్యర్థ కుప్పల వాలు నమూనాను సమీక్షించాలి.",
        ]),
    ]
    return {"title": title, "org": org, "ref": ref, "footer": footer,
            "script": "telugu", "blocks": blocks}


SPECS.append(("TE-01_Ramagundam_SCCL_FY2024-25.pdf", telugu(
    title="వార్షిక గనుల నివేదిక 2024-25",
    org="సింగరేణి కాలరీస్ కంపెనీ లిమిటెడ్ - రామగుండం ఏరియా",
    ref="నివేదిక సూచిక: ఎస్‌సిసిఎల్/ఆర్‌జిడి/2024-25/ఎంఆర్/008",
    footer="ఎస్‌సిసిఎల్ రామగుండం ఏరియా - అధికారిక ఉపయోగం కోసం మాత్రమే",
    mine="రామగుండం ఓపెన్‌కాస్ట్ గని-III",
    place="రామగుండం, పెద్దపల్లి, తెలంగాణ, భారతదేశం",
    district="పెద్దపల్లి",
    company="సింగరేణి కాలరీస్ కంపెనీ లిమిటెడ్ (ఎస్‌సిసిఎల్)",
    method="ఓపెన్‌కాస్ట్",
    period="ఆర్థిక సంవత్సరం 2024-25 (ఏప్రిల్ 2024 నుండి మార్చి 2025 వరకు)",
    date="20-04-2025",
    production=[
        "ఆర్థిక సంవత్సరం 2024-25లో మొత్తం బొగ్గు ఉత్పత్తి: 14.2 మిలియన్ టన్నులు",
        "తొలగించిన వ్యర్థ పదార్థం: 26.5 మిలియన్ ఘనపు మీటర్లు",
        "నిష్పత్తి: టన్నుకు 1.87 ఘనపు మీటర్లు",
        "గ్రేడ్: జి9 నుండి జి11",
        "రైలు ద్వారా రవాణా: 11.6 మిలియన్ టన్నులు",
    ],
    reserves=[
        "నిరూపితమైన నిల్వలు: 402 మిలియన్ టన్నులు",
        "సూచిత నిల్వలు: 138 మిలియన్ టన్నులు",
        "ప్రస్తుత ఉత్పత్తి రేటు వద్ద అంచనా గని జీవితకాలం: 26 సంవత్సరాలు",
    ],
    geology=(
        "గోదావరి లోయ బొగ్గు క్షేత్రం దక్షిణ భారతదేశంలోని అతిపెద్ద బొగ్గు నిక్షేపం. "
        "నివేదిక కాలంలో లీజు ప్రాంతంలో 16.8 చదరపు కిలోమీటర్ల మేర భూగర్భ సర్వే నిర్వహించారు. "
        "మొత్తం పదమూడు బోరు రంధ్రాలు తవ్వగా, ప్రధాన బొగ్గు పొర నిరంతరత ధృవీకరించబడింది.\n\n"
        "బొగ్గు పొర మందం 6.4 మీటర్ల నుండి 11.8 మీటర్ల మధ్య నమోదైంది. వాలు ఈశాన్య దిశలో 1:16గా ఉంది. "
        "వ్యర్థ పదార్థ సగటు మందం 47 మీటర్లు. తవ్వకం స్థాయిలో నీటి ఊట సాధారణ పరిధిలోనే ఉంది."
    ),
)))

SPECS.append(("TE-02_Kothagudem_SCCL_FY2024-25.pdf", telugu(
    title="వార్షిక గనుల నివేదిక 2024-25",
    org="సింగరేణి కాలరీస్ కంపెనీ లిమిటెడ్ - కొత్తగూడెం ఏరియా",
    ref="నివేదిక సూచిక: ఎస్‌సిసిఎల్/కెజిఎం/2024-25/ఎంఆర్/013",
    footer="ఎస్‌సిసిఎల్ కొత్తగూడెం ఏరియా - అధికారిక ఉపయోగం కోసం మాత్రమే",
    mine="కొత్తగూడెం భూగర్భ గని-21",
    place="కొత్తగూడెం, భద్రాద్రి కొత్తగూడెం, తెలంగాణ, భారతదేశం",
    district="భద్రాద్రి కొత్తగూడెం",
    company="సింగరేణి కాలరీస్ కంపెనీ లిమిటెడ్ (ఎస్‌సిసిఎల్)",
    method="భూగర్భ",
    period="ఆర్థిక సంవత్సరం 2024-25 (ఏప్రిల్ 2024 నుండి మార్చి 2025 వరకు)",
    date="25-04-2025",
    production=[
        "ఆర్థిక సంవత్సరం 2024-25లో మొత్తం బొగ్గు ఉత్పత్తి: 8,40,000 టన్నులు",
        "గరిష్ఠ నెలవారీ ఉత్పత్తి: 82,000 టన్నులు (జనవరి 2025)",
        "సగటు రోజువారీ ఉత్పత్తి: 2,850 టన్నులు",
        "గ్రేడ్: జి8 నుండి జి10",
        "బూడిద శాతం: 24 నుండి 28 శాతం",
    ],
    reserves=[
        "నిరూపితమైన నిల్వలు: 58 మిలియన్ టన్నులు",
        "సూచిత నిల్వలు: 21 మిలియన్ టన్నులు",
        "ప్రస్తుత ఉత్పత్తి రేటు వద్ద అంచనా గని జీవితకాలం: 34 సంవత్సరాలు",
    ],
    geology=(
        "కొత్తగూడెం గని బోర్డు మరియు పిల్లర్ పద్ధతిలో, నిరంతర తవ్వకం యంత్రాల సహాయంతో నడుస్తోంది. "
        "నివేదిక కాలంలో అన్వేషణ ప్రధానంగా దక్షిణ విస్తరణపై కేంద్రీకరించబడింది.\n\n"
        "పైకప్పు పరిస్థితులు పశ్చిమ ప్యానెల్‌లలో మధ్యస్థం నుండి కష్టతరంగా ఉన్నాయి, "
        "కాబట్టి క్రమబద్ధమైన మద్దతు నియమాలు కొనసాగుతున్నాయి. "
        "ప్రస్తుత పని స్థాయి కంటే భూగర్భ జల మట్టం దిగువన ఉంది."
    ),
)))


# --------------------------------------------------------------------------- scanned

# These two are generated as ordinary PDFs and then flattened to page images,
# so the only way to read them is OCR.
SCANNED = [
    ("SCAN-01_Sohagpur_SECL_FY2024-25_scanned.pdf", english(
        title="ANNUAL MINING REPORT 2024-25",
        org="South Eastern Coalfields Limited - Sohagpur Area",
        ref="Report Reference: SECL/SHD/2024-25/MR/021",
        footer="SECL Sohagpur Area - For Official Use Only",
        mine="Amlai Underground Mine", location="Shahdol, Madhya Pradesh, India",
        district="Shahdol", state="Madhya Pradesh",
        company="South Eastern Coalfields Limited (SECL)",
        method="Underground", mineral="Non-Coking Coal",
        period="FY 2024-25 (April 2024 to March 2025)", date="02-05-2025",
        production=[
            "Total coal extracted during FY 2024-25: 6,20,000 MT",
            "Peak monthly production: 61,000 MT (February 2025)",
            "Average daily production: 2,100 MT",
            "Grade band: G8 to G10",
            "Ash content: 26 to 30 per cent",
        ],
        reserves=[
            "Proved reserves: 74 million tonnes",
            "Indicated reserves: 29 million tonnes",
            "Estimated mine life at current rate of extraction: 31 years",
        ],
        geology=(
            "The Sohagpur coalfield is worked by bord and pillar methods supported by continuous "
            "miners in the newer panels. Exploration during the year comprised eleven boreholes "
            "totalling 2,640 metres, concentrated along the southern boundary of the lease.\n\n"
            "Seam thickness varies between 2.8 and 5.1 metres. The dip is gentle at approximately "
            "1 in 22. Roof conditions are generally good; a localised slip was encountered in panel "
            "7 and was dealt with by additional roof bolting."
        ),
    )),
    ("SCAN-02_Jayant_NCL_hindi_scanned.pdf", hindi(
        title="वार्षिक खनन रिपोर्ट 2023-24",
        period="वित्तीय वर्ष 2023-24 (अप्रैल 2023 से मार्च 2024)",
        ref="रिपोर्ट संदर्भ: एनसीएल/जेवाई/2023-24/एमआर/004",
        date="12-05-2024",
        production_line="वित्तीय वर्ष 2023-24 में कुल कोयला उत्पादन: 20.4 मिलियन टन",
        extra_production=[
            "हटाया गया अधिभार: 37.2 मिलियन घन मीटर",
            "अनुपात: 1.82 घन मीटर प्रति टन",
            "श्रेणी: जी10 से जी12",
        ],
    )),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    written = []

    for name, spec in SPECS:
        data = build(spec)
        with open(os.path.join(OUT, name), "wb") as handle:
            handle.write(data)
        written.append((name, len(data), "text"))

    for name, spec in SCANNED:
        data = flatten(build(spec))
        with open(os.path.join(OUT, name), "wb") as handle:
            handle.write(data)
        written.append((name, len(data), "image only"))

    width = max(len(n) for n, _, _ in written)
    for name, size, kind in written:
        print(f"  {name:<{width}}  {size/1024:7.1f} kB  {kind}")
    print(f"\n{len(written)} files in {OUT}")


if __name__ == "__main__":
    main()
