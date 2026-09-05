"""
Startup Script for AI-Powered Geological & Mining Reporting System
SIH26023 - Ministry of Coal - CMPDI/CIL

Run this script to start both the FastAPI backend and Streamlit frontend.
"""
import os
import sys
import subprocess
import time
import signal

# Add to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

#: Import names, which are not always the distribution names on PyPI -
#: fpdf2 installs a module called "fpdf", and checking for "fpdf2" reported
#: it missing on every run and triggered a needless reinstall.
REQUIRED_MODULES = [
    "fastapi", "uvicorn", "pypdf", "sqlalchemy", "wordcloud", "fpdf",
]


def check_dependencies():
    """Install the backend requirements if anything is missing."""
    missing = []
    for module in REQUIRED_MODULES:
        try:
            __import__(module)
        except ImportError:
            missing.append(module)

    if missing:
        print(f"⚠️  Missing packages: {', '.join(missing)}")
        print("Installing required packages...")
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-r", 
            os.path.join(os.path.dirname(__file__), "requirements.txt")
        ])
    
    return True


def streamlit_available() -> bool:
    """
    Whether the legacy Streamlit UI can run.

    It is not part of the backend's requirements any more - the React frontend
    replaced it, and it added about a hundred megabytes to every deploy. This
    script still launches it when it happens to be installed rather than
    failing over a UI most runs do not want.
    """
    try:
        __import__("streamlit")
        return True
    except ImportError:
        return False


def start_backend():
    """Start the FastAPI backend"""
    print("🚀 Starting FastAPI backend on port 8000...")
    backend_path = os.path.join(os.path.dirname(__file__), "backend", "api.py")
    
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.api:app", 
         "--host", "0.0.0.0", "--port", "8000", "--reload"],
        cwd=os.path.dirname(__file__),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    
    return process


def start_frontend():
    """Start the Streamlit frontend"""
    print("🎨 Starting Streamlit frontend on port 8501...")
    app_path = os.path.join(os.path.dirname(__file__), "app.py")
    
    process = subprocess.Popen(
        [sys.executable, "-m", "streamlit", "run", app_path,
         "--server.port", "8501", "--server.headless", "true"],
        cwd=os.path.dirname(__file__),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    
    return process


def main():
    """Main entry point"""
    print("=" * 60)
    print("⛏️  AI-Powered Geological & Mining Reporting Solution")
    print("   Smart India Hackathon 2026 - Problem ID: SIH26023")
    print("   Ministry of Coal | CMPDI / CIL")
    print("=" * 60)
    print()
    
    # Check dependencies
    print("📦 Checking dependencies...")
    check_dependencies()
    print("✅ Dependencies OK")
    print()
    
    # Create sample PDF
    print("📄 Creating sample mining report...")
    try:
        # create_sample_pdf does its work at import time. A star-import is
        # illegal inside a function, which made this file a SyntaxError - it
        # could never run at all. A plain import has the same effect.
        import create_sample_pdf  # noqa: F401
    except Exception as e:
        print(f"Note: {e}")
    print()
    
    # Start services
    backend_proc = None
    frontend_proc = None
    
    try:
        backend_proc = start_backend()
        time.sleep(3)  # Wait for backend to start
        
        if streamlit_available():
            frontend_proc = start_frontend()
            time.sleep(2)
        
        print()
        print("=" * 60)
        print("✅ SYSTEM STARTED SUCCESSFULLY!")
        print()
        if frontend_proc:
            print("🌐 Streamlit UI:  http://localhost:8501")
        else:
            print("🌐 React frontend: cd frontend && npm run dev  ->  :5173")
            print("   (the legacy Streamlit UI is not installed; to use it:")
            print("    pip install -r requirements-streamlit.txt)")
        print("📡 Backend API: http://localhost:8000")
        print("📚 API Docs: http://localhost:8000/docs")
        print("=" * 60)
        print()
        print("Press Ctrl+C to stop all services")
        print()
        
        # Wait for processes
        while True:
            time.sleep(1)
            if backend_proc.poll() is not None:
                print("⚠️ Backend stopped unexpectedly")
                break
            if frontend_proc.poll() is not None:
                print("⚠️ Frontend stopped unexpectedly")
                break
                
    except KeyboardInterrupt:
        print("\n🛑 Stopping services...")
    finally:
        if backend_proc:
            backend_proc.terminate()
        if frontend_proc:
            frontend_proc.terminate()
        print("✅ All services stopped")


if __name__ == "__main__":
    main()
