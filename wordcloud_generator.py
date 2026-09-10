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


# Indic vowel signs, viramas and nuktas are Unicode categories Mn/Mc, and `\w`
# matches neither - it is letters, digits and underscore only. So a scrub of
# `[^\w\s]` deletes every matra in the text: "रिपोर्ट उत्पादन कोयला" comes out
# as "र प र ट उत प दन क यल", words shattered into bare consonants. Nothing
# raises; the topics list just comes back empty or meaningless.
#
# Telugu is listed alongside Devanagari because it is the next script asked
# for, and leaving it out would reintroduce exactly this bug.
_COMBINING_MARKS = (
    "\u0300-\u036F"                                        # generic diacritics
    "\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962-\u0963"  # Devanagari
    "\u0C00-\u0C04\u0C3E-\u0C56\u0C62-\u0C63"              # Telugu
)

# A word is a letter followed by letters, digits or combining marks. Anchoring
# on a letter keeps bare numerals out without a separate strip pass.
_WORD_RE = re.compile(rf"[^\W\d_][\w{_COMBINING_MARKS}]*")

# WordCloud tokenises the text again itself, with its own default of
# `\w[\w']+` - which drops matras exactly as our old pattern did, shattering
# "कोयला" into "क" and "यल" in the rendered image even though the topic list
# beside it was correct. It has to be given the same Unicode-aware pattern.
_WORDCLOUD_REGEXP = rf"[^\W\d_][\w'{_COMBINING_MARKS}]+"
_NON_WORD_RE = re.compile(rf"[^\w\s{_COMBINING_MARKS}]")

# Devanagari occupies U+0900-U+097F; the presence of any of it decides which
# font the cloud is drawn with.
_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")

_FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "fonts")
_DEVANAGARI_FONT = os.path.join(_FONT_DIR, "NotoSansDevanagari-Regular.ttf")


def _font_for(text: str):
    """
    The font to draw this cloud with, or None to keep the library default.

    Only Hindi text switches font. Noto Sans Devanagari covers Latin too, so a
    mixed English/Hindi document renders in one face; an English-only document
    is left looking exactly as it did.
    """
    if _DEVANAGARI_RE.search(text or "") and os.path.exists(_DEVANAGARI_FONT):
        return _DEVANAGARI_FONT
    return None


def _stopwords() -> set:
    """Every stopword, in one place - the filters and the cloud must agree."""
    return MINING_STOPWORDS | HINDI_STOPWORDS


def _tokenise(text: str) -> list:
    """Words of three characters or more, in any script."""
    return [w for w in _WORD_RE.findall(_preprocess_text(text).lower()) if len(w) >= 3]


# The Hindi function words that would otherwise dominate every cloud, the way
# "the" and "of" do in English.
HINDI_STOPWORDS = {
    "का", "के", "की", "को", "में", "से", "है", "हैं", "था", "थे", "थी",
    "और", "या", "पर", "यह", "वह", "इस", "उस", "एक", "तथा", "कि", "तो",
    "ही", "भी", "ने", "हुआ", "हुई", "हुए", "गया", "गई", "गए", "किया",
    "करने", "करना", "लिए", "द्वारा", "साथ", "अपने", "सभी", "कुछ", "जो",
    "जब", "तक", "नहीं", "रहा", "रही", "रहे", "होता", "होती", "होने",
    "बाद", "आदि", "अन्य", "इसके", "उनके", "वाले", "वाली", "गयी",
}

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
            font_path=_font_for(text),
            regexp=_WORDCLOUD_REGEXP,
            width=800,
            height=400,
            background_color="white",
            max_words=100,
            colormap="viridis",
            stopwords=_stopwords(),
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
            font_path=_font_for(text),
            regexp=_WORDCLOUD_REGEXP,
            width=800,
            height=400,
            background_color="white",
            max_words=100,
            colormap="viridis",
            stopwords=_stopwords(),
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
    
    words = _tokenise(text)
    filtered_words = [w for w in words if w not in _stopwords()]
    
    # Get frequency distribution
    word_freq = Counter(filtered_words)
    
    # Get top topics
    topics = [word for word, count in word_freq.most_common(top_n)]
    
    return topics


def get_topic_distribution(text: str, top_n: int = 8) -> dict:
    """Get topic distribution as a dict of {topic: count}"""
    if not text:
        return {}
    
    words = _tokenise(text)
    filtered_words = [w for w in words if w not in _stopwords()]
    
    word_freq = Counter(filtered_words)
    return dict(word_freq.most_common(top_n))


def _preprocess_text(text: str) -> str:
    """Clean and preprocess text for word cloud generation"""
    if not text:
        return ""
    
    # Keep combining marks: stripping them dismembers every Indic word.
    text = _NON_WORD_RE.sub(" ", text)
    
    # Remove numbers
    text = re.sub(r"\b\d+\b", "", text)
    
    # Remove extra whitespace
    text = re.sub(r"\s+", " ", text)
    
    return text
