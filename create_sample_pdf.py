"""
Create a sample mining report PDF for testing
SIH26023 - AI-Powered Geological & Mining Reporting Solution
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from fpdf import FPDF
    
    class MiningReportPDF(FPDF):
        def header(self):
            self.set_font("Helvetica", "B", 14)
            self.cell(0, 10, "ANNUAL MINING REPORT 2024-2025", align="C", new_x="LMARGIN", new_y="NEXT")
            self.set_font("Helvetica", "", 10)
            self.cell(0, 6, "Coal India Limited - Northern Coalfields Division", align="C", new_x="LMARGIN", new_y="NEXT")
            self.cell(0, 6, "Report Reference: CIL/NCF/2024-25/MR/001", align="C", new_x="LMARGIN", new_y="NEXT")
            self.line(10, self.get_y(), 200, self.get_y())
            self.ln(5)
        
        def footer(self):
            self.set_y(-15)
            self.set_font("Helvetica", "I", 8)
            self.cell(0, 10, "CONFIDENTIAL - For Official Use Only", align="C")
    
    pdf = MiningReportPDF()
    pdf.add_page()
    
    # Mine Details
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "1. MINE DETAILS", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    
    details = [
        ("Mine Name", "Jharia Coal Mine"),
        ("Location", "Dhanbad, Jharkhand, India"),
        ("State", "Jharkhand"),
        ("District", "Dhanbad"),
        ("Company", "Bharat Coking Coal Limited (BCCL)"),
        ("Mine Type", "Underground"),
        ("Area", "25.5 sq km"),
        ("Report Period", "April 2024 - March 2025"),
        ("Date of Report", "15-04-2025"),
    ]
    
    for label, value in details:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(50, 7, f"{label}:", new_x="END")
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 7, value, new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(5)
    
    # Production Data
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "2. PRODUCTION DATA", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    
    production = [
        "Total Coal Extracted: 3,50,000 Metric Tonnes (MT)",
        "Peak Monthly Production: 35,000 MT (December 2024)",
        "Average Daily Production: 1,200 MT",
        "Coal Grade: Coking Coal (Grade - III)",
        "Calorific Value: 5,200 kcal/kg",
        "Ash Content: 18-22%",
        "Moisture Content: 4-6%",
    ]
    
    for item in production:
        pdf.cell(5, 7, "-", new_x="END")
        pdf.cell(0, 7, f" {item}", new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(5)
    
    # Geological Findings
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "3. GEOLOGICAL FINDINGS", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    
    geo_text = """The Jharia coalfield is one of the oldest and most important coal mining areas in India. 
During the reporting period, extensive geological surveys were conducted across the mining lease area. 
The coal seams identified include seams I, II, III, and IV, with seam III being the most productive.

Reserve estimates indicate approximately 15 million tonnes of extractable reserves remaining in the 
current mining blocks. The coal quality analysis shows high-grade coking coal suitable for 
steel manufacturing applications.

Key geological features include:
- Seam thickness: 3.5m to 8.2m
- Dip angle: 1 in 12 to 1 in 15
- Overburden ratio: 4.5:1
- Roof condition: Moderate to difficult
- Water table: Below mining level

Seismic surveys conducted in the eastern block indicate potential for additional reserves 
that could extend the mine life by approximately 15-20 years. The geological team recommends 
further exploratory drilling in sectors 7 and 8 of the mining lease area."""
    
    pdf.multi_cell(0, 6, geo_text, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    # Environmental Compliance
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "4. ENVIRONMENTAL COMPLIANCE", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    
    env_text = """Environmental compliance activities during the reporting period included:

1. Air Quality Monitoring: Continuous monitoring stations installed at 5 locations within 
   the mining area. PM2.5 and PM10 levels maintained within NAAQS limits.

2. Water Management: Treated mine water recycled for washing and dust suppression. 
   Neutralization plant processes acidic mine drainage effectively.

3. Green Belt Development: 50 hectares of plantation completed during the year. 
   Total green cover now stands at 320 hectares within the mining lease area.

4. Mine Reclamation: Progressive reclamation carried out on 15 hectares of exhausted areas. 
   Topsoil conservation and biodiversity restoration programs implemented.

5. Carbon Footprint: Carbon emission reduction initiatives include installation of 
   solar panels (2 MW capacity) and electric vehicle fleet for internal transportation.

6. Safety Compliance: Zero fatality record maintained for the 3rd consecutive year. 
   All safety audits conducted as per DGMS guidelines."""
    
    pdf.multi_cell(0, 6, env_text, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    # Financial Summary
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "5. FINANCIAL SUMMARY", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    
    financial = [
        "Revenue from Coal Sales: INR 2,800 Crore",
        "Operating Cost: INR 1,200 Crore",
        "Net Profit: INR 1,600 Crore",
        "Royalty Paid: INR 350 Crore",
        "CSR Expenditure: INR 45 Crore",
        "Capital Investment: INR 500 Crore",
        "Employment: 8,500 direct + 12,000 indirect",
    ]
    
    for item in financial:
        pdf.cell(5, 7, "-", new_x="END")
        pdf.cell(0, 7, f" {item}", new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(5)
    
    # Recommendations
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "6. RECOMMENDATIONS", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    
    recommendations = [
        "Expand underground mining operations in sectors 7 and 8 based on geological survey results",
        "Invest in continuous miner technology to improve extraction efficiency by 20%",
        "Accelerate green belt development to meet annual target of 75 hectares",
        "Implement AI-based monitoring systems for real-time mine safety management",
        "Increase production capacity from 3,50,000 MT to 5,00,000 MT over next 3 years",
        "Develop renewable energy infrastructure to reduce carbon footprint by 30%",
    ]
    
    for i, rec in enumerate(recommendations, 1):
        pdf.cell(8, 7, f"{i}.", new_x="END")
        pdf.multi_cell(0, 7, f" {rec}", new_x="LMARGIN", new_y="NEXT")
    
    # Save
    output_path = os.path.join(os.path.dirname(__file__), "sample_mining_report.pdf")
    pdf.output(output_path)
    print(f"Sample PDF created: {output_path}")

except ImportError:
    print("fpdf2 not installed. Creating a simple text file instead.")
    
    sample_text = """
ANNUAL MINING REPORT 2024-2025
Coal India Limited - Northern Coalfields Division
Report Reference: CIL/NCF/2024-25/MR/001

1. MINE DETAILS
Mine Name: Jharia Coal Mine
Location: Dhanbad, Jharkhand, India
State: Jharkhand
District: Dhanbad
Company: Bharat Coking Coal Limited (BCCL)
Mine Type: Underground
Area: 25.5 sq km
Report Period: April 2024 - March 2025
Date of Report: 15-04-2025

2. PRODUCTION DATA
Total Coal Extracted: 3,50,000 Metric Tonnes (MT)
Peak Monthly Production: 35,000 MT (December 2024)
Average Daily Production: 1,200 MT
Coal Grade: Coking Coal (Grade - III)
Calorific Value: 5,200 kcal/kg
Ash Content: 18-22%
Moisture Content: 4-6%

3. GEOLOGICAL FINDINGS
The Jharia coalfield is one of the oldest and most important coal mining areas in India.
During the reporting period, extensive geological surveys were conducted across the mining lease area.
The coal seams identified include seams I, II, III, and IV, with seam III being the most productive.

Reserve estimates indicate approximately 15 million tonnes of extractable reserves remaining in the
current mining blocks. The coal quality analysis shows high-grade coking coal suitable for
steel manufacturing applications.

Key geological features include:
- Seam thickness: 3.5m to 8.2m
- Dip angle: 1 in 12 to 1 in 15
- Overburden ratio: 4.5:1
- Roof condition: Moderate to difficult
- Water table: Below mining level

4. ENVIRONMENTAL COMPLIANCE
Environmental compliance activities during the reporting period included:
Air Quality Monitoring: Continuous monitoring stations installed at 5 locations within the mining area.
Water Management: Treated mine water recycled for washing and dust suppression.
Green Belt Development: 50 hectares of plantation completed during the year.
Mine Reclamation: Progressive reclamation carried out on 15 hectares of exhausted areas.

5. FINANCIAL SUMMARY
Revenue from Coal Sales: INR 2,800 Crore
Operating Cost: INR 1,200 Crore
Net Profit: INR 1,600 Crore
Royalty Paid: INR 350 Crore
Employment: 8,500 direct + 12,000 indirect

6. RECOMMENDATIONS
1. Expand underground mining operations in sectors 7 and 8
2. Invest in continuous miner technology to improve extraction efficiency by 20%
3. Accelerate green belt development to meet annual target of 75 hectares
4. Implement AI-based monitoring systems for real-time mine safety management
"""
    
    output_path = os.path.join(os.path.dirname(__file__), "sample_mining_report.txt")
    with open(output_path, "w") as f:
        f.write(sample_text)
    print(f"Sample text file created: {output_path}")
