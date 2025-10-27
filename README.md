# GitHub PR Review Times

Analyze pull request review performance across your GitHub repositories. Track review times, identify bottlenecks, and visualize trends with beautiful charts.

## 🎯 [View Live Demo](./demo/report.html)

See a fully-featured example report with sample data from two repositories. [Demo Documentation](./demo/README.md)

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
python gh_pr_times.py --repos owner/repo

# Multiple repositories
python gh_pr_times.py --repos org/repo1 org/repo2 org/repo3
```

This creates CSV files in `./data/` directory (one per repo).

**Run the same command again** - it automatically resumes and fetches only new PRs!

### 4. Analyze & Visualize

```bash
# Analyzes all CSV files in ./data automatically
python analyze_pr_times.py

# On Windows, if you see encoding errors:
$env:PYTHONIOENCODING='utf-8'; python analyze_pr_times.py
```

Results:
- **HTML Report**: `./analytics/report.html` - Open in your browser for a beautiful, comprehensive report
- **Multi-Repository Support**: Automatically detects multiple CSV files and generates:
  - Combined "All Repositories" view with aggregated statistics
  - Individual sections for each repository with dedicated charts
- **Time Period Analysis**: Overall, Last Quarter (90 days), and Last 30 Days for each repository
- **Per-Repository Charts**: Each repository gets its own trend and distribution charts
- **Per-Developer Stats**: Shows developers across all repositories with combined metrics

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

**HTML Report** (`./analytics/report.html`):
- 🎨 Beautiful, professional web report you can share with your team
- 📊 **Three Time Periods**: Overall, Last Quarter (90 days), and Last 30 Days
- 📈 Each period includes:
  - Summary statistics (PR counts, merge rates)
  - Time metrics (review time, merge time, review→merge time)
  - Trend indicators (improving/declining with visual badges)
  - Interactive charts (trends over time, distribution histograms)
- 👥 **Per-Developer Stats**: Detailed table and charts showing individual performance
- 📱 **Responsive Design**: Works perfectly on desktop, tablet, and mobile

**Generated Charts** (embedded in HTML, also saved separately):
- `trends_overall.png`, `trends_last_quarter.png`, `trends_last_30_days.png` - Time series with trend lines
- `distributions_overall.png`, `distributions_last_quarter.png`, `distributions_last_30_days.png` - Histograms
- `per_developer_stats.png` - Per-developer comparison bars

## Common Usage Patterns

### Daily/Weekly Updates

Run the same commands to update with only new PRs:

```bash
# Fetch new PRs (automatic incremental update)
python gh_pr_times.py --repos owner/repo

# Regenerate analytics
python analyze_pr_times.py
```

### Multiple Repositories

Analyze across your entire team:

```bash
# Fetch from all repos
python gh_pr_times.py --repos \
  org/frontend \
  org/backend \
  org/api \
  org/mobile

# Analyze all repos combined
python analyze_pr_times.py
```

### Date Range Filtering

Get PRs from specific time period:

```bash
python gh_pr_times.py --repos owner/repo \
  --since 2025-01-01 \
  --until 2025-03-31
```

### Handling Timeouts

If the script times out, just run it again:

```bash
# First run - times out after 237 PRs
python gh_pr_times.py --repos owner/repo --timeout 60 --retries 5

# Run again - automatically continues from PR #238!
python gh_pr_times.py --repos owner/repo --timeout 60 --retries 5
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
| `--output-dir` | `./analytics` | Output directory for charts |
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

1. **Time to First Review** (creation → first review)
   - How long until someone first reviews the PR
   - Example: 14 hours = ~14 hours until first review appears

2. **Time to Merge** (creation → merge)
   - Total time from PR creation until it's merged
   - Example: 44 hours = ~1.8 days total PR lifetime

3. **Review → Merge Time** (first review → merge)
   - Time from first review to actual merge
   - Calculated as: Time to Merge - Time to First Review
   - Example: 30 hours = after first review, takes another ~30 hours to merge
   - This includes: additional review rounds, code changes, CI/CD, approvals, etc.

### Why PRs Take Longer to Merge Than First Review

Even if first review happens quickly (e.g., 14 hours), total merge time is longer (e.g., 44 hours) because:
- Multiple rounds of review and feedback
- Code changes and updates
- CI/CD pipeline runs
- Waiting for final approval
- Coordination and scheduling

This is **normal and healthy** for quality code review! Quick first review shows responsiveness, while additional time ensures thorough review.

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
python gh_pr_times.py --repos owner/repo
```

**Timeout errors:**
```bash
# Increase timeout and retries
python gh_pr_times.py --repos owner/repo --timeout 60 --retries 5

# If it times out, just run the same command again
```

**Rate limit errors:**
- Script automatically waits for rate limit reset
- GitHub allows 5,000 requests/hour for authenticated requests
- Add `--sleep 0.5` to slow down requests

**Emoji encoding errors (Windows):**
```powershell
# Set UTF-8 encoding before running
$env:PYTHONIOENCODING='utf-8'; python analyze_pr_times.py
```

## Files & Directories

```
pr-review-times/
├── data/                          # CSV files (one per repo)
│   ├── owner_repo.csv
│   └── org_project.csv
├── analytics/                     # Generated reports and charts
│   ├── report.html                # 📄 Main HTML report (open this!)
│   ├── trends_overall.png         # Charts for all time periods
│   ├── trends_last_quarter.png
│   ├── trends_last_30_days.png
│   ├── distributions_overall.png
│   ├── distributions_last_quarter.png
│   ├── distributions_last_30_days.png
│   └── per_developer_stats.png
├── gh_pr_times.py                 # Data fetching script
├── analyze_pr_times.py            # Analytics & visualization
├── requirements.txt               # Python dependencies
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
python gh_pr_times.py --repos your-org/your-repo
python analyze_pr_times.py
```

2. **Create gh-pages branch:**
```bash
git checkout --orphan gh-pages
git rm -rf .
```

3. **Copy report files:**
```bash
cp -r analytics/* .
git add .
git commit -m "Add PR analytics report"
git push origin gh-pages
```

4. **Enable GitHub Pages:**
   - Go to your repository Settings → Pages
   - Select `gh-pages` branch as source
   - Your report will be available at: `https://your-username.github.io/your-repo/report.html`

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
          python gh_pr_times.py --repos your-org/your-repo
          python analyze_pr_times.py
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./analytics
```

## Notes

- **Incremental by default**: Always resumes from latest PR automatically
- **Crash-safe**: Data written immediately, not at the end
- **Multi-repo safe**: Each repo gets its own CSV file
- **Reviews vs Comments**: "Time to first review" tracks submitted reviews, not PR comments
- **Private repos**: Token needs `repo` scope (not just `public_repo`)
- **Demo available**: Check out the [live demo](./demo/report.html) with sample data

## License

Provided as-is for analyzing GitHub PR metrics.
