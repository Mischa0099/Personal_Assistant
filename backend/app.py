from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import pickle
import os
import re
import random
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key-change-this-in-production')
CORS(app, resources={r"/api/*": {"origins": os.getenv('FRONTEND_URL', '*')}})

emotion_tokenizer = None
emotion_model = None


def load_emotion_model():
    global emotion_tokenizer, emotion_model
    if emotion_tokenizer is not None and emotion_model is not None:
        return

    print("Loading ML models...")
    try:
        emotion_model_name = "j-hartmann/emotion-english-distilroberta-base"
        emotion_tokenizer = AutoTokenizer.from_pretrained(emotion_model_name)
        emotion_model = AutoModelForSequenceClassification.from_pretrained(emotion_model_name)
        print("✅ ML models loaded!")
    except Exception as e:
        print(f"⚠️ Error loading ML models: {e}")
        emotion_tokenizer = None
        emotion_model = None

# Spotify & Google Calendar Setup
sp_oauth = SpotifyOAuth(
    client_id=os.getenv('SPOTIFY_CLIENT_ID'),
    client_secret=os.getenv('SPOTIFY_CLIENT_SECRET'),
    redirect_uri=os.getenv('SPOTIFY_REDIRECT_URI', 'http://localhost:5000/callback'),
    scope='user-library-read playlist-read-private user-top-read'
)

SCOPES = ['https://www.googleapis.com/auth/calendar']

def get_calendar_service():
    creds = None
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            credentials_path = os.getenv('GOOGLE_CALENDAR_CREDENTIALS', 'credentials.json')
            if not os.path.exists(credentials_path):
                raise RuntimeError('Google Calendar credentials are not configured for this deployment.')
            flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
            creds = flow.run_local_server(port=0)
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    return build('calendar', 'v3', credentials=creds)

# User profiles with conversation memory
user_profiles = {}
conversation_history = []

# Motivational quotes database
MOTIVATIONAL_QUOTES = {
    'medical': [
        "\"The good physician treats the disease; the great physician treats the patient who has the disease.\" - William Osler",
        "\"Medicine is a science of uncertainty and an art of probability.\" - William Osler",
        "\"The best way to find yourself is to lose yourself in the service of others.\" - Mahatma Gandhi",
        "\"Wherever the art of medicine is loved, there is also a love of humanity.\" - Hippocrates",
        "\"The greatest medicine of all is to teach people how not to need it.\" - Hippocrates"
    ],
    'motivated': [
        "\"Success is not final, failure is not fatal: it is the courage to continue that counts.\" - Winston Churchill",
        "\"The only way to do great work is to love what you do.\" - Steve Jobs",
        "\"Believe you can and you're halfway there.\" - Theodore Roosevelt",
        "\"Your limitation—it's only your imagination.\"",
        "\"Great things never come from comfort zones.\""
    ],
    'unmotivated': [
        "\"You don't have to be great to start, but you have to start to be great.\" - Zig Ziglar",
        "\"The secret of getting ahead is getting started.\" - Mark Twain",
        "\"A little progress each day adds up to big results.\"",
        "\"Don't watch the clock; do what it does. Keep going.\" - Sam Levenson",
        "\"You are capable of more than you know.\""
    ],
    'stressed': [
        "\"You must learn to let go. Release the stress. You were never in control anyway.\" - Steve Maraboli",
        "\"It's not the load that breaks you down, it's the way you carry it.\" - Lou Holtz",
        "\"Take a deep breath. It's just a bad day, not a bad life.\"",
        "\"Sometimes the most productive thing you can do is relax.\" - Mark Black",
        "\"Stress is caused by being 'here' but wanting to be 'there'.\" - Eckhart Tolle"
    ],
    'general': [
        "\"Education is the most powerful weapon which you can use to change the world.\" - Nelson Mandela",
        "\"The beautiful thing about learning is that no one can take it away from you.\" - B.B. King",
        "\"Study while others are sleeping; work while others are loafing.\" - William A. Ward",
        "\"Intelligence plus character—that is the goal of true education.\" - Martin Luther King Jr."
    ]
}

# Research databases by field
RESEARCH_DATABASES = {
    'medical': {
        'papers': ['https://pubmed.ncbi.nlm.nih.gov/', 'https://www.nejm.org/', 'https://jamanetwork.com/'],
        'books': ['https://www.ncbi.nlm.nih.gov/books/', 'https://www.medicalbooksforall.com/'],
        'general': ['https://scholar.google.com/', 'https://www.researchgate.net/']
    },
    'psychology': {
        'papers': ['https://psycnet.apa.org/', 'https://www.frontiersin.org/journals/psychology', 'https://pubmed.ncbi.nlm.nih.gov/'],
        'books': ['https://www.apa.org/pubs/books', 'https://scholar.google.com/'],
        'general': ['https://www.psychologytoday.com/', 'https://www.simplypsychology.org/']
    },
    'biology': {
        'papers': ['https://pubmed.ncbi.nlm.nih.gov/', 'https://www.nature.com/subjects/biological-sciences'],
        'books': ['https://www.ncbi.nlm.nih.gov/books/'],
        'general': ['https://scholar.google.com/', 'https://www.biorxiv.org/']
    },
    'chemistry': {
        'papers': ['https://pubs.acs.org/', 'https://www.rsc.org/journals-books-databases/'],
        'books': ['https://scholar.google.com/'],
        'general': ['https://pubchem.ncbi.nlm.nih.gov/']
    },
    'physics': {
        'papers': ['https://arxiv.org/list/physics/recent', 'https://journals.aps.org/'],
        'books': ['https://scholar.google.com/'],
        'general': ['https://www.nature.com/subjects/physics']
    },
    'computer_science': {
        'papers': ['https://arxiv.org/list/cs/recent', 'https://ieeexplore.ieee.org/'],
        'books': ['https://github.com/', 'https://www.oreilly.com/'],
        'general': ['https://scholar.google.com/', 'https://paperswithcode.com/']
    },
    'history': {
        'papers': ['https://www.jstor.org/', 'https://www.historians.org/'],
        'books': ['https://www.gutenberg.org/', 'https://archive.org/'],
        'general': ['https://scholar.google.com/']
    },
    'mathematics': {
        'papers': ['https://arxiv.org/list/math/recent', 'https://mathscinet.ams.org/'],
        'books': ['https://scholar.google.com/'],
        'general': ['https://www.wolframalpha.com/']
    },
    'default': {
        'papers': ['https://scholar.google.com/', 'https://www.researchgate.net/', 'https://arxiv.org/'],
        'books': ['https://www.googlebooks.com/', 'https://archive.org/'],
        'general': ['https://scholar.google.com/']
    }
}

def get_motivational_quote(category='general'):
    """Get a random motivational quote"""
    quotes = MOTIVATIONAL_QUOTES.get(category, MOTIVATIONAL_QUOTES['general'])
    return random.choice(quotes)

def analyze_emotion_advanced(text):
    """Advanced emotion analysis with a lightweight fallback."""
    load_emotion_model()
    if emotion_model is None or emotion_tokenizer is None:
        return {
            'anger': 0.05,
            'disgust': 0.03,
            'fear': 0.05,
            'joy': 0.25,
            'neutral': 0.45,
            'sadness': 0.10,
            'surprise': 0.07
        }

    inputs = emotion_tokenizer(text, return_tensors="pt", truncation=True, max_length=512)

    with torch.no_grad():
        outputs = emotion_model(**inputs)
        probs = torch.nn.functional.softmax(outputs.logits, dim=-1)

    emotions = ['anger', 'disgust', 'fear', 'joy', 'neutral', 'sadness', 'surprise']
    emotion_scores = {emotions[i]: float(probs[0][i]) for i in range(len(emotions))}

    return emotion_scores

def extract_comprehensive_context(text):
    """Extract detailed context including ANY subject and research intent"""
    context = {
        'subjects': [],
        'education_level': None,
        'current_task': None,
        'urgency': 'normal',
        'research_intent': False,
        'research_topic': None,
        'career_field': None
    }
    
    # Education level detection
    education_patterns = {
        'elementary': r'\b(1st|2nd|3rd|4th|5th|elementary|primary)\s*(class|grade|standard)',
        'middle': r'\b(6th|7th|8th|middle school)\s*(class|grade)',
        'high': r'\b(9th|10th|11th|12th|high school|secondary)\s*(class|grade)',
        'undergrad': r'\b(1st year|2nd year|3rd year|4th year|undergraduate|college|university|btech|bsc|ba|bachelor)',
        'graduate': r'\b(masters|phd|graduate|mtech|msc|ma|doctorate|postgraduate)',
        'professional': r'\b(doctor|physician|engineer|scientist|researcher|professor|medical student|residency)',
        'research': r'\b(phd student|doctoral|postdoc|research scholar)'
    }
    
    for level, pattern in education_patterns.items():
        if re.search(pattern, text.lower()):
            context['education_level'] = level
            break
    
    # Career/Professional field detection
    career_patterns = {
        'medical': r'\b(medical student|medicine|doctor|physician|mbbs|md|surgeon|healthcare)\b',
        'engineering': r'\b(engineer|engineering|btech|mtech)\b',
        'science': r'\b(scientist|researcher|phd|research)\b',
        'teaching': r'\b(teacher|professor|educator)\b'
    }
    
    for field, pattern in career_patterns.items():
        if re.search(pattern, text.lower()):
            context['career_field'] = field
            break
    
    # Dynamic subject extraction - matches ANY word after "study/learn/research"
    subject_trigger_patterns = [
        r'(?:study|studying|learn|learning|research|researching|working on|interested in|major in|specializing in)\s+([a-zA-Z\s]+?)(?:\s+(?:today|now|currently|chapter|topic|subject|course)|[,.]|$)',
        r'(?:want to study|need to study|have to study|planning to study)\s+([a-zA-Z\s]+?)(?:\s+(?:today|now|currently)|[,.]|$)',
        r'(?:i\'m|im|i am)\s+(?:a|an)?\s*([a-zA-Z\s]+?)\s+(?:student|major|scholar)',
    ]
    
    for pattern in subject_trigger_patterns:
        matches = re.findall(pattern, text.lower())
        for match in matches:
            subject = match.strip()
            # Clean up common words
            subject = re.sub(r'\b(a|an|the|and|or|for|to|in|on|at|my|your)\b', '', subject).strip()
            if len(subject) > 2 and subject not in ['it', 'is', 'am', 'be']:
                context['subjects'].append(subject)
    
    # Research intent detection
    if re.search(r'\b(research|paper|publication|thesis|dissertation|literature review|study on)\b', text.lower()):
        context['research_intent'] = True
        # Extract research topic
        research_patterns = [
            r'research (?:on|about|in|into)\s+([a-zA-Z\s]+?)(?:[,.]|$)',
            r'(?:paper|thesis|dissertation) on\s+([a-zA-Z\s]+?)(?:[,.]|$)',
            r'studying\s+([a-zA-Z\s]+?)\s+research'
        ]
        for pattern in research_patterns:
            matches = re.findall(pattern, text.lower())
            if matches:
                context['research_topic'] = matches[0].strip()
                break
    
    # Task extraction
    task_patterns = [
        r'(?:need to|have to|must|going to)\s+(.+?)(?:\.|,|$)',
        r'(?:want to|planning to)\s+(.+?)(?:\.|,|$)',
    ]
    
    for pattern in task_patterns:
        matches = re.findall(pattern, text.lower())
        if matches:
            context['current_task'] = matches[0].strip()
            break
    
    return context

@app.route('/health')
def health():
    return jsonify({'status': 'ok'})


@app.route('/api/analyze-chat', methods=['POST'])
def analyze_chat():
    """Comprehensive chat analysis with adaptive responses"""
    data = request.json
    message = data.get('message', '')
    user_id = data.get('user_id', 'default_user')
    
    if not message:
        return jsonify({'error': 'No message provided'}), 400
    
    conversation_history.append(message)
    recent_context = ' '.join(conversation_history[-5:])
    
    # Emotion analysis
    emotion_scores = analyze_emotion_advanced(recent_context)
    dominant_emotion = max(emotion_scores, key=emotion_scores.get)
    confidence = emotion_scores[dominant_emotion]
    
    # Map to mood
    emotion_to_mood = {
        'joy': 'motivated',
        'sadness': 'unmotivated',
        'anger': 'frustrated',
        'fear': 'anxious',
        'surprise': 'curious',
        'disgust': 'overwhelmed',
        'neutral': 'calm'
    }
    
    detected_mood = emotion_to_mood.get(dominant_emotion, 'neutral')
    
    # Override with keyword detection
    if re.search(r'\b(not motivated|unmotivated|no motivation|don\'t feel like|can\'t focus)\b', message.lower()):
        detected_mood = 'unmotivated'
        confidence = 0.9
    elif re.search(r'\b(stressed|overwhelmed|too much|anxiety|pressure)\b', message.lower()):
        detected_mood = 'stressed'
        confidence = 0.85
    elif re.search(r'\b(tired|exhausted|drained|sleepy|fatigue)\b', message.lower()):
        detected_mood = 'tired'
        confidence = 0.85
    elif re.search(r'\b(excited|motivated|ready|let\'s go|pumped)\b', message.lower()):
        detected_mood = 'motivated'
        confidence = 0.85
    
    # Extract context
    context = extract_comprehensive_context(message)
    
    # Initialize or update user profile
    if user_id not in user_profiles:
        user_profiles[user_id] = {
            'subjects': set(),
            'education_level': None,
            'career_field': None,
            'interests': set(),
            'history': []
        }
    
    profile = user_profiles[user_id]
    profile['subjects'].update(context['subjects'])
    if context['education_level']:
        profile['education_level'] = context['education_level']
    if context['career_field']:
        profile['career_field'] = context['career_field']
    
    profile['history'].append({
        'message': message,
        'mood': detected_mood,
        'timestamp': datetime.now().isoformat()
    })
    
    # Get motivational quote
    quote_category = profile.get('career_field', detected_mood)
    motivational_quote = get_motivational_quote(quote_category)
    
    # Check if we need to ask for education level
    needs_education_info = (
        len(context['subjects']) > 0 and 
        not context['education_level'] and 
        not profile['education_level']
    )
    
    # Check if research support needed
    needs_research_support = context['research_intent']
    
    return jsonify({
        'mood': detected_mood,
        'emotion': dominant_emotion,
        'confidence': float(confidence),
        'context': context,
        'user_profile': {
            'subjects': list(profile['subjects']),
            'education_level': profile['education_level'],
            'career_field': profile['career_field']
        },
        'motivational_quote': motivational_quote,
        'needs_education_info': needs_education_info,
        'needs_research_support': needs_research_support,
        'all_emotions': emotion_scores
    })

@app.route('/api/research-resources', methods=['POST'])
def get_research_resources():
    """Get research resources for a specific topic"""
    data = request.json
    topic = data.get('topic', '').lower()
    
    # Map topic to database category
    category = 'default'
    for key in RESEARCH_DATABASES.keys():
        if key in topic or topic in key:
            category = key
            break
    
    resources = RESEARCH_DATABASES.get(category, RESEARCH_DATABASES['default'])
    
    return jsonify({
        'category': category,
        'topic': topic,
        'resources': resources
    })

@app.route('/api/music-recommendations', methods=['POST'])
def get_music_recommendations():
    """Mood and task-specific music"""
    data = request.json
    mood = data.get('mood', 'neutral')
    context = data.get('context', {})
    
    try:
        token_info = sp_oauth.get_cached_token()
        if not token_info:
            return jsonify({
                'error': 'Spotify not authenticated', 
                'auth_url': sp_oauth.get_authorize_url()
            }), 401
        
        sp = spotipy.Spotify(auth=token_info['access_token'])
        
        # Build smart queries
        search_queries = []
        
        if mood == 'unmotivated':
            search_queries = ['study motivation focus', 'deep concentration', 'productivity boost']
        elif mood == 'stressed':
            search_queries = ['stress relief calm', 'peaceful study', 'relaxation focus']
        elif mood == 'tired':
            search_queries = ['lofi study chill', 'gentle focus', 'coffee shop ambience']
        elif mood == 'motivated':
            search_queries = ['deep focus flow', 'brain power study', 'intense concentration']
        else:
            search_queries = ['study music', 'focus concentration', 'productive work']
        
        playlists = []
        for query in search_queries[:2]:
            try:
                results = sp.search(q=query, type='playlist', limit=3)
                for playlist in results['playlists']['items']:
                    playlists.append({
                        'id': playlist['id'],
                        'name': playlist['name'],
                        'description': playlist['description'],
                        'url': playlist['external_urls']['spotify'],
                        'image': playlist['images'][0]['url'] if playlist['images'] else None,
                        'tracks': playlist['tracks']['total']
                    })
            except:
                continue
        
        return jsonify({'playlists': playlists[:6]})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/video-recommendations', methods=['POST'])
def get_video_recommendations():
    """Adaptive video recommendations for ANY subject"""
    data = request.json
    context = data.get('context', {})
    user_profile = data.get('user_profile', {})
    video_type = data.get('video_type', 'educational')
    
    youtube_api_key = os.getenv('YOUTUBE_API_KEY')
    if not youtube_api_key:
        return jsonify({'error': 'YouTube API not configured'}), 500
    
    try:
        youtube = build('youtube', 'v3', developerKey=youtube_api_key)
        
        queries = []
        subjects = context.get('subjects', [])
        education_level = user_profile.get('education_level')
        
        # Build level-specific queries for ANY subject
        for subject in subjects[:3]:
            if video_type == 'educational':
                if education_level == 'elementary':
                    queries.append(f'{subject} for kids easy learning fun')
                elif education_level == 'middle':
                    queries.append(f'{subject} middle school basics explained')
                elif education_level == 'high':
                    queries.append(f'{subject} high school complete tutorial')
                elif education_level == 'undergrad':
                    queries.append(f'{subject} university lecture undergraduate course')
                elif education_level in ['graduate', 'research']:
                    queries.append(f'{subject} advanced graduate level lecture')
                elif education_level == 'professional':
                    queries.append(f'{subject} professional advanced masterclass')
                else:
                    queries.append(f'{subject} complete tutorial explained')
            
            elif video_type == 'motivational':
                queries.append(f'{subject} study motivation tips success')
            
            elif video_type == 'tedtalks':
                queries.append(f'TED talk {subject} education science')
        
        # Fallback queries
        if not queries:
            queries = ['study tips motivation', 'learning techniques', 'focus concentration']
        
        all_videos = []
        
        for query in queries[:4]:
            try:
                search_response = youtube.search().list(
                    q=query,
                    part='snippet',
                    maxResults=5,
                    type='video',
                    videoDuration='medium',
                    relevanceLanguage='en',
                    safeSearch='strict'
                ).execute()
                
                for item in search_response['items']:
                    video_id = item['id']['videoId']
                    
                    try:
                        video_details = youtube.videos().list(
                            part='statistics,contentDetails',
                            id=video_id
                        ).execute()
                        
                        if video_details['items']:
                            stats = video_details['items'][0]['statistics']
                            duration = video_details['items'][0]['contentDetails']['duration']
                            
                            all_videos.append({
                                'id': video_id,
                                'title': item['snippet']['title'],
                                'description': item['snippet']['description'][:200],
                                'thumbnail': item['snippet']['thumbnails']['high']['url'],
                                'channel': item['snippet']['channelTitle'],
                                'views': stats.get('viewCount', '0'),
                                'likes': stats.get('likeCount', '0'),
                                'duration': duration,
                                'url': f"https://www.youtube.com/watch?v={video_id}"
                            })
                    except:
                        continue
            except:
                continue
        
        return jsonify({'videos': all_videos[:20]})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/add-task', methods=['POST'])
def add_task():
    """Add task with Pomodoro to Google Calendar"""
    data = request.json
    task_name = data.get('task_name', '')
    start_time = data.get('start_time')
    duration = data.get('duration', 25)
    pomodoro_enabled = data.get('pomodoro', True)
    
    if not task_name:
        return jsonify({'error': 'Task name required'}), 400
    
    try:
        service = get_calendar_service()
        
        if start_time:
            start = datetime.fromisoformat(start_time)
        else:
            start = datetime.now() + timedelta(minutes=5)
        
        end = start + timedelta(minutes=duration)
        
        description = 'Added by AI Life Navigator'
        if pomodoro_enabled:
            description += f'\n🍅 Pomodoro: {duration} min focus session'
        
        event = {
            'summary': f'🎯 {task_name}',
            'description': description,
            'start': {'dateTime': start.isoformat(), 'timeZone': 'UTC'},
            'end': {'dateTime': end.isoformat(), 'timeZone': 'UTC'},
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'popup', 'minutes': 5},
                    {'method': 'popup', 'minutes': 0},
                ],
            },
        }
        
        event_result = service.events().insert(calendarId='primary', body=event).execute()
        
        return jsonify({
            'success': True,
            'event_id': event_result['id'],
            'link': event_result['htmlLink'],
            'pomodoro': pomodoro_enabled
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/callback')
def spotify_callback():
    code = request.args.get('code')
    if code:
        sp_oauth.get_access_token(code)
        return """<html><body style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
        color: white; font-family: Arial; text-align: center; padding: 50px;">
        <h1>✅ Spotify Connected!</h1><p>Close this window.</p></body></html>"""
    return "Authentication failed", 400

if __name__ == '__main__':
    print("=" * 70)
    print("🚀 AI Life Navigator - FULLY ADAPTIVE MODE")
    print("=" * 70)
    print("✅ Dynamic subject recognition (ANY subject)")
    print("✅ Education-level adaptive content")
    print("✅ Research paper/book recommendations")
    print("✅ Motivational quotes system")
    print("=" * 70)
    app.run(debug=False, port=int(os.getenv('PORT', 5000)), host='0.0.0.0')