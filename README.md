# GitHub PR Review Times

Analyze pull request review performance across your GitHub repositories. Track review times, identify bottlenecks, and visualize trends with beautiful charts.

## 🎯 [View Live Demo](https://loktar00.github.io/pr-review-times/)

See a fully-featured example report with sample data from two repositories. [Demo Documentation](https://loktar00.github.io/pr-review-times)

## What This Does

This toolkit fetches PR data from GitHub and generates a **beautiful HTML report** with comprehensive analytics:

**📄 HTML Report:**
- Professional, shareable web report with all your PR metrics
- Three time periods: Overall, Last Quarter, and Last 30 Days
- Interactive charts and visualizations embedded directly
- Mobile-responsive design

**📊 Statistics:**
- Average and median time to first review
- Average and median time to merge
- Review → Merge time breakdown
- Per-developer performance metrics
- PR counts, merge rates, and completion stats

**📈 Visual Charts:**
- Review time trends over time (are you improving or slowing down?)
- Per-developer comparison charts
- Distribution histograms showing typical vs outlier PRs
- Separate charts for each time period

**🎯 Key Features:**
- **Multi-repository support**: Analyzes multiple repositories with both combined and individual views
- **Time period analysis**: Compare performance across Overall, Last Quarter, and Last 30 Days
- **Automatic resume**: Detects existing data and continues from where you left off
- **Crash-safe**: Data saved as it's fetched - resume after timeouts/errors
- **Per-repo files**: Each repository gets its own CSV file and report section
- **Auto-retry**: Network errors automatically retried with exponential backoff
- **Per-repository charts**: Dedicated visualizations for each repo plus combined views

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Up GitHub Token

Create a `.env` file:

```bash
cp env.example .env
```

Edit `.env` and add your GitHub token:
```
GITHUB_TOKEN=ghp_yourTokenHere
```

Get a token at: https://github.com/settings/tokens (needs `repo` scope)

### 3. Fetch PR Data

```bash
# Single repository
python scripts/gh_pr_times.py --repos owner/repo

# Multiple repositories
python scripts/gh_pr_times.py --repos org/repo1 org/repo2 org/repo3
```

This creates CSV files in `./data/` directory (one per repo).

**Run the same command again** - it automatically resumes and fetches only new PRs!

### 4. Analyze & Visualize

```bash
# Analyzes all CSV files in ./data automatically
python scripts/analyze_pr_times.py

# On Windows, if you see encoding errors:
$env:PYTHONIOENCODING='utf-8'; python scripts/analyze_pr_times.py
```

**View the Report:**
- Open `web/index.html` in your browser
- All charts and data are automatically loaded from `./report/`
- No server required - works as a local file!

**What You Get:**
- **Multi-Repository Support**: Combined "All Repositories" view + individual repo sections
- **Time Period Analysis**: Weekly, 30 Day, Quarter, and Overall views
- **Global Developer Stats**: Performance metrics across all repositories
- **Interactive Navigation**: Sidebar for repos, tabs for time periods
- **Beautiful Charts**: Trend analysis and distribution visualizations

## What Data You Get

### CSV Files (`./data/`)

Each repository gets a CSV file with these columns:

| Column | Description |
|--------|-------------|
| `repo` | Repository name |
| `number` | PR number |
| `title` | PR title |
| `url` | Direct link to PR |
| `author` | PR author's GitHub username |
| `draft` | Whether PR was a draft |
| `created_at` | When PR was created |
| `closed_at` | When PR was closed |
| `merged_at` | When PR was merged |
| `additions` | Lines added |
| `deletions` | Lines deleted |
| `changed_files` | Files changed |
| `commits` | Number of commits |
| `reviews_count` | Total reviews |
| `first_review_at` | When first review was submitted |
| `time_to_first_review_hours` | Hours until first review |
| `time_to_merge_hours` | Hours until merged |
| `open_time_hours` | Hours PR has been open (if not merged) |

### Analytics Output

**HTML Report** (`web/index.html`):
- 🎨 Beautiful, professional web report you can share with your team
- 🗂️ **Sidebar Navigation**: Switch between "Overall" (combined) view and individual repositories
- 📊 **Four Time Periods**: Weekly (7 days), 30 Day, Quarter (90 days), and Overall
- 📈 **Tabbed Interface**: Each repository has tabs for different time periods
- 🌍 **Global Developer Stats**: Combined performance metrics across all repositories
- Each period includes:
  - Summary statistics (PR counts, merge rates)
  - Time metrics (review time, merge time, review→merge time)
  - Trend indicators (improving/declining with visual badges)
  - Interactive charts (trends over time, distribution histograms)
  - Per-developer performance tables
- 📱 **Responsive Design**: Works perfectly on desktop, tablet, and mobile

**Generated Data** (`./report/`):
- `report-data.json` - All statistics, trends, and metadata in JSON format
- `*_trends_*.png` - Time series charts with trend lines for each repo and period
- `*_distributions_*.png` - Distribution histograms for each repo and period
- **Note**: The `report/` directory is git-ignored (generated files)

## Common Usage Patterns

### Daily/Weekly Updates

Run the same commands to update with only new PRs:

```bash
# Fetch new PRs (automatic incremental update)
python scripts/gh_pr_times.py --repos owner/repo

# Regenerate analytics
python scripts/analyze_pr_times.py
```

### Multiple Repositories

Analyze across your entire team:

```bash
# Fetch from all repos
python scripts/gh_pr_times.py --repos \
  org/frontend \
  org/backend \
  org/api \
  org/mobile

# Analyze all repos combined
python scripts/analyze_pr_times.py
```

### Date Range Filtering

Get PRs from specific time period:

```bash
python scripts/gh_pr_times.py --repos owner/repo \
  --since 2025-01-01 \
  --until 2025-03-31
```

### Handling Timeouts

If the script times out, just run it again:

```bash
# First run - times out after 237 PRs
python scripts/gh_pr_times.py --repos owner/repo --timeout 60 --retries 5

# Run again - automatically continues from PR #238!
python scripts/gh_pr_times.py --repos owner/repo --timeout 60 --retries 5
```

Data is saved as it's fetched, so you never lose progress.

## Command-Line Options

### `gh_pr_times.py`

| Option | Default | Description |
|--------|---------|-------------|
| `--repos` | *required* | Repositories to analyze (space-separated) |
| `--out-dir` | `./data` | Output directory for CSV files |
| `--since` | none | Only PRs created on/after this date (YYYY-MM-DD) |
| `--until` | none | Only PRs created before this date (YYYY-MM-DD) |
| `--state` | `all` | Filter by state: `open`, `closed`, or `all` |
| `--timeout` | `30` | HTTP timeout in seconds |
| `--retries` | `3` | Number of retry attempts for failed requests |
| `--sleep` | `0` | Seconds to sleep between API calls |
| `--force-full-refresh` | off | Ignore existing data and re-fetch everything |

### `analyze_pr_times.py`

| Option | Default | Description |
|--------|---------|-------------|
| `--input` | auto-detect | Specific CSV file to analyze |
| `--data-dir` | `./data` | Directory to scan for CSV files |
| `--output-dir` | `./report` | Output directory for charts and JSON data |
| `--min-prs` | `3` | Minimum PRs for per-developer stats |

## Understanding the Insights

### Trends

**🟢 DECREASING review times** means:
- Team is getting faster at reviews
- Could indicate better processes, smaller PRs, or more reviewers

**🔴 INCREASING review times** means:
- Reviews are taking longer
- May indicate team growth, increased complexity, or reviewer overload

### Per-Developer Stats

Use this to:
- Identify who needs more review support
- Find developers working on complex areas
- Balance review load across the team

### Distribution Charts

- **Median vs Average**: Large gap indicates outlier PRs
- **Long tail**: Some PRs taking much longer than typical
- **Tight distribution**: Consistent review process

## Understanding the Metrics

### Time Metrics Explained

The analysis tracks three key time periods:

1. **Time to First Review** (shown as "Avg Review Time" in per-developer stats)
   - **Measures**: Hours from PR creation until someone submits their first formal review
   - **Important**: Tracks GitHub's "Submit Review" button, not just comments
   - **What it means**: Team responsiveness to new PRs
   - **Example**: 0.1h = 6 minutes (very fast!), 6.7h = ~7 hours (good), 24h+ = may need attention
   - **Why it varies**: Recent improvements in process, smaller PRs, active monitoring, or team changes

2. **Time to Merge** (shown as "Avg Merge Time")
   - **Measures**: Total time from PR creation until it's merged
   - **Includes**: Review + discussion + revisions + approvals + all cycles
   - **Example**: 44 hours = ~1.8 days total PR lifetime
   - **Note**: Always ≥ Time to First Review

3. **Review → Merge Time** (first review → merge)
   - **Measures**: Time from first review to actual merge
   - **Calculated as**: Time to Merge - Time to First Review
   - **Example**: 30 hours = after first review, takes another ~30 hours to merge
   - **Includes**: Additional review rounds, code changes, CI/CD, approvals, etc.

### Why PRs Take Longer to Merge Than First Review

Even if first review happens quickly (e.g., 14 hours), total merge time is longer (e.g., 44 hours) because:
- Multiple rounds of review and feedback
- Code changes and updates
- CI/CD pipeline runs
- Waiting for final approval
- Coordination and scheduling

This is **normal and healthy** for quality code review! Quick first review shows responsiveness, while additional time ensures thorough review.

### Impact of Automated Reviewers (Bots/AI) 🤖

If you use automated PR reviewers (like AI code review bots, linters, or security scanners that submit GitHub reviews):

**What You'll See:**
- **Very low "Time to First Review"** (< 1 hour, often minutes)
- **"Avg Merge Time" ≈ "Review → Merge Time"** (nearly identical numbers)

**Why This Happens:**
- The bot reviews instantly (minutes after PR creation)
- This becomes the "first review" in the metrics
- Almost all PR time is *after* the bot review (waiting for humans)
- So "Time to Merge" and "Review → Merge" are almost the same

**What The Metrics Actually Show:**
- ✅ **Time to First Review**: How fast your bot responds (not very useful for human metrics)
- ✅ **Review → Merge Time**: How long the PR takes after bot review (this is your real lifecycle time!)
- ℹ️ **Human review time**: Not currently tracked separately

**Example With AI Bot:**
```
PR Created (0h)
    ↓ [AI bot reviews in 6 minutes]
First Review (0.1h) ← AI Bot 🤖
    ↓ [Waiting for human review, changes, approval]
Merged (6h)

Time to First Review:  0.1h  (AI instant response)
Time to Merge:         6.0h  (full lifecycle)
Review → Merge:        5.9h  (almost identical to merge time!)
```

**Tip**: If you want to track human review times separately, consider filtering out bot accounts when fetching data, or create a separate analysis excluding bot reviews.

### PR Status Categories

- **Merged**: PRs successfully merged into the main branch
- **Closed (not merged)**: PRs closed/rejected without merging
- **Still Open**: PRs currently open and awaiting action

### Time Periods

- **Last 30 Days**: Recent performance - track current team velocity
- **Last Quarter (90 Days)**: Broader trends - quarterly reviews and seasonal patterns
- **Overall**: Historical baseline - compare against long-term averages

## Troubleshooting

**No CSV files found:**
```bash
# Run the fetch command first
python scripts/gh_pr_times.py --repos owner/repo
```

**Timeout errors:**
```bash
# Increase timeout and retries
python scripts/gh_pr_times.py --repos owner/repo --timeout 60 --retries 5

# If it times out, just run the same command again
```

**Rate limit errors:**
- Script automatically waits for rate limit reset
- GitHub allows 5,000 requests/hour for authenticated requests
- Add `--sleep 0.5` to slow down requests

**Emoji encoding errors (Windows):**
```powershell
# Set UTF-8 encoding before running
$env:PYTHONIOENCODING='utf-8'; python scripts/analyze_pr_times.py
```

## Files & Directories

```
pr-review-times/
├── web/                           # 🌐 Client application
│   ├── index.html                 # 📄 Main HTML report (open this!)
│   ├── app.js                     # Application logic
│   └── styles.css                 # Styling
├── scripts/                       # 🐍 Python analysis tools
│   ├── gh_pr_times.py             # Data fetching script
│   └── analyze_pr_times.py        # Analytics & visualization
├── data/                          # CSV files (one per repo, git-ignored)
│   ├── owner_repo.csv
│   └── org_project.csv
├── report/                        # Generated analytics (git-ignored)
│   ├── report-data.json           # All statistics in JSON format
│   ├── *_trends_*.png             # Trend charts for each period
│   └── *_distributions_*.png      # Distribution charts
├── demo/                          # 📊 Example output (tracked in git)
│   ├── report-data.json           # Sample data
│   └── *.png                      # Sample charts
├── demo_data/                     # 📁 Example CSV files (tracked in git)
│   ├── example-org_backend-api.csv
│   └── example-org_frontend-app.csv
├── requirements.txt               # Python dependencies
├── env.example                    # Environment template
└── .env                           # GitHub token (create this)
```

## Requirements

- Python 3.7+
- GitHub Personal Access Token
- Dependencies: `requests`, `python-dotenv`, `tqdm`, `matplotlib`, `numpy`, `scipy`

## Hosting on GitHub Pages

You can host your PR analytics report on GitHub Pages to share with your team:

### Setup

1. **Generate your report:**
```bash
python scripts/gh_pr_times.py --repos your-org/your-repo
python scripts/analyze_pr_times.py
```

2. **Create gh-pages branch:**
```bash
git checkout --orphan gh-pages
git rm -rf .
```

3. **Copy report files:**
```bash
cp -r web/* .
cp -r report report
git add index.html app.js styles.css report/
git commit -m "Add PR analytics report"
git push origin gh-pages
```

4. **Enable GitHub Pages:**
   - Go to your repository Settings → Pages
   - Select `gh-pages` branch as source
   - Your report will be available at: `https://your-username.github.io/your-repo/`

### Automated Updates

Add a GitHub Action to automatically update the report:

```yaml
# .github/workflows/pr-analytics.yml
name: Update PR Analytics
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  workflow_dispatch:

jobs:
  update-analytics:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: |
          python scripts/gh_pr_times.py --repos your-org/your-repo
          python scripts/analyze_pr_times.py
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Prepare deployment
        run: |
          mkdir -p gh-pages
          cp -r web/* gh-pages/
          cp -r report gh-pages/report
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./gh-pages
```

## Notes

- **Incremental by default**: Always resumes from latest PR automatically
- **Crash-safe**: Data written immediately, not at the end
- **Multi-repo safe**: Each repo gets its own CSV file
- **Reviews vs Comments**: "Time to first review" tracks submitted reviews, not PR comments
- **Private repos**: Token needs `repo` scope (not just `public_repo`)
- **Demo available**: Check out the [live demo](https://loktar00.github.io/pr-review-times/report.html) with sample data

## License

Provided as-is for analyzing GitHub PR metrics.
