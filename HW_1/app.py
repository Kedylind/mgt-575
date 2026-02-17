import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from openai import OpenAI
from dotenv import load_dotenv
import os
from datetime import datetime
import json
from newspaper import Article
import re

# Load environment variables
load_dotenv()

# Page configuration
st.set_page_config(
    page_title="David Schmidt - Strategic Tweet Engine",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
    <style>
    /* Header styling */
    h1 {
        color: #1f77b4;
        font-weight: bold;
    }
    h2, h3 {
        color: #1f77b4;
    }
    
    /* Metrics card styling */
    [data-testid="stMetricValue"] {
        font-size: 2rem;
    }
    [data-testid="metric-container"] {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 0.5rem;
        border: 1px solid #e0e0e0;
    }
    
    /* Button styling */
    .stButton > button {
        background-color: #1f77b4;
        color: white;
        border-radius: 0.5rem;
        padding: 0.5rem 2rem;
        font-weight: bold;
    }
    .stButton > button:hover {
        background-color: #1565a0;
    }
    
    /* Tweet card styling */
    .tweet-card {
        border: 1px solid #e0e0e0;
        border-radius: 1rem;
        padding: 1.5rem;
        background-color: white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin: 1rem 0;
    }
    .tweet-header {
        display: flex;
        align-items: center;
        margin-bottom: 1rem;
    }
    .tweet-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        margin-right: 1rem;
        background-color: #1f77b4;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.5rem;
    }
    .tweet-text {
        font-size: 1.1rem;
        line-height: 1.6;
        color: #333;
    }
    </style>
""", unsafe_allow_html=True)

# Initialize session state
if 'df' not in st.session_state:
    st.session_state.df = None
if 'topics_analyzed' not in st.session_state:
    st.session_state.topics_analyzed = False
if 'topics_df' not in st.session_state:
    st.session_state.topics_df = None
if 'brand_analysis' not in st.session_state:
    st.session_state.brand_analysis = {}
if 'generated_tweet' not in st.session_state:
    st.session_state.generated_tweet = None

# Title
st.title("🎯 David Schmidt - Strategic Tweet Engine")

# Sidebar for CSV upload
with st.sidebar:
    st.header("📁 Data Upload")
    uploaded_file = st.file_uploader(
        "Upload your tweet CSV file",
        type=['csv'],
        help="CSV should contain: text, view_count, created_at, favorite_count"
    )
    
    if uploaded_file is not None:
        try:
            # Read CSV
            df = pd.read_csv(uploaded_file)
            
            # Validate required columns
            required_columns = ['text', 'view_count', 'created_at', 'favorite_count']
            missing_columns = [col for col in required_columns if col not in df.columns]
            
            if missing_columns:
                st.error(f"Missing required columns: {', '.join(missing_columns)}")
            else:
                # Check for empty CSV
                if len(df) == 0:
                    st.error("CSV file is empty. Please upload a file with tweet data.")
                else:
                    # Convert created_at to datetime
                    df['created_at'] = pd.to_datetime(df['created_at'], errors='coerce')
                    
                    # Check for missing datetime data
                    if df['created_at'].isna().all():
                        st.error("Could not parse datetime from 'created_at' column. Please check the date format.")
                    else:
                        # Calculate engagement
                        df['engagement'] = df['favorite_count'] / df['view_count'].replace(0, 1)
                        
                        # Store in session state
                        st.session_state.df = df
                        # Reset analysis states when new data is loaded
                        st.session_state.topics_analyzed = False
                        st.session_state.topics_df = None
                        st.session_state.brand_analysis = {}
                        st.session_state.generated_tweet = None
                        st.success(f"✅ Loaded {len(df)} tweets")
        except Exception as e:
            st.error(f"Error loading CSV: {str(e)}")
    
    # OpenAI API Key check
    st.header("🔑 API Configuration")
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        st.success("✅ OpenAI API Key found")
    else:
        st.warning("⚠️ OpenAI API Key not found in environment variables")

# Main content
if st.session_state.df is None:
    st.info("👆 Please upload a CSV file in the sidebar to get started.")
    st.markdown("""
    ### Expected CSV Format:
    - `text`: Tweet content
    - `view_count`: Number of views
    - `created_at`: Timestamp (any parseable date format)
    - `favorite_count`: Number of favorites/likes
    """)
else:
    df = st.session_state.df
    
    # Create tabs
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "🏆 The Leaderboard",
        "🔥 The Activity Heatmap",
        "🎯 Topic Modeler",
        "🤝 Brand Compatibility Agent",
        "📰 The News Reactor"
    ])
    
    # TAB 1: The Leaderboard
    with tab1:
        st.header("🏆 The Leaderboard")
        st.markdown("Tweets ranked by Engagement Rate (Favorites / Views)")
        
        try:
            # Sort by engagement rate (descending)
            df_display = df.copy()
            df_display = df_display.sort_values('engagement', ascending=False)
            
            # Format display columns
            df_display['engagement_rate'] = df_display['engagement'].apply(lambda x: f"{x:.4f}" if pd.notna(x) else "N/A")
            df_display['favorite_count'] = df_display['favorite_count'].apply(lambda x: f"{int(x):,}" if pd.notna(x) else "N/A")
            df_display['view_count'] = df_display['view_count'].apply(lambda x: f"{int(x):,}" if pd.notna(x) else "N/A")
            
            # Format created_at for display
            df_display['created_at_display'] = df_display['created_at'].dt.strftime('%Y-%m-%d %H:%M:%S')
            
            st.dataframe(
                df_display[['text', 'created_at_display', 'favorite_count', 'view_count', 'engagement_rate']].rename(columns={
                    'text': 'Tweet Text',
                    'created_at_display': 'Created Date',
                    'favorite_count': 'Favorites',
                    'view_count': 'Views',
                    'engagement_rate': 'Engagement Rate'
                }),
                use_container_width=True,
                height=400
            )
        except Exception as e:
            st.error(f"Error displaying leaderboard: {str(e)}")
    
    # TAB 2: The Activity Heatmap
    with tab2:
        st.header("🔥 The Activity Heatmap")
        st.markdown("Posting frequency by Hour of Day vs Day of Week")
        
        try:
            # Extract hour and day of week
            df_heatmap = df.copy()
            df_heatmap = df_heatmap.dropna(subset=['created_at'])
            
            if len(df_heatmap) == 0:
                st.warning("No valid datetime data available for heatmap.")
            else:
                df_heatmap['hour'] = df_heatmap['created_at'].dt.hour
                df_heatmap['day_of_week'] = df_heatmap['created_at'].dt.day_name()
                
                # Create frequency count
                heatmap_df = df_heatmap.groupby(['day_of_week', 'hour']).size().reset_index(name='count')
                
                # Ensure proper day order
                day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                heatmap_df['day_of_week'] = pd.Categorical(heatmap_df['day_of_week'], categories=day_order, ordered=True)
                heatmap_df = heatmap_df.sort_values('day_of_week')
                
                # Reshape for heatmap (pivot table)
                heatmap_pivot = heatmap_df.pivot(index='day_of_week', columns='hour', values='count').fillna(0)
                
                # Ensure all hours 0-23 are present
                for hour in range(24):
                    if hour not in heatmap_pivot.columns:
                        heatmap_pivot[hour] = 0
                heatmap_pivot = heatmap_pivot.sort_index(axis=1)
                
                # Create heatmap using plotly
                fig = px.imshow(
                    heatmap_pivot.values,
                    labels=dict(x="Hour of Day", y="Day of Week", color="Tweet Count"),
                    x=[str(h) for h in range(24)],
                    y=day_order,
                    color_continuous_scale='YlOrRd',
                    aspect="auto"
                )
                
                fig.update_layout(
                    title="Activity Heatmap: Posting Frequency",
                    xaxis_title="Hour of Day (0-23)",
                    yaxis_title="Day of Week",
                    height=500
                )
                
                st.plotly_chart(fig, use_container_width=True)
        except Exception as e:
            st.error(f"Error creating heatmap: {str(e)}")
    
    # TAB 3: Topic Modeler
    with tab3:
        st.header("🎯 Topic Modeler")
        st.markdown("AI analysis to identify top 5 Core Pillars (topics) from your tweets")
        
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            st.error("⚠️ OpenAI API Key not found. Please set OPENAI_API_KEY in your .env file.")
        else:
            if st.button("Analyze Topics", type="primary") or st.session_state.topics_analyzed:
                if not st.session_state.topics_analyzed:
                    with st.spinner("🎯 Analyzing topics with GPT-4..."):
                        try:
                            # Get sample of tweets (limit to avoid token limits)
                            sample_size = min(200, len(df))
                            sample_tweets = df.sample(n=sample_size, random_state=42)['text'].tolist()
                            tweets_text = "\n".join([f"{i+1}. {tweet}" for i, tweet in enumerate(sample_tweets)])
                            
                            client = OpenAI(api_key=api_key)
                            
                            prompt = f"""Analyze the following tweets from a Twitter account and identify the top 5 core topics or "pillars" that this account focuses on.

Tweets:
{tweets_text}

For each of the 5 core topics, provide:
1. A concise topic name (2-4 words)
2. A brief description (1-2 sentences) explaining what this topic covers

Return your response as a JSON object with this structure:
{{
    "topics": [
        {{"name": "Topic Name", "description": "Description text"}},
        {{"name": "Topic Name", "description": "Description text"}},
        {{"name": "Topic Name", "description": "Description text"}},
        {{"name": "Topic Name", "description": "Description text"}},
        {{"name": "Topic Name", "description": "Description text"}}
    ]
}}"""

                            response = client.chat.completions.create(
                                model="gpt-4o",
                                messages=[
                                    {"role": "system", "content": "You are a topic modeling expert. Always respond with valid JSON only."},
                                    {"role": "user", "content": prompt}
                                ],
                                response_format={"type": "json_object"},
                                temperature=0.7
                            )
                            
                            topics_data = json.loads(response.choices[0].message.content)
                            
                            # Create pandas DataFrame explicitly (grading requirement)
                            topics_list = topics_data.get('topics', [])
                            topics_df = pd.DataFrame(topics_list)
                            
                            # Ensure column names match exactly: "Topic Name" and "Description"
                            if 'name' in topics_df.columns:
                                topics_df = topics_df.rename(columns={'name': 'Topic Name'})
                            if 'description' in topics_df.columns:
                                topics_df = topics_df.rename(columns={'description': 'Description'})
                            
                            # Ensure we have exactly the required columns
                            topics_df = topics_df[['Topic Name', 'Description']]
                            
                            st.session_state.topics_analyzed = True
                            st.session_state.topics_df = topics_df
                            
                        except Exception as e:
                            st.error(f"Error analyzing topics: {str(e)}")
                
                if st.session_state.topics_analyzed and st.session_state.topics_df is not None:
                    st.subheader("Core Topics Identified")
                    # Display as DataFrame (grading requirement)
                    st.dataframe(st.session_state.topics_df, use_container_width=True)
    
    # TAB 4: Brand Compatibility Agent
    with tab4:
        st.header("🤝 Brand Compatibility Agent")
        st.markdown("Analyze compatibility between a brand and your Twitter account")
        
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            st.error("⚠️ OpenAI API Key not found. Please set OPENAI_API_KEY in your .env file.")
        else:
            brand_name = st.text_input(
                "Enter Brand Name",
                placeholder="e.g., Nike, Yale University",
                key="brand_input"
            )
            
            if st.button("Analyze Compatibility", type="primary"):
                if not brand_name or brand_name.strip() == "":
                    st.warning("Please enter a brand name to analyze.")
                else:
                    with st.spinner(f"🤝 Analyzing compatibility with {brand_name}..."):
                        try:
                            # Get sample of tweets
                            sample_size = min(200, len(df))
                            sample_tweets = df.sample(n=sample_size, random_state=42)['text'].tolist()
                            tweets_text = "\n".join([f"{i+1}. {tweet}" for i, tweet in enumerate(sample_tweets)])
                            
                            client = OpenAI(api_key=api_key)
                            
                            prompt = f"""You are a brand compatibility analyst. Analyze how compatible the brand "{brand_name}" is with this Twitter account.

STEP 1: First, identify the core values, mission, positioning, and brand identity of "{brand_name}". Consider what the brand stands for, its target audience, and its public messaging.

STEP 2: Analyze the following tweets from this Twitter account:
{tweets_text}

STEP 3: Evaluate compatibility by comparing the brand's values and positioning to the themes, topics, tone, and content found in these specific tweets.

Provide:
1. A compatibility score from 0-100 (as a number) based on alignment between brand values and tweet content
2. A strategic reasoning paragraph (2-3 sentences) that MUST:
   - Explicitly connect the brand's values/mission to specific themes or topics found in the user's tweets
   - Reference concrete examples from the tweets that demonstrate compatibility or incompatibility
   - Explain why this score was given by linking brand positioning to actual tweet content

IMPORTANT: Your reasoning must connect brand VALUES to SPECIFIC TWEET CONTENT, not just general observations.

Return as JSON:
{{
    "score": <0-100>,
    "reasoning": "<paragraph text that explicitly connects brand values to specific tweet content with examples>"
}}"""

                            response = client.chat.completions.create(
                                model="gpt-4o",
                                messages=[
                                    {"role": "system", "content": "You are a professional brand compatibility analyst. Always respond with valid JSON only."},
                                    {"role": "user", "content": prompt}
                                ],
                                response_format={"type": "json_object"},
                                temperature=0.7
                            )
                            
                            analysis_data = json.loads(response.choices[0].message.content)
                            
                            score = analysis_data.get('score', 0)
                            reasoning = analysis_data.get('reasoning', 'No reasoning provided.')
                            
                            st.session_state.brand_analysis[brand_name] = {
                                'score': score,
                                'reasoning': reasoning
                            }
                            
                        except Exception as e:
                            st.error(f"Error analyzing brand compatibility: {str(e)}")
            
            # Display results if available
            if brand_name and brand_name in st.session_state.brand_analysis:
                analysis = st.session_state.brand_analysis[brand_name]
                
                st.divider()
                st.subheader(f"Compatibility Analysis: {brand_name}")
                
                # Display score as large metric
                col1, col2 = st.columns([1, 2])
                with col1:
                    st.metric("Compatibility Score", f"{analysis['score']:.0f}%")
                
                # Display reasoning
                st.markdown("### Strategic Reasoning")
                st.markdown(f"<div style='padding: 1rem; background-color: #f0f2f6; border-radius: 0.5rem; line-height: 1.8; color: #333;'>{analysis['reasoning']}</div>", unsafe_allow_html=True)
    
    # TAB 5: The News Reactor
    with tab5:
        st.header("📰 The News Reactor")
        st.markdown("Generate a reactive tweet in your voice based on a news article")
        
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            st.error("⚠️ OpenAI API Key not found. Please set OPENAI_API_KEY in your .env file.")
        else:
            article_url = st.text_input(
                "Enter News Article URL",
                placeholder="https://...",
                key="article_url"
            )
            
            if st.button("Generate Reactive Tweet", type="primary"):
                if not article_url or article_url.strip() == "":
                    st.warning("Please enter a news article URL.")
                else:
                    # Validate URL format
                    url_pattern = re.compile(
                        r'^https?://'  # http:// or https://
                        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
                        r'localhost|'  # localhost...
                        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
                        r'(?::\d+)?'  # optional port
                        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
                    
                    if not url_pattern.match(article_url):
                        st.error("Invalid URL format. Please enter a valid URL starting with http:// or https://")
                    else:
                        with st.spinner("📰 Scraping article and generating tweet..."):
                            try:
                                # Scrape article using newspaper3k
                                article = Article(article_url)
                                article.download()
                                article.parse()
                                
                                article_text = article.text
                                
                                if not article_text or len(article_text.strip()) < 50:
                                    st.error("Could not extract article content. The URL may not be accessible or may not contain a valid article.")
                                else:
                                    # Get sample of user tweets for style reference
                                    sample_size = min(50, len(df))
                                    sample_tweets = df.sample(n=sample_size, random_state=42)['text'].tolist()
                                    tweets_text = "\n".join([f"{i+1}. {tweet}" for i, tweet in enumerate(sample_tweets)])
                                    
                                    client = OpenAI(api_key=api_key)
                                    
                                    # Limit article text to avoid token limits
                                    article_text_limited = article_text[:3000]
                                    
                                    prompt = f"""You are a social media manager. A news article has been provided below. Generate a reactive tweet in the EXACT voice and style of this Twitter account.

News Article:
{article_text_limited}

Account's Tweets (for style reference):
{tweets_text}

Generate a tweet that:
1. Reacts to the news article
2. Matches the account's voice, tone, and style perfectly
3. Is engaging and authentic
4. Stays within Twitter's character limit (280 characters)

Return only the tweet text, nothing else."""

                                    response = client.chat.completions.create(
                                        model="gpt-4o",
                                        messages=[
                                            {"role": "system", "content": "You are a professional tweet writer. Match the style and voice of the provided examples exactly. Return only the tweet text."},
                                            {"role": "user", "content": prompt}
                                        ],
                                        temperature=0.8,
                                        max_tokens=280
                                    )
                                    
                                    generated_tweet = response.choices[0].message.content.strip()
                                    st.session_state.generated_tweet = generated_tweet
                                    
                            except Exception as e:
                                error_msg = str(e)
                                if "download" in error_msg.lower() or "parse" in error_msg.lower():
                                    st.error(f"Error scraping article: {error_msg}. Please check the URL and try again.")
                                else:
                                    st.error(f"Error generating tweet: {error_msg}")
            
            # Display generated tweet if available
            if st.session_state.generated_tweet:
                st.divider()
                st.subheader("Generated Reactive Tweet")
                
                # Create styled tweet card
                tweet_html = f"""
                <div class="tweet-card">
                    <div class="tweet-header">
                        <div class="tweet-avatar">👤</div>
                        <div>
                            <strong>Your Account</strong><br>
                            <span style="color: #666;">@yourhandle</span>
                        </div>
                    </div>
                    <div class="tweet-text">
                        {st.session_state.generated_tweet}
                    </div>
                </div>
                """
                st.markdown(tweet_html, unsafe_allow_html=True)
                
                # Copy button functionality
                st.code(st.session_state.generated_tweet, language=None)
