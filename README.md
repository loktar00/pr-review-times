
# GitHub PR Review Times

Analyze pull‑request review performance across GitHub repositories. Track review times, spot bottlenecks, and view trends in an HTML report.

## View Live Demo
[View Live Demo](https://loktar00.github.io/pr-review-times/)

## What It Does
The toolkit fetches PR data from GitHub and produces an HTML report with analytics.

### HTML Report
- Shareable web page with all PR metrics
- Views for Overall, Last Quarter, and Last 30 Days
- Interactive charts, mobile‑responsive layout

### Statistics
- Avg/median time to first review
- Avg/median time to merge
- Review → merge breakdown
- Per‑developer performance
- PR counts, merge rates, completion stats

### Visual Charts
- Review time trends
- Per‑developer comparison
- Distribution histograms
- Separate charts for each time period

### Key Features
- Multi‑repo support with combined and individual views
- Time‑period analysis (Overall, Last Quarter, Last 30 Days)
- Automatic resume: existing data is detected and fetching continues
- Crash‑safe: data saved as it is fetched
- One CSV per repo, one report section per repo
- Auto‑retry with exponential backoff
- Dedicated charts per repository plus combined views

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Set up GitHub token
```bash
cp env.example .env
```
Edit `.env` and add:
```
GITHUB_TOKEN=ghp_yourTokenHere
```
Create a token at <https://github.com/settings/tokens> with `repo` scope.

### 3. Fetch PR data
```bash
# Single repository
python scripts/gh_pr_times.py --repos owner/repo

# Multiple repositories
python scripts/gh_pr_times.py --repos org/repo1 org/repo2 org/repo3
```
CSV files appear in `./data/` (one per repo). Running the command again resumes automatically.

### 4. Analyze & visualize
```bash
python scripts/analyze_pr_times.py
# Windows encoding fix:
$env:PYTHONIOENCODING='utf-8'; python scripts/analyze_pr_times.py
```
Open `web/index.html` in a browser. No server required.

## Output Overview

### CSV Files (`./data/`)
| Column | Description |
|--------|-------------|
| `repo` | Repository name |
| `number` | PR number |
| `title` | PR title |
| `url` | Direct link |
| `author` | GitHub username |
| `draft` | Draft flag |
| `created_at` | Creation timestamp |
| `closed_at` | Closed timestamp |
| `merged_at` | Merge timestamp |
| `additions` | Lines added |
| `deletions` | Lines removed |
| `changed_files` | Files changed |
| `commits` | Commit count |
| `reviews_count` | Review count |
| `first_review_at` | First review timestamp |
| `time_to_first_review_hours` | Hours to first review |
| `time_to_merge_hours` | Hours to merge |
| `open_time_hours` | Hours open (if not merged) |

### HTML Report (`web/index.html`)
- Sidebar navigation for combined and per‑repo views
- Tabs for Weekly, 30‑day, Quarter, and Overall periods
- Global developer stats
- Summary stats, time metrics, trend indicators, interactive charts
- Responsive design works on desktop and mobile

### Generated Data (`./report/`)
- `report-data.json` – all statistics in JSON
- `*_trends_*.png` – time‑series charts
- `*_distributions_*.png` – histograms
- Directory is git‑ignored

## Common Usage Patterns

### Daily / Weekly updates
```bash
python scripts/gh_pr_times.py --repos owner/repo
python scripts/analyze_pr_times.py
```

### Multiple repositories
```bash
python scripts/gh_pr_times.py --repos \
  org/frontend \
  org/backend \
  org/api \
  org/mobile
python scripts/analyze_pr_times.py
```

### Date range filtering
```bash
python scripts/gh_pr_times.py --repos owner/repo \
  --since 2025-01-01 --until 2025-03-31
```

### Handling timeouts
```bash
python scripts/gh_pr_times.py --repos owner/repo --timeout 60 --retries 5
# Run again to resume
python scripts/gh_pr_times.py --repos owner/repo --timeout 60 --retries 5
```

## Command‑Line Options

### `gh_pr_times.py`
| Option | Default | Description |
|--------|---------|-------------|
| `--repos` | *required* | Space‑separated list of repositories |
| `--out-dir` | `./data` | Output directory |
| `--since` | none | Include PRs created on/after this date (YYYY‑MM‑DD) |
| `--until` | none | Include PRs created before this date |
| `--state` | `all` | `open`, `closed`, or `all` |
| `--timeout` | `30` | HTTP timeout (seconds) |
| `--retries` | `3` | Retry count for failed requests |
| `--sleep` | `0` | Seconds to pause between API calls |
| `--force-full-refresh` | off | Ignore existing data and fetch everything |

### `analyze_pr_times.py`
| Option | Default | Description |
|--------|---------|-------------|
| `--input` | auto | Specific CSV to analyze |
| `--data-dir` | `./data` | Directory with CSV files |
| `--output-dir` | `./report` | Directory for generated files |
| `--min-prs` | `3` | Minimum PRs required for per‑developer stats |

## Understanding the Metrics

### Time to First Review
Hours from PR creation to the first submitted review (not just comments). Indicates team responsiveness.

### Time to Merge
Total hours from creation to merge. Includes review, revisions, CI, approvals.

### Review → Merge
`Time to Merge` minus `Time to First Review`. Shows how long the PR sits after the first review.

### Bot Reviews
Automated reviewers appear as the first review, driving the “time to first review” down to minutes. The real human cycle is reflected in the Review → Merge metric.

## Troubleshooting

- **No CSV files:** Run the fetch script first.
- **Timeout errors:** Increase `--timeout` and `--retries`.
- **Rate limits:** Script waits for reset; add `--sleep 0.5` to slow down.
- **Windows emoji errors:** Set `PYTHONIOENCODING='utf-8'` before running the analysis script.

## Requirements
- Python 3.7+
- GitHub Personal Access Token with `repo` scope
- Packages: `requests`, `python-dotenv`, `tqdm`, `matplotlib`, `numpy`, `scipy`

## Hosting on GitHub Pages

```bash
# Generate report
python scripts/gh_pr_times.py --repos your-org/your-repo
python scripts/analyze_pr_times.py

# Create gh-pages branch
git checkout --orphan gh-pages
git rm -rf .

# Copy files
cp -r web/* .
cp -r report report
git add index.html app.js styles.css report/
git commit -m "Add PR analytics report"
git push origin gh-pages
```
Enable Pages in repository settings, source = `gh-pages`. The report will be available at `https://your-username.github.io/your-repo/`.

## Automation (GitHub Actions)

This repository includes two GitHub Actions workflows for automated PR analytics:

### Included Workflows

#### `fetch-pr-data.yml` - Automated Data Collection
- Runs daily at 8 AM Eastern (13:00 UTC)
- Fetches PR data from configured repositories
- Generates updated analysis report
- Commits changes back to the repository
- Can be triggered manually via workflow_dispatch

#### `deploy-pages.yml` - GitHub Pages Deployment
- Triggers on pushes to main (when web/, report/, or data/ change)
- Triggers after successful fetch-pr-data workflow
- Deploys the report to GitHub Pages
- Can be triggered manually

### Required Secrets

To use these workflows, configure the following secrets in your repository settings (Settings → Secrets and variables → Actions):

| Secret | Description |
|--------|-------------|
| `GH_PAT` | GitHub Personal Access Token with `repo` scope. Required for accessing PR data from private repositories. |
| `PR_REPOS` | Space-separated list of repositories to analyze (e.g., `org/repo1 org/repo2`) |

### Setup Instructions

1. Fork this repository
2. Go to Settings → Secrets and variables → Actions
3. Add `GH_PAT` with a [Personal Access Token](https://github.com/settings/tokens) (repo scope)
4. Add `PR_REPOS` with your repositories (e.g., `myorg/frontend myorg/backend`)
5. Enable GitHub Pages (Settings → Pages → Source: GitHub Actions)
6. Run the "Fetch PR Data" workflow manually or wait for the daily schedule

### Manual Workflow Example

If you prefer to set up your own workflow instead of using the included ones:

```yaml
# .github/workflows/pr-analytics.yml
name: Update PR Analytics
on:
  schedule:
    - cron: '0 0 * * 0'  # weekly
  workflow_dispatch:
jobs:
  update:
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
          GITHUB_TOKEN: ${{ secrets.GH_PAT }}
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./web
```

## Notes
- Incremental fetching by default; resumes automatically.
- Data written immediately; crash‑safe.
- Separate CSV per repository; safe for multi‑repo analysis.
- “Time to first review” tracks submitted reviews, not comments.
- Private repos require `repo` scope on the token.
- Live demo available at the link above.

## License
Provided as‑is for analyzing GitHub PR metrics.