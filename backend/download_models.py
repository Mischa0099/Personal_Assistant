from transformers import pipeline
import nltk

# Download sentiment analysis model (BERT-based)
print("Downloading sentiment analysis model...")
sentiment_analyzer = pipeline("sentiment-analysis", model="nlptown/bert-base-multilingual-uncased-sentiment")

# Download emotion detection model
print("Downloading emotion detection model...")
emotion_analyzer = pipeline("text-classification", model="j-hartmann/emotion-english-distilroberta-base", top_k=None)

# Download NLTK data
print("Downloading NLTK data...")
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('vader_lexicon')

print("All models downloaded successfully!")