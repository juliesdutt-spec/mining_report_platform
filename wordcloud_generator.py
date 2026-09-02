"""
Word Cloud & Topic Identification Module
SIH26023 - AI-Powered Geological & Mining Reporting Solution

Generates word clouds and visualizes topics from mining reports.
"""
import os
import io
import re
from collections import Counter

try:
    from wordcloud import WordCloud
    WORDCLOUD_AVAILABLE = True
except ImportError:
    WORDCLOUD_AVAILABLE = False

try:
    import matplotlib
    matplotlib.use("Agg")  # Non-interactive backend
    import matplotlib.pyplot as plt
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False


# Mining-specific stopwords
MINING_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "shall", "can", "this",
    "that", "these", "those", "it", "its", "not", "no", "nor", "also",
    "than", "then", "so", "very", "just", "about", "above", "after",
    "before", "between", "under", "during", "through", "here", "there",
    "where", "when", "how", "all", "each", "every", "both", "few", "more",
    "most", "other", "some", "such", "only", "own", "same", "too", "such",
    "into", "over", "any", "if", "their", "them", "they", "he", "she",
    "we", "you", "me", "my", "your", "his", "her", "our", "what", "which",
    "who", "whom", "while", "although", "though", "because", "since",
    "until", "unless", "whether", "however", "therefore", "thus",
    "hence", "otherwise", "meanwhile", "furthermore", "moreover",
    "report", "reports", "data", "table", "figure", "given", "mentioned",
    "above", "below", "following", "according", "ref", "etc", "ie",
    "viz", "per", "annexure", "annex", "sr", "sl", "page", "para",
    "section", "chapter", "note", "notes", "source", "prepared", "view",
    "based", "total", "year", "month", "day", "period", "date", "time",
}


def generate_word_cloud(text: str, output_path: str = None) -> str:
    """
    Generate a word cloud from text and save to file.
    Returns the path to the saved image.
    """
    if not WORDCLOUD_AVAILABLE or not text:
        return None
    
    try:
        # Clean and preprocess text
        clean_text = _preprocess_text(text)
        
        if not clean_text.strip():
            return None
        
        # Generate word cloud
        wc = WordCloud(
            width=800,
            height=400,
            background_color="white",
            max_words=100,
            colormap="viridis",
            stopwords=MINING_STOPWORDS,
            min_font_size=10,
            max_font_size=80,
            prefer_horizontal=0.7,
            relative_scaling=0.5,
        )
        
        wc.generate(clean_text)
        
        # Save to file
        if not output_path:
            output_path = os.path.join("reports", "wordcloud.png")
        
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else "reports", exist_ok=True)
        
        if MATPLOTLIB_AVAILABLE:
            fig, ax = plt.subplots(1, 1, figsize=(12, 6))
            ax.imshow(wc, interpolation="bilinear")
            ax.axis("off")
            ax.set_title("Mining Report - Word Cloud Analysis", fontsize=14, pad=10)
            plt.tight_layout()
            plt.savefig(output_path, dpi=150, bbox_inches="tight")
            plt.close(fig)
        else:
            wc.to_file(output_path)
        
        return output_path
        
    except Exception as e:
        print(f"Word cloud generation error: {e}")
        return None


def generate_word_cloud_bytes(text: str) -> bytes:
    """Generate word cloud and return as PNG bytes (for Streamlit display)"""
    if not WORDCLOUD_AVAILABLE or not text:
        return None
    
    try:
        clean_text = _preprocess_text(text)
        if not clean_text.strip():
            return None
        
        wc = WordCloud(
            width=800,
            height=400,
            background_color="white",
            max_words=100,
            colormap="viridis",
            stopwords=MINING_STOPWORDS,
            min_font_size=10,
            max_font_size=80,
            prefer_horizontal=0.7,
            relative_scaling=0.5,
        )
        
        wc.generate(clean_text)
        
        if MATPLOTLIB_AVAILABLE:
            fig, ax = plt.subplots(1, 1, figsize=(12, 6))
            ax.imshow(wc, interpolation="bilinear")
            ax.axis("off")
            ax.set_title("Mining Report - Word Cloud Analysis", fontsize=14, pad=10)
            plt.tight_layout()
            
            buf = io.BytesIO()
            plt.savefig(buf, format="png", dpi=150, bbox_inches="tight")
            plt.close(fig)
            buf.seek(0)
            return buf.getvalue()
        else:
            # Convert directly to bytes
            img = wc.to_image()
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            buf.seek(0)
            return buf.getvalue()
            
    except Exception as e:
        print(f"Word cloud bytes generation error: {e}")
        return None


def extract_topics(text: str, top_n: int = 10) -> list:
    """Extract key topics/themes from text using frequency analysis"""
    if not text:
        return []
    
    clean_text = _preprocess_text(text)
    words = re.findall(r"\b[a-zA-Z]{3,}\b", clean_text.lower())
    
    # Filter stopwords
    filtered_words = [w for w in words if w not in MINING_STOPWORDS and len(w) >= 3]
    
    # Get frequency distribution
    word_freq = Counter(filtered_words)
    
    # Get top topics
    topics = [word for word, count in word_freq.most_common(top_n)]
    
    return topics


def get_topic_distribution(text: str, top_n: int = 8) -> dict:
    """Get topic distribution as a dict of {topic: count}"""
    if not text:
        return {}
    
    clean_text = _preprocess_text(text)
    words = re.findall(r"\b[a-zA-Z]{3,}\b", clean_text.lower())
    filtered_words = [w for w in words if w not in MINING_STOPWORDS and len(w) >= 3]
    
    word_freq = Counter(filtered_words)
    return dict(word_freq.most_common(top_n))


def _preprocess_text(text: str) -> str:
    """Clean and preprocess text for word cloud generation"""
    if not text:
        return ""
    
    # Remove special characters but keep spaces
    text = re.sub(r"[^\w\s]", " ", text)
    
    # Remove numbers
    text = re.sub(r"\b\d+\b", "", text)
    
    # Remove extra whitespace
    text = re.sub(r"\s+", " ", text)
    
    return text
