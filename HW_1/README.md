# Strategic Tweet Engine

A comprehensive Streamlit application for analyzing Twitter/X tweet data with AI-powered strategic insights. Built by David Schmidt.

## Overview

The Strategic Tweet Engine transforms your Twitter analytics into actionable insights through five powerful analysis tools. From understanding your best-performing content to generating reactive tweets based on current events, this application provides a complete toolkit for strategic social media management.

## Features

### 🏆 The Leaderboard
View all your tweets ranked by Engagement Rate (Favorites / Views). This tab provides a clean, sortable table showing your top-performing content, helping you identify what resonates most with your audience.

**Key Metrics:**
- Tweet text
- Creation date
- Favorites count
- Views count
- Engagement Rate (automatically calculated)

### 🔥 The Activity Heatmap
Visualize your posting patterns with an interactive heatmap showing posting frequency by Hour of Day (0-23) vs Day of Week (Monday-Sunday). Identify your most active posting times and optimize your content schedule.

**Visualization:**
- Color-coded heatmap using Plotly
- Interactive tooltips
- Automatic day ordering (Monday through Sunday)

### 🎯 Topic Modeler
AI-powered analysis that identifies the top 5 Core Pillars (topics) from your tweets. Using GPT-4o, the system analyzes your content to discover recurring themes and topics, presented in a clean pandas DataFrame format.

**Output:**
- Topic Name (concise, 2-4 words)
- Description (1-2 sentences explaining each topic)
- Results cached for performance

### 🤝 Brand Compatibility Agent
Evaluate potential brand partnerships by analyzing compatibility between a brand and your Twitter account. The AI provides:
- **Compatibility Score**: 0-100% based on alignment between brand values and your content
- **Strategic Reasoning**: Detailed analysis connecting brand values to specific tweet content with concrete examples

**How it works:**
1. Enter a brand name (e.g., "Nike", "Yale University")
2. The AI analyzes the brand's values, mission, and positioning
3. Compares these to themes found in your tweets
4. Provides a compatibility score and strategic reasoning

### 📰 The News Reactor
Generate reactive tweets in your voice based on current news articles. Simply provide a news article URL, and the AI will:
1. Scrape the article content using newspaper3k
2. Analyze your tweet style and voice
3. Generate a reactive tweet that matches your authentic voice

**Features:**
- Automatic article scraping
- Voice matching based on your historical tweets
- Styled tweet card preview
- Copy-ready tweet text

## Setup

### Prerequisites
- Python 3.8 or higher
- OpenAI API key (required for AI-powered features)

### Installation

1. **Clone or download this repository**

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

3. **Create a `.env` file** in the project root:
```
OPENAI_API_KEY=your_openai_api_key_here
```

4. **Run the application:**
```bash
streamlit run app.py
```

The app will open in your default web browser at `http://localhost:8501`

## CSV Format

Your CSV file must contain the following columns:

| Column | Description | Example |
|--------|-------------|---------|
| `text` | Tweet content | "Just launched my new project!" |
| `view_count` | Number of views | 1250 |
| `created_at` | Timestamp (any parseable format) | "2024-01-15 10:30:00" or "2024-01-15T10:30:00Z" |
| `favorite_count` | Number of favorites/likes | 45 |

**Note:** The app automatically calculates an `engagement` metric as `favorite_count / view_count`.

## Usage Guide

### Getting Started

1. **Upload Your Data**: Use the sidebar to upload your tweet CSV file
2. **Verify Upload**: Check that the success message appears showing the number of tweets loaded
3. **Navigate Tabs**: Click through the 5 tabs to explore different analyses

### Tab-by-Tab Instructions

#### The Leaderboard
- Automatically displays tweets sorted by Engagement Rate (highest first)
- No action required - just view your top-performing content
- All columns are sortable by clicking headers

#### The Activity Heatmap
- Automatically generates when data is loaded
- Hover over cells to see exact posting counts
- Use to identify optimal posting times

#### Topic Modeler
1. Click "Analyze Topics" button
2. Wait for AI analysis (may take 10-30 seconds)
3. View the 5 core topics in the DataFrame
4. Results are cached - no need to re-analyze unless you upload new data

#### Brand Compatibility Agent
1. Enter a brand name in the text input
2. Click "Analyze Compatibility"
3. View the compatibility score (0-100%)
4. Read the strategic reasoning that connects brand values to your specific tweets

#### The News Reactor
1. Paste a news article URL (must start with http:// or https://)
2. Click "Generate Reactive Tweet"
3. Wait for article scraping and tweet generation
4. View the generated tweet in the styled card
5. Copy the tweet text from the code block below

## Technical Details

### AI Models Used
- **GPT-4o**: Used for Topic Modeler, Brand Compatibility Agent, and News Reactor
- Optimized prompts ensure accurate analysis and voice matching

### Dependencies
- `streamlit`: Web application framework
- `pandas`: Data manipulation and analysis
- `plotly`: Interactive visualizations
- `openai`: GPT-4o API integration
- `newspaper3k`: Article scraping
- `python-dotenv`: Environment variable management

### Error Handling
The application includes comprehensive error handling for:
- Invalid CSV formats
- Missing required columns
- Datetime parsing errors
- API failures
- Article scraping failures
- Invalid URLs

## Troubleshooting

### "OpenAI API Key not found"
- Ensure your `.env` file is in the project root directory
- Verify the key is named exactly `OPENAI_API_KEY`
- Restart the Streamlit app after creating/updating `.env`

### "Error loading CSV"
- Verify all required columns are present
- Check that `created_at` is in a parseable date format
- Ensure the CSV file is not corrupted

### "Could not extract article content"
- Verify the URL is accessible
- Some websites block automated scraping
- Try a different news article URL

### Heatmap not displaying
- Ensure `created_at` column contains valid datetime data
- Check that dates are properly parsed (no NaN values)

## Author

**David Schmidt**

Built for Social Media & AI course at Yale SOM.

## License

This project is for educational purposes.
