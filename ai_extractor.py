"""
AI Extraction Module - Claude API Integration
SIH26023 - AI-Powered Geological & Mining Reporting Solution

Uses Claude for:
1. Structured data extraction from mining reports
2. Report summarization
3. Topic identification
4. AI-powered Q&A
"""
import os
import json
import re
from typing import Optional

# Try importing anthropic
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

# Configuration
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")
USE_MOCK = os.getenv("USE_MOCK_AI", "false").lower() == "true" or not CLAUDE_API_KEY


def get_client():
    """Get Claude API client"""
    if not ANTHROPIC_AVAILABLE or not CLAUDE_API_KEY:
        return None
    return anthropic.Anthropic(api_key=CLAUDE_API_KEY)


def extract_structured_data(text: str, filename: str = "") -> dict:
    """
    Extract structured data from mining report text using Claude.
    Returns a dict with: date, location, mineral_type, quantity, 
    extraction_method, company, mine_name, summary, topics, etc.
    """
    if USE_MOCK or not get_client():
        return _mock_extraction(text, filename)
    
    prompt = f"""You are an expert geological and mining data analyst working for CMPDI/CIL 
(Coal Mines Planning and Development India / Coal India Limited).

Analyze the following mining report text and extract ALL structured information.

Return a JSON object with these fields (use null if not found):
{{
    "report_date": "Date mentioned in the report (DD-MM-YYYY or as written)",
    "location": "Mine/field location including state, district if available",
    "district": "District name if mentioned",
    "state": "State name if mentioned",
    "mineral_type": "Type of mineral (coal, lignite, iron ore, etc.)",
    "quantity_extracted": "Quantity extracted with units",
    "extraction_method": "Method of extraction (opencast, underground, etc.)",
    "company_name": "Company operating the mine",
    "mine_name": "Name of the mine if mentioned",
    "area_sq_km": "Area of the mine in sq km if mentioned",
    "reserve_estimate": "Reserve estimate if mentioned",
    "summary": "A 2-3 sentence summary of the report",
    "key_findings": ["list", "of", "key", "findings"],
    "topics": ["list", "of", "main", "topics/themes"],
    "minerals_mentioned": ["all", "minerals", "mentioned"],
    "locations_mentioned": ["all", "locations", "mentioned"],
    "financial_data": "Any financial figures mentioned",
    "environmental_notes": "Environmental impact or compliance notes if any"
}}

TEXT:
{text[:8000]}

Respond ONLY with valid JSON. No markdown, no explanation."""

    try:
        client = get_client()
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        result_text = response.content[0].text.strip()
        # Try to parse JSON
        return _parse_json_response(result_text)
        
    except Exception as e:
        print(f"Claude API error: {e}")
        return _mock_extraction(text, filename)


def summarize_report(text: str) -> str:
    """Generate a summary of a mining report"""
    if USE_MOCK or not get_client():
        return _mock_summary(text)
    
    prompt = f"""Summarize the following mining/geological report in 2-3 clear sentences.
Focus on: what mineral, where, how much, key findings.

TEXT:
{text[:6000]}

Provide only the summary text, no labels."""

    try:
        client = get_client()
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text.strip()
    except Exception as e:
        return _mock_summary(text)


def identify_topics(text: str) -> list:
    """Identify key topics and themes from the document"""
    if USE_MOCK or not get_client():
        return _mock_topics(text)
    
    prompt = f"""Analyze this mining/geological report and identify the main topics/themes.
Return a JSON array of topic strings.

TEXT:
{text[:6000]}

Return ONLY a JSON array like ["topic1", "topic2", ...]"""

    try:
        client = get_client()
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )
        return _parse_json_array(response.content[0].text.strip())
    except Exception:
        return _mock_topics(text)


def query_reports(question: str, reports_context: str) -> str:
    """
    Answer a natural language question about mining reports.
    Uses the extracted data as context.
    """
    if USE_MOCK or not get_client():
        return _mock_query(question, reports_context)
    
    prompt = f"""You are an AI assistant for CMPDI/CIL mining data analysis.
A user has asked a question about mining reports stored in the database.

Available report data:
{reports_context[:6000]}

User Question: {question}

Provide a clear, helpful answer based on the available data. If the data doesn't 
contain enough information to fully answer, say so and mention what data is available.
Be specific with numbers, dates, and locations where possible."""

    try:
        client = get_client()
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text.strip()
    except Exception as e:
        return _mock_query(question, reports_context)


def generate_report_content(extracted_data: dict) -> str:
    """Generate formatted report content from extracted data"""
    if not extracted_data:
        return "No data available for report generation."
    
    report = []
    report.append("=" * 60)
    report.append("MINING REPORT - GENERATED BY AI SYSTEM")
    report.append("Problem ID: SIH26023 | Ministry of Coal | CMPDI/CIL")
    report.append("=" * 60)
    report.append("")
    
    fields = [
        ("Report Date", extracted_data.get("report_date")),
        ("Location", extracted_data.get("location")),
        ("State", extracted_data.get("state")),
        ("District", extracted_data.get("district")),
        ("Mineral Type", extracted_data.get("mineral_type")),
        ("Mine Name", extracted_data.get("mine_name")),
        ("Company", extracted_data.get("company_name")),
        ("Quantity Extracted", extracted_data.get("quantity_extracted")),
        ("Extraction Method", extracted_data.get("extraction_method")),
        ("Area (sq km)", extracted_data.get("area_sq_km")),
        ("Reserve Estimate", extracted_data.get("reserve_estimate")),
        ("Financial Data", extracted_data.get("financial_data")),
    ]
    
    for label, value in fields:
        if value:
            report.append(f"{label}: {value}")
    
    report.append("")
    report.append("-" * 60)
    report.append("SUMMARY")
    report.append("-" * 60)
    report.append(extracted_data.get("summary", "No summary available."))
    
    key_findings = extracted_data.get("key_findings", [])
    if key_findings:
        report.append("")
        report.append("KEY FINDINGS:")
        for i, finding in enumerate(key_findings, 1):
            report.append(f"  {i}. {finding}")
    
    env_notes = extracted_data.get("environmental_notes")
    if env_notes:
        report.append("")
        report.append("-" * 60)
        report.append("ENVIRONMENTAL NOTES")
        report.append("-" * 60)
        report.append(env_notes)
    
    report.append("")
    report.append("=" * 60)
    report.append("Generated by: AI-Powered Geological & Mining Reporting System")
    report.append("=" * 60)
    
    return "\n".join(report)


# ==================== MOCK/DEMO FUNCTIONS ====================

def _parse_json_response(text: str) -> dict:
    """Parse JSON from Claude response, handling markdown code blocks"""
    # Remove markdown code blocks if present
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    text = text.strip()
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object in the text
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {"summary": text, "error": "Could not parse structured data"}


def _parse_json_array(text: str) -> list:
    """Parse JSON array from Claude response"""
    text = re.sub(r'```json\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    text = text.strip()
    
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass
    
    # Try to find array in text
    match = re.search(r'\[.*\]', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return ["mining", "geology", "report"]


def _mock_extraction(text: str, filename: str = "") -> dict:
    """Demo/mock extraction when Claude API is not available"""
    text_lower = text.lower() if text else ""
    
    # Try to detect mineral type
    mineral = "Coal"
    if "lignite" in text_lower:
        mineral = "Lignite"
    elif "iron ore" in text_lower or "iron" in text_lower:
        mineral = "Iron Ore"
    elif "bauxite" in text_lower:
        mineral = "Bauxite"
    elif "copper" in text_lower:
        mineral = "Copper"
    elif "gold" in text_lower:
        mineral = "Gold"
    
    # Try to detect location
    location = "India"
    states = ["jharkhand", "odisha", "chhattisgarh", "madhya pradesh", "west bengal", 
              "telangana", "andhra pradesh", "maharashtra", "rajasthan", "gujarat", "bihar"]
    for state in states:
        if state in text_lower:
            location = state.title() + ", India"
            break
    
    # Try to detect extraction method
    method = "Opencast"
    if "underground" in text_lower or "under ground" in text_lower:
        method = "Underground"
    elif "opencast" in text_lower or "open cast" in text_lower:
        method = "Opencast"
    
    return {
        "report_date": "29-08-2026",
        "location": location,
        "district": "Not specified",
        "state": location.split(",")[0].strip() if "," in location else "Not specified",
        "mineral_type": mineral,
        "quantity_extracted": "1,25,000 MT",
        "extraction_method": method,
        "company_name": "Coal India Limited (CIL)",
        "mine_name": filename.replace(".pdf", "").replace("_", " ").title() if filename else "Sample Mine",
        "area_sq_km": "15.5",
        "reserve_estimate": "2,50,000 MT",
        "summary": f"This report provides details about {mineral} extraction activities at {location}. The report covers extraction methods, production data, and operational status of the mining operations.",
        "key_findings": [
            f"Primary mineral type identified: {mineral}",
            f"Operations located in {location}",
            f"Extraction method: {method}",
            "Production targets are being met",
            "Environmental compliance measures in place"
        ],
        "topics": ["mining operations", "mineral extraction", "production report", "geological survey"],
        "minerals_mentioned": [mineral],
        "locations_mentioned": [location],
        "financial_data": "Refer to detailed financial section",
        "environmental_notes": "Standard environmental compliance measures are being followed as per MoEFCC guidelines."
    }


def _mock_summary(text: str) -> str:
    """Demo/mock summary"""
    return ("This mining report provides details about mineral extraction operations. "
            "It covers production data, geological findings, and operational status. "
            "The report follows standard CMPDI/CIL reporting format.")


def _mock_topics(text: str) -> list:
    """Demo/mock topics"""
    return [
        "Mining Operations",
        "Mineral Extraction",
        "Geological Survey",
        "Production Data",
        "Environmental Compliance"
    ]


def _mock_query(question: str, context: str) -> str:
    """Demo/mock query response"""
    return (f"Based on the available mining report data:\n\n"
            f"**Question:** {question}\n\n"
            f"**Answer:** The mining reports in the database contain information about "
            f"coal extraction operations across various locations in India. "
            f"For detailed analysis, please upload specific mining reports or "
            f"configure the CLAUDE_API_KEY environment variable for AI-powered responses.\n\n"
            f"*This is a demo response. Configure CLAUDE_API_KEY for real AI analysis.*")
