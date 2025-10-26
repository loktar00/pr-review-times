# GitHub PR Review Times

Analyze pull request review performance across your GitHub repositories. Track review times, identify bottlenecks, and visualize trends with beautiful charts.

## What This Does

This toolkit fetches PR data from GitHub and generates:

**📊 Statistics:**
- Average and median time to first review
- Average and median time to merge
- Per-developer performance metrics
- Total PR counts and completion rates

**📈 Visual Charts:**
- Review time trends over time (are you improving or slowing down?)
- Per-developer comparison charts
- Distribution histograms showing typical vs outlier PRs

**🎯 Key Features:**
- **Automatic resume**: Detects existing data and continues from where you left off
- **Crash-safe**: Data saved as it's fetched - resume after timeouts/errors
- **Per-repo files**: Each repository gets its own CSV file
- **Auto-retry**: Network errors automatically retried with exponential backoff
- **Multi-repo analysis**: Combines multiple repos for team-wide insights

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
```

Results:
- Statistics printed to console
- Charts saved to `./analytics/` directory

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

**Console Statistics:**
```
📊 PR REVIEW TIME ANALYSIS
────────────────────────────────────────────────────────────
Total PRs:              1,109
  └─ Merged:            950
  └─ Open:              159

Time to First Review:
  └─ Average:           5.2 hours (0.2 days)
  └─ Median:            0.5 hours (0.0 days)

Time to Merge:
  └─ Average:           48.3 hours (2.0 days)
  └─ Median:            24.1 hours (1.0 days)

TRENDS
────────────────────────────────────────────────────────────
Review Time Trend:      🟢 DECREASING
  └─ Change per month:  -0.5 hours

Merge Time Trend:       🔴 INCREASING
  └─ Change per month:  +2.3 hours

PER DEVELOPER STATISTICS
────────────────────────────────────────────────────────────
alice:
  └─ PRs:               142
  └─ Avg Review Time:   0.8 hours
  └─ Avg Merge Time:    35.2 hours
...
```

**Visual Charts (`./analytics/`):**
- `trends_over_time.png` - Review/merge times over time with trend lines
- `per_developer_stats.png` - Bar charts comparing developers
- `distributions.png` - Histograms of review and merge time distributions

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
├── analytics/                     # Generated charts
│   ├── trends_over_time.png
│   ├── per_developer_stats.png
│   └── distributions.png
├── gh_pr_times.py                 # Data fetching script
├── analyze_pr_times.py            # Analytics & visualization
├── requirements.txt               # Python dependencies
└── .env                           # GitHub token (create this)
```

## Requirements

- Python 3.7+
- GitHub Personal Access Token
- Dependencies: `requests`, `python-dotenv`, `tqdm`, `matplotlib`, `numpy`, `scipy`

## Notes

- **Incremental by default**: Always resumes from latest PR automatically
- **Crash-safe**: Data written immediately, not at the end
- **Multi-repo safe**: Each repo gets its own CSV file
- **Reviews vs Comments**: "Time to first review" tracks submitted reviews, not PR comments
- **Private repos**: Token needs `repo` scope (not just `public_repo`)

## License

Provided as-is for analyzing GitHub PR metrics.
