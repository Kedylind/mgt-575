# Implementation Plan: Strategic Tweet Engine

## Overview
Transform the existing `tweet_analytics_dashboard.py` into a comprehensive "Strategic Tweet Engine" with 5 specific tabs as per requirements. The app should be renamed to `app.py` and maintain professional styling and error handling.

## Current State Analysis
The existing codebase (`tweet_analytics_dashboard.py`) has:
- ✅ CSV upload functionality in sidebar
- ✅ Basic data processing (engagement calculation)
- ✅ OpenAI API integration
- ✅ Streamlit tabs structure (5 tabs, but wrong content)
- ✅ Custom CSS styling
- ✅ Session state management

## Required Changes

### 1. File Renaming & Structure
- **Action**: Rename `tweet_analytics_dashboard.py` to `app.py`
- **Reason**: Submission requirement specifies `app.py` as the main file

### 2. Update App Title & Branding
- **Location**: `st.set_page_config()` and main title
- **Changes**:
  - Update page title to "David Schmidt -  Strategic Tweet Engine" (or make it configurable)
  - Update page icon to something strategic (e.g., "🎯" or "📈")
  - Keep the professional styling

### 3. Tab 1: The Leaderboard
**Current State**: Tab 1 is "Overview" with metrics and sortable table
**Required State**: Clean data table ranked by Engagement Rate (Favorites / Views)

**Implementation Steps**:
1. Remove the metrics cards (Total Tweets, Total Favorites, etc.) - keep only the table
2. Change default sort to be by Engagement Rate (descending) - this is already calculated as `engagement = favorite_count / view_count`
3. Ensure the table shows:
   - Tweet text
   - Created date
   - Favorites count
   - Views count
   - Engagement Rate (formatted as percentage or decimal)
4. Remove the sort dropdown - table should always be sorted by Engagement Rate (high to low)
5. Update tab name from "📈 Overview" to "🏆 The Leaderboard"
6. Add a header "The Leaderboard" with description explaining it's ranked by Engagement Rate

**Code Changes**:
- Remove lines 160-179 (metrics cards)
- Remove lines 184-188 (sort dropdown)
- Modify lines 192-199 to always sort by engagement descending
- Update tab label in line 151

### 4. Tab 2: The Activity Heatmap
**Current State**: Tab 2 is "Engagement Charts" with Altair charts
**Required State**: Heatmap showing posting frequency by Hour of Day (0-23) vs Day of Week (Mon-Sun)

**Implementation Steps**:
1. Remove existing Altair charts
2. Extract hour of day from `created_at` datetime: `df['hour'] = df['created_at'].dt.hour`
3. Extract day of week from `created_at` datetime: `df['day_of_week'] = df['created_at'].dt.day_name()` or `dt.dayofweek` (0=Monday, 6=Sunday)
4. Create a pivot table: `heatmap_data = df.groupby(['day_of_week', 'hour']).size().reset_index(name='count')`
5. Reshape for heatmap: Create a 2D matrix with days as rows and hours as columns
6. Use Plotly's `go.Heatmap` or `px.imshow()` to create the heatmap
7. Configure:
   - X-axis: Hours 0-23
   - Y-axis: Days Monday-Sunday (in order)
   - Colors: Use a color scale (e.g., 'YlOrRd' or 'Blues')
8. Update tab name from "📊 Engagement Charts" to "🔥 The Activity Heatmap"
9. Add header "The Activity Heatmap" with description

**Code Changes**:
- Replace entire Tab 2 content (lines 212-242)
- Add imports if needed: `import plotly.express as px` (already have plotly)
- Create new heatmap visualization

**Data Processing**:
```python
# Extract time components
df['hour'] = df['created_at'].dt.hour
df['day_of_week'] = df['created_at'].dt.day_name()
# Or use dayofweek: df['day_of_week_num'] = df['created_at'].dt.dayofweek

# Create frequency count
heatmap_df = df.groupby(['day_of_week', 'hour']).size().reset_index(name='count')

# Reshape for heatmap (pivot table)
heatmap_pivot = heatmap_df.pivot(index='day_of_week', columns='hour', values='count').fillna(0)

# Ensure proper day order
day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
heatmap_pivot = heatmap_pivot.reindex([d for d in day_order if d in heatmap_pivot.index])
```

### 5. Tab 3: Topic Modeler
**Current State**: Tab 3 is "Marketing Analysis" with vibe analysis
**Required State**: AI analysis to identify top 5 "Core Pillars" (topics) with Topic Name and Description

**Implementation Steps**:
1. Remove existing marketing analysis code
2. Create a button "Analyze Topics" or auto-analyze on tab open (with caching)
3. Use OpenAI to analyze all tweets and identify 5 core topics/pillars
4. Prompt should:
   - Analyze all tweet text (or a representative sample if too many)
   - Identify 5 main topics/themes
   - Return structured data: Topic Name and Description for each
5. Display results in a clean table with 2 columns: "Topic Name" and "Description"
6. **CRITICAL**: Must use pandas DataFrame explicitly (not just any table) - this is a grading requirement
7. Use `st.dataframe()` to display the DataFrame
8. Update tab name from "🤖 Marketing Analysis" to "🎯 Topic Modeler"
9. Add header "Topic Modeler" with description

**Code Changes**:
- Replace Tab 3 content (lines 244-292)
- Create new OpenAI prompt for topic extraction
- Parse JSON response and create pandas DataFrame explicitly
- Display DataFrame using st.dataframe()

**DataFrame Creation Code** (MUST BE INCLUDED):
```python
# After receiving JSON response from OpenAI
import json
topics_data = json.loads(response.choices[0].message.content)
# Create pandas DataFrame explicitly
topics_df = pd.DataFrame(topics_data['topics'])
# Ensure column names match exactly: "Topic Name" and "Description"
topics_df.columns = ['Topic Name', 'Description']
# Display as DataFrame (grading requirement)
st.dataframe(topics_df, use_container_width=True)
```

**AI Prompt Structure**:
```python
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
        ...
    ]
}}
"""
```

### 6. Tab 4: Brand Compatibility Agent
**Current State**: Tab 4 is "Personality Profile" with Big 5 traits
**Required State**: Input box for brand name, AI analysis for compatibility score (0-100%) and strategic reasoning

**Implementation Steps**:
1. Remove personality profile code
2. Add text input: `st.text_input("Enter Brand Name", placeholder="e.g., Nike, Yale University")`
3. Add "Analyze Compatibility" button
4. When button clicked:
   - Get brand name from input
   - Send all tweets (or sample) + brand name to OpenAI
   - Request compatibility score (0-100%) and strategic reasoning paragraph
5. Display:
   - Large metric showing compatibility score (0-100%)
   - Paragraph of strategic reasoning (styled nicely)
6. Update tab name from "🧠 Personality Profile" to "🤝 Brand Compatibility Agent"
7. Add header "Brand Compatibility Agent" with description

**Code Changes**:
- Replace Tab 4 content (lines 294-397)
- Add text input widget
- Create new OpenAI prompt for brand compatibility
- Display score and reasoning

**AI Prompt Structure** (ENHANCED for grading requirements):
```python
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
}}
"""
```

**Grading Requirement**: The reasoning must "connect the Brand values to the User's specific tweet content" - this enhanced prompt ensures the AI will reference specific tweets and connect them to brand values.

### 7. Tab 5: The News Reactor
**Current State**: Tab 5 is "Generate Tweet" based on top tweets
**Required State**: Input box for news article URL, scrape article, generate reactive tweet in user's voice

**Implementation Steps**:
1. Remove existing tweet generation code
2. Add text input: `st.text_input("Enter News Article URL", placeholder="https://...")`
3. Add "Generate Reactive Tweet" button
4. When button clicked:
   - Validate URL format
   - Use `newspaper3k` library to scrape article text
   - Send article text + all user tweets to OpenAI
   - Request a reactive tweet in the user's voice/style
5. Display generated tweet in styled "Tweet Card" UI:
   - Dummy avatar icon (can use emoji or CSS circle)
   - Dummy name (e.g., "Your Account" / "@yourhandle")
   - Tweet text
6. Update tab name from "✍️ Generate Tweet" to "📰 The News Reactor"
7. Add header "The News Reactor" with description

**Code Changes**:
- Replace Tab 5 content (lines 399-464)
- Add newspaper3k import and usage
- Create new OpenAI prompt for news-reactive tweet generation
- Enhance tweet card styling (already exists, may need tweaks)

**Dependencies**:
- Add `newspaper3k` to requirements.txt
- May need `lxml` and `beautifulsoup4` as dependencies

**AI Prompt Structure**:
```python
prompt = f"""You are a social media manager. A news article has been provided below. Generate a reactive tweet in the EXACT voice and style of this Twitter account.

News Article:
{article_text}

Account's Tweets (for style reference):
{tweets_text}

Generate a tweet that:
1. Reacts to the news article
2. Matches the account's voice, tone, and style perfectly
3. Is engaging and authentic
4. Stays within Twitter's character limit

Return only the tweet text, nothing else."""
```

### 8. Update Requirements.txt
**Current State**: Has basic dependencies
**Required Additions**:
- `newspaper3k>=0.2.8` (for article scraping)
- `lxml>=4.9.0` (dependency for newspaper3k)
- `beautifulsoup4>=4.12.0` (dependency for newspaper3k)

**Action**: Add these three packages to requirements.txt

### 9. Error Handling & Robustness
**Enhancements Needed**:
1. Add try-catch blocks around:
   - CSV parsing
   - Datetime conversion
   - OpenAI API calls (already partially done)
   - Newspaper3k article scraping
   - URL validation
2. Add user-friendly error messages
3. Handle edge cases:
   - Empty CSV
   - Missing datetime data
   - Invalid URLs
   - Failed article scraping
   - API errors

### 10. Styling & UX Improvements
**Maintain Existing**:
- Keep current CSS styling (lines 22-82)
- Keep professional color scheme
- Keep tweet card styling (enhance if needed for Tab 5)

**Enhancements**:
- Ensure all new tabs have consistent styling
- Add loading states for AI operations
- Add success/error messages
- Ensure responsive design

## Implementation Order

1. **Phase 1: File Structure & Setup**
   - Rename file to app.py
   - Update title and branding
   - Update requirements.txt

2. **Phase 2: Tab 1 - Leaderboard**
   - Simplify to engagement-ranked table only
   - Remove unnecessary UI elements

3. **Phase 3: Tab 2 - Activity Heatmap**
   - Implement datetime extraction
   - Create heatmap visualization
   - Test with sample data

4. **Phase 4: Tab 3 - Topic Modeler**
   - Implement OpenAI topic extraction
   - Create table display
   - Add caching for performance

5. **Phase 5: Tab 4 - Brand Compatibility**
   - Add input widget
   - Implement compatibility analysis
   - Display score and reasoning

6. **Phase 6: Tab 5 - News Reactor**
   - Add URL input
   - Implement article scraping
   - Generate reactive tweet
   - Enhance tweet card display

7. **Phase 7: Polish & Testing**
   - Add comprehensive error handling
   - Test with various CSV formats
   - Test edge cases
   - Verify all tabs work correctly
   - Ensure professional appearance

## Key Technical Considerations

### Data Processing
- Ensure `created_at` is properly parsed (already handled)
- Handle timezone issues if any
- Handle missing data gracefully

### OpenAI API
- Use appropriate models (gpt-4 or gpt-4o for complex analysis)
- Implement response parsing (JSON where needed)
- Handle API errors gracefully
- Consider token limits for large tweet datasets

### Performance
- Cache AI results in session state to avoid re-computation
- Consider sampling tweets for very large datasets
- Optimize heatmap data processing

### Dependencies
- Ensure all new packages are in requirements.txt
- Test installation process
- Document any system-level dependencies (e.g., lxml may need system libraries)

## Testing Checklist

- [ ] CSV upload works with required columns
- [ ] Tab 1 displays tweets ranked by engagement rate
- [ ] Tab 2 shows heatmap with correct axes (hours 0-23, days Mon-Sun)
- [ ] Tab 3 identifies and displays 5 core topics in a pandas DataFrame (2 columns: "Topic Name" and "Description")
- [ ] Tab 4 calculates compatibility score for brand input AND reasoning connects brand values to specific tweet content
- [ ] Tab 5 scrapes article and generates reactive tweet
- [ ] All error cases handled gracefully
- [ ] App runs without errors
- [ ] Professional styling maintained throughout
- [ ] All tabs accessible and functional

## Notes for Next AI Agent

1. **Build on Existing Code**: The current `tweet_analytics_dashboard.py` has a solid foundation. Preserve:
   - CSV upload logic
   - Session state management
   - OpenAI integration pattern
   - CSS styling
   - Error handling patterns

2. **Incremental Changes**: Make changes tab by tab to avoid breaking existing functionality.

3. **Test Frequently**: After each major change, test that the app still runs and the modified tab works correctly.

4. **Preserve User Experience**: Keep the sidebar upload, maintain professional styling, and ensure smooth transitions between tabs.

5. **API Key Handling**: The existing `.env` file pattern should be maintained. Document that users need `OPENAI_API_KEY` in their `.env` file.

6. **CSV Format**: The existing CSV format expectations should be maintained (text, view_count, created_at, favorite_count).

7. **CRITICAL GRADING REQUIREMENTS**:
   - **Tab 3**: MUST create a pandas DataFrame explicitly (not just any table). Use `pd.DataFrame()` and display with `st.dataframe()`. This is explicitly required in the grading rubric.
   - **Tab 4**: The AI reasoning MUST connect brand VALUES (not just name) to SPECIFIC tweet content. The enhanced prompt structure ensures this, but verify the reasoning references actual tweet examples.

## Final Deliverables

After implementation, the project should have:
- `app.py` - Main application file
- `requirements.txt` - All dependencies listed
- `.env.example` or documentation for API key setup
- All functionality working as specified in requirements

The app should be ready to zip as `hw1.zip` for submission.
