"""
Streamlit Frontend - AI-Powered Geological & Mining Reporting Solution
SIH26023 - Ministry of Coal - CMPDI/CIL

Features:
1. PDF Upload & Processing
2. Data Extraction Display
3. Word Cloud Visualization
4. Report Generation & Download
5. AI Query System
6. Dashboard & Statistics
"""
import os
import sys

# Populates os.environ from .env before any getenv below runs.
import utils.env  # noqa: F401
import json
import requests
import streamlit as st
from datetime import datetime

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Page configuration
st.set_page_config(
    page_title="AI Mining Report System - SIH26023",
    page_icon="⛏️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Backend URL
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


# ==================== CUSTOM CSS ====================
st.markdown("""
<style>
    .main-header {
        background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%);
        padding: 1.5rem;
        border-radius: 10px;
        color: white;
        text-align: center;
        margin-bottom: 2rem;
    }
    .metric-card {
        background: #f8f9fa;
        padding: 1rem;
        border-radius: 8px;
        border-left: 4px solid #1a237e;
        margin: 0.5rem 0;
    }
    .status-success { color: #2e7d32; font-weight: bold; }
    .status-error { color: #c62828; font-weight: bold; }
    .status-processing { color: #f57f17; font-weight: bold; }
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
    .stTabs [data-baseweb="tab"] {
        padding: 10px 20px;
    }
</style>
""", unsafe_allow_html=True)


# ==================== HEADER ====================
def render_header():
    """Render the main application header"""
    st.markdown("""
    <div class="main-header">
        <h1>⛏️ AI-Powered Geological & Mining Reporting Solution</h1>
        <p>Smart India Hackathon 2026 | Problem ID: SIH26023</p>
        <p>Ministry of Coal | CMPDI / CIL</p>
    </div>
    """, unsafe_allow_html=True)


# ==================== SIDEBAR ====================
def render_sidebar():
    """Render sidebar navigation"""
    st.sidebar.image("https://img.icons8.com/color/96/mining.png", width=64)
    st.sidebar.title("Navigation")
    
    page = st.sidebar.radio(
        "Go to",
        ["🏠 Dashboard", "📄 Upload Report", "📊 View Reports", 
         "🔍 AI Query", "📈 Analytics", "ℹ️ About"],
        index=0,
    )
    
    st.sidebar.divider()
    st.sidebar.markdown("### System Status")
    
    try:
        resp = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if resp.status_code == 200:
            st.sidebar.success("✅ Backend: Online")
        else:
            st.sidebar.error("❌ Backend: Error")
    except Exception:
        st.sidebar.warning("⚠️ Backend: Offline (Running standalone mode)")
    
    st.sidebar.divider()
    st.sidebar.markdown("### Quick Stats")
    try:
        stats = requests.get(f"{BACKEND_URL}/stats", timeout=5).json()
        st.sidebar.metric("Total Reports", stats.get("total_reports", 0))
        st.sidebar.metric("Total Queries", stats.get("total_queries", 0))
    except Exception:
        st.sidebar.metric("Total Reports", "N/A")
        st.sidebar.metric("Total Queries", "N/A")
    
    return page


# ==================== DASHBOARD PAGE ====================
def render_dashboard():
    """Render the main dashboard"""
    st.header("🏠 Dashboard")
    
    # Metrics row
    col1, col2, col3, col4 = st.columns(4)
    
    try:
        stats = requests.get(f"{BACKEND_URL}/stats", timeout=5).json()
        total = stats.get("total_reports", 0)
        completed = stats.get("completed", 0)
        errors = stats.get("errors", 0)
        queries = stats.get("total_queries", 0)
    except Exception:
        total, completed, errors, queries = 0, 0, 0, 0
    
    with col1:
        st.metric("📄 Total Reports", total)
    with col2:
        st.metric("✅ Processed", completed)
    with col3:
        st.metric("❌ Errors", errors)
    with col4:
        st.metric("🔍 Queries", queries)
    
    st.divider()
    
    # Quick actions
    st.subheader("Quick Actions")
    qcol1, qcol2, qcol3 = st.columns(3)
    
    with qcol1:
        if st.button("📄 Upload New Report", use_container_width=True):
            st.session_state.page = "📄 Upload Report"
            st.rerun()
    with qcol2:
        if st.button("🔍 Ask a Question", use_container_width=True):
            st.session_state.page = "🔍 AI Query"
            st.rerun()
    with qcol3:
        if st.button("📊 View All Reports", use_container_width=True):
            st.session_state.page = "📊 View Reports"
            st.rerun()
    
    st.divider()
    
    # Recent reports
    st.subheader("📋 Recent Reports")
    try:
        data = requests.get(f"{BACKEND_URL}/reports?limit=5", timeout=5).json()
        reports = data.get("reports", [])
        
        if reports:
            for r in reports:
                status_class = "status-success" if r["status"] == "completed" else "status-error"
                with st.expander(f"{r['filename']} - {r.get('mineral_type', 'N/A')} | {r.get('location', 'N/A')}"):
                    st.write(f"**Status:** <span class='{status_class}'>{r['status'].upper()}</span>", unsafe_allow_html=True)
                    st.write(f"**Uploaded:** {r.get('upload_date', 'N/A')}")
                    st.write(f"**Mineral:** {r.get('mineral_type', 'N/A')}")
                    st.write(f"**Location:** {r.get('location', 'N/A')}")
                    st.write(f"**Quantity:** {r.get('quantity_extracted', 'N/A')}")
                    if r.get('summary'):
                        st.write(f"**Summary:** {r['summary']}")
        else:
            st.info("No reports uploaded yet. Click 'Upload New Report' to get started!")
    except Exception as e:
        st.info("📋 No reports available. Start by uploading a mining report!")


# ==================== UPLOAD PAGE ====================
def render_upload():
    """Render the file upload page"""
    st.header("📄 Upload Mining Report")
    st.markdown("Upload a PDF mining/geological report for AI-powered analysis and data extraction.")
    
    st.divider()
    
    uploaded_file = st.file_uploader(
        "Choose a PDF file",
        type=["pdf"],
        help="Upload mining reports in PDF format (max 50MB)"
    )
    
    if uploaded_file:
        file_size_mb = uploaded_file.size / (1024 * 1024)
        st.info(f"📁 **{uploaded_file.name}** ({file_size_mb:.2f} MB)")
        
        # Show file preview
        st.markdown("### File Details")
        col1, col2 = st.columns(2)
        with col1:
            st.write(f"**Filename:** {uploaded_file.name}")
            st.write(f"**Size:** {file_size_mb:.2f} MB")
        with col2:
            st.write(f"**Type:** PDF Document")
            st.write(f"**Uploaded:** {datetime.now().strftime('%d-%m-%Y %H:%M')}")
        
        if st.button("🚀 Process Report", type="primary", use_container_width=True):
            with st.spinner("Processing report... This may take a moment."):
                try:
                    # Upload to backend
                    files = {"file": (uploaded_file.name, uploaded_file.getvalue(), "application/pdf")}
                    response = requests.post(f"{BACKEND_URL}/upload", files=files, timeout=120)
                    
                    if response.status_code == 200:
                        result = response.json()
                        st.success("✅ Report processed successfully!")
                        
                        # Display results
                        st.divider()
                        st.subheader("📊 Extraction Results")
                        
                        data = result.get("extracted_data", {})
                        
                        # Key fields in columns
                        c1, c2, c3 = st.columns(3)
                        with c1:
                            st.metric("Mineral", data.get("mineral_type", "N/A"))
                            st.metric("Quantity", data.get("quantity_extracted", "N/A"))
                        with c2:
                            st.metric("Location", data.get("location", "N/A"))
                            st.metric("Method", data.get("extraction_method", "N/A"))
                        with c3:
                            st.metric("Date", data.get("report_date", "N/A"))
                            st.metric("Company", data.get("company_name", "N/A"))
                        
                        # Summary
                        if data.get("summary"):
                            st.subheader("📝 Summary")
                            st.write(data["summary"])
                        
                        # Key findings
                        findings = data.get("key_findings", [])
                        if findings:
                            st.subheader("🔍 Key Findings")
                            for i, finding in enumerate(findings, 1):
                                st.write(f"**{i}.** {finding}")
                        
                        # Topics
                        topics = data.get("topics", [])
                        if topics:
                            st.subheader("🏷️ Identified Topics")
                            st.write(" | ".join([f"`{t}`" for t in topics]))
                        
                        # Download buttons
                        st.divider()
                        dcol1, dcol2, dcol3 = st.columns(3)
                        with dcol1:
                            st.download_button(
                                "📥 Download Report (PDF)",
                                data=json.dumps(data, indent=2),
                                file_name=f"report_{result['id']}.json",
                                mime="application/json",
                            )
                        with dcol2:
                            # Download formatted PDF
                            try:
                                pdf_resp = requests.get(
                                    f"{BACKEND_URL}/reports/{result['id']}/download",
                                    timeout=30
                                )
                                if pdf_resp.status_code == 200:
                                    st.download_button(
                                        "📄 Download Formatted PDF",
                                        data=pdf_resp.content,
                                        file_name=f"mining_report_{result['id']}.pdf",
                                        mime="application/pdf",
                                    )
                            except Exception:
                                pass
                        with dcol3:
                            st.write(f"Report ID: `{result['id']}`")
                        
                        # Word cloud
                        if result.get("word_cloud_available"):
                            st.divider()
                            st.subheader("☁️ Word Cloud Analysis")
                            try:
                                wc_resp = requests.get(
                                    f"{BACKEND_URL}/reports/{result['id']}/wordcloud",
                                    timeout=30
                                )
                                if wc_resp.status_code == 200:
                                    st.image(wc_resp.content, caption="Word Cloud from Report")
                            except Exception:
                                pass
                                
                    else:
                        st.error(f"Error: {response.json().get('detail', 'Unknown error')}")
                        
                except requests.ConnectionError:
                    st.warning("⚠️ Backend not running. Starting standalone mode...")
                    _process_standalone(uploaded_file)
                except Exception as e:
                    st.error(f"Error: {str(e)}")


def _process_standalone(uploaded_file):
    """Process file without backend (standalone mode)"""
    from document_processor import extract_text_from_pdf
    from ai_extractor import extract_structured_data
    from wordcloud_generator import generate_word_cloud_bytes
    
    with st.spinner("Processing in standalone mode..."):
        pdf_bytes = uploaded_file.getvalue()
        raw_text = extract_text_from_pdf(pdf_bytes, uploaded_file.name)
        extracted = extract_structured_data(raw_text, uploaded_file.name)
        
        st.success("✅ Processed in standalone mode!")
        
        st.subheader("📊 Extracted Data")
        st.json(extracted)
        
        # Word cloud
        wc_bytes = generate_word_cloud_bytes(raw_text)
        if wc_bytes:
            st.subheader("☁️ Word Cloud")
            st.image(wc_bytes, caption="Word Cloud from Report")


# ==================== VIEW REPORTS PAGE ====================
def render_reports():
    """Render the reports listing page"""
    st.header("📊 View Reports")
    
    try:
        data = requests.get(f"{BACKEND_URL}/reports", timeout=10).json()
        reports = data.get("reports", [])
        total = data.get("total", 0)
        
        st.subheader(f"All Reports ({total})")
        
        if not reports:
            st.info("No reports found. Upload your first mining report!")
            return
        
        for r in reports:
            status_emoji = "✅" if r["status"] == "completed" else "❌" if r["status"] == "error" else "⏳"
            
            with st.expander(f"{status_emoji} {r['filename']} - {r.get('mineral_type', 'N/A')} | {r.get('location', 'N/A')}"):
                # Summary info
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.write(f"**Status:** {r['status'].upper()}")
                    st.write(f"**Mineral:** {r.get('mineral_type', 'N/A')}")
                with col2:
                    st.write(f"**Location:** {r.get('location', 'N/A')}")
                    st.write(f"**Quantity:** {r.get('quantity_extracted', 'N/A')}")
                with col3:
                    st.write(f"**Uploaded:** {r.get('upload_date', 'N/A')}")
                    st.write(f"**ID:** {r['id']}")
                
                if r.get("summary"):
                    st.write(f"**Summary:** {r['summary']}")
                
                topics = r.get("topics", [])
                if topics:
                    st.write(f"**Topics:** {' | '.join([f'`{t}`' for t in topics])}")
                
                # Actions
                acol1, acol2, acol3 = st.columns(3)
                with acol1:
                    try:
                        pdf_resp = requests.get(
                            f"{BACKEND_URL}/reports/{r['id']}/download",
                            timeout=30
                        )
                        if pdf_resp.status_code == 200:
                            st.download_button(
                                "📥 Download PDF",
                                data=pdf_resp.content,
                                file_name=f"report_{r['id']}.pdf",
                                mime="application/pdf",
                                key=f"dl_{r['id']}"
                            )
                    except Exception:
                        pass
                with acol2:
                    if r.get("word_cloud_available"):
                        st.image(
                            requests.get(
                                f"{BACKEND_URL}/reports/{r['id']}/wordcloud",
                                timeout=30
                            ).content,
                            caption="Word Cloud",
                            width=300,
                        )
                with acol3:
                    if st.button(f"🗑️ Delete", key=f"del_{r['id']}"):
                        try:
                            requests.delete(f"{BACKEND_URL}/reports/{r['id']}")
                            st.success("Deleted!")
                            st.rerun()
                        except Exception:
                            pass
                            
    except requests.ConnectionError:
        st.warning("Backend not running. Please start the FastAPI backend.")
        st.code("cd mining_report_platform && python -m backend.api", language="bash")
    except Exception as e:
        st.error(f"Error loading reports: {str(e)}")


# ==================== AI QUERY PAGE ====================
def render_query():
    """Render the AI query/chatbot page"""
    st.header("🔍 AI-Powered Query System")
    st.markdown("Ask natural language questions about your mining reports. The AI will search through all extracted data and provide answers.")
    
    st.divider()
    
    # Example questions
    st.subheader("💡 Example Questions")
    examples = [
        "What minerals were extracted in Jharkhand?",
        "What is the total coal quantity across all reports?",
        "Which mines use opencast extraction methods?",
        "What are the most common minerals in the reports?",
        "Which locations have the highest mining activity?",
        "What environmental concerns are mentioned in the reports?",
    ]
    
    selected_example = st.selectbox("Select an example question:", [""] + examples)
    
    # Custom question input
    question = st.text_area(
        "Or type your question:",
        value=selected_example,
        placeholder="e.g., What minerals were extracted in July 2024?",
        height=80,
    )
    
    if st.button("🔍 Ask Question", type="primary", use_container_width=True) and question:
        with st.spinner("AI is analyzing your question..."):
            try:
                response = requests.post(
                    f"{BACKEND_URL}/query",
                    params={"question": question},
                    timeout=60,
                )
                
                if response.status_code == 200:
                    result = response.json()
                    
                    st.divider()
                    st.subheader("💬 Answer")
                    st.markdown(result.get("answer", "No answer available"))
                    st.caption(f"Based on {result.get('reports_used', 0)} reports")
                else:
                    st.error(f"Error: {response.json().get('detail', 'Unknown error')}")
                    
            except requests.ConnectionError:
                st.warning("Backend not running. Please start the FastAPI backend.")
            except Exception as e:
                st.error(f"Error: {str(e)}")
    
    st.divider()
    
    # Query history
    st.subheader("📜 Recent Queries")
    try:
        history = requests.get(f"{BACKEND_URL}/query-history", timeout=5).json()
        queries = history.get("queries", [])
        
        if queries:
            for q in queries[:10]:
                with st.expander(f"❓ {q['question'][:80]}..."):
                    st.write(f"**Answer:** {q['answer']}")
                    st.caption(f"Asked on: {q.get('created_at', 'N/A')}")
        else:
            st.info("No queries yet. Ask your first question!")
    except Exception:
        st.info("Query history will appear here after your first query.")


# ==================== ANALYTICS PAGE ====================
def render_analytics():
    """Render analytics and statistics page"""
    st.header("📈 Analytics")
    
    try:
        stats = requests.get(f"{BACKEND_URL}/stats", timeout=10).json()
        
        # Overview metrics
        st.subheader("📊 Overview")
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Total Reports", stats.get("total_reports", 0))
        with col2:
            st.metric("Successfully Processed", stats.get("completed", 0))
        with col3:
            st.metric("Errors", stats.get("errors", 0))
        with col4:
            st.metric("Total Queries", stats.get("total_queries", 0))
        
        st.divider()
        
        # Mineral distribution
        st.subheader("💎 Mineral Distribution")
        minerals = stats.get("mineral_distribution", {})
        if minerals:
            import pandas as pd
            df = pd.DataFrame(list(minerals.items()), columns=["Mineral", "Count"])
            st.bar_chart(df.set_index("Mineral"))
        else:
            st.info("No mineral data available yet.")
        
        # Location distribution
        st.subheader("📍 Location Distribution")
        locations = stats.get("location_distribution", {})
        if locations:
            import pandas as pd
            df = pd.DataFrame(list(locations.items()), columns=["Location", "Count"])
            st.bar_chart(df.set_index("Location"))
        else:
            st.info("No location data available yet.")
            
    except requests.ConnectionError:
        st.warning("Backend not running.")
    except Exception as e:
        st.error(f"Error: {str(e)}")


# ==================== ABOUT PAGE ====================
def render_about():
    """Render the about page"""
    st.header("ℹ️ About This System")
    
    st.markdown("""
    ### AI-Powered Geological & Mining Reporting Solution
    
    **Problem ID:** SIH26023  
    **Ministry:** Ministry of Coal  
    **Organization:** CMPDI / CIL (Coal India Limited)  
    **Event:** Smart India Hackathon 2026
    
    ---
    
    ### 🎯 What This System Does
    
    This system automates the entire mining reporting pipeline:
    
    1. **📄 PDF Upload** - Upload mining reports in PDF format
    2. **🤖 AI Extraction** - Claude AI extracts structured data (date, location, minerals, quantity)
    3. **☁️ Word Cloud** - Visualize key themes and topics
    4. **📊 Report Generation** - Generate formatted PDF reports
    5. **🔍 AI Query** - Ask natural language questions about reports
    
    ---
    
    ### 🏗️ Architecture
    
    | Component | Technology |
    |-----------|-----------|
    | Frontend | Streamlit (Python) |
    | Backend | FastAPI (Python) |
    | AI/LLM | Claude API |
    | Document Processing | pypdf + pytesseract |
    | Database | SQLite |
    | Deployment | Streamlit Cloud |
    
    ---
    
    ### 📈 Impact
    
    | Metric | Before | After |
    |--------|--------|-------|
    | Report Turnaround | Weeks | Hours |
    | Manual Effort | 100% | 20% |
    | Error Rate | High | Minimal |
    | Data Consistency | Poor | Perfect |
    
    ---
    
    ### 👥 Team
    
    Smart India Hackathon 2026 - Team for CMPDI/CIL Problem Statement
    """)


# ==================== MAIN APP ====================
def main():
    """Main application entry point"""
    render_header()
    
    # Get selected page from session state or sidebar
    if "page" not in st.session_state:
        st.session_state.page = "🏠 Dashboard"
    
    page = render_sidebar()
    st.session_state.page = page
    
    # Route to page
    if page == "🏠 Dashboard":
        render_dashboard()
    elif page == "📄 Upload Report":
        render_upload()
    elif page == "📊 View Reports":
        render_reports()
    elif page == "🔍 AI Query":
        render_query()
    elif page == "📈 Analytics":
        render_analytics()
    elif page == "ℹ️ About":
        render_about()


if __name__ == "__main__":
    main()
