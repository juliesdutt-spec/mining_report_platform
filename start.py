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

def check_dependencies():
    """Check if all required packages are installed"""
    required = [
        "fastapi", "uvicorn", "streamlit", "pypdf", 
        "anthropic", "sqlalchemy", "wordcloud", "fpdf2"
    ]
    
    missing = []
    for package in required:
        try:
            __import__(package)
        except ImportError:
            missing.append(package)
    
    if missing:
        print(f"⚠️  Missing packages: {', '.join(missing)}")
        print("Installing required packages...")
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-r", 
            os.path.join(os.path.dirname(__file__), "requirements.txt")
        ])
    
    return True


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
        from create_sample_pdf import *
    except Exception as e:
        print(f"Note: {e}")
    print()
    
    # Start services
    backend_proc = None
    frontend_proc = None
    
    try:
        backend_proc = start_backend()
        time.sleep(3)  # Wait for backend to start
        
        frontend_proc = start_frontend()
        time.sleep(2)
        
        print()
        print("=" * 60)
        print("✅ SYSTEM STARTED SUCCESSFULLY!")
        print()
        print("🌐 Frontend: http://localhost:8501")
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
