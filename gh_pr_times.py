#!/usr/bin/env python3
"""
gh_pr_times.py

Fetch PR timing metrics from one or more GitHub repositories and export to CSV.

Metrics captured:
- created_at, closed_at, merged_at
- time_to_merge_hours
- reviews_count
- first_review_at
- time_to_first_review_hours
- open_time_hours (if not merged)
- additions, deletions, changed_files, commits
- author, draft status, PR title, PR URL

Usage:
  1. Create a .env file with: GITHUB_TOKEN=ghp_yourtokenhere
  2. Run: python gh_pr_times.py --repos org1/repo1 org2/repo2 --since 2025-01-01 --until 2025-10-21 --out pr_times.csv

Notes:
- The script uses the GitHub REST API v3.
- It paginates PRs and reviews.
- "Time to first review" is based on the earliest submitted review, not comments.
- Token can also be set via GITHUB_TOKEN or GH_TOKEN environment variable.
"""

import argparse
import csv
import os
import sys
import time
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Tuple

import requests
from dotenv import load_dotenv
from tqdm import tqdm

# Load environment variables from .env file
load_dotenv()

# Constants
ISO_FORMAT = "%Y-%m-%d"
API_ROOT = "https://api.github.com"
DEFAULT_RETRIES = 3
DEFAULT_TIMEOUT = 30.0
PER_PAGE_LIMIT = 100

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Export PR timing metrics from GitHub repos to CSV")
    p.add_argument("--repos", nargs="+", required=True, help="List of repos as owner/repo")
    p.add_argument("--since", type=str, default=None, help="Only include PRs created on or after this date YYYY-MM-DD")
    p.add_argument("--until", type=str, default=None, help="Only include PRs created before this date YYYY-MM-DD")
    p.add_argument("--state", type=str, default="all", choices=["open", "closed", "all"], help="PR state filter")
    p.add_argument("--out-dir", type=str, default="./data", help="Output directory for CSV files (default: ./data)")
    p.add_argument("--sleep", type=float, default=0.0, help="Optional sleep seconds between API calls")
    p.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT, help="HTTP timeout seconds (increase if you get timeout errors)")
    p.add_argument("--retries", type=int, default=DEFAULT_RETRIES, help="Number of retries for failed requests")
    p.add_argument("--force-full-refresh", action="store_true", help="Force full refresh, ignore existing data")
    return p.parse_args()

def get_token() -> str:
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token:
        print("Error: Please set GITHUB_TOKEN or GH_TOKEN in your environment.", file=sys.stderr)
        sys.exit(1)
    return token

def dt_from_iso8601(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)

def hours_between(a: Optional[datetime], b: Optional[datetime]) -> Optional[float]:
    if not a or not b:
        return None
    delta = b - a
    return round(delta.total_seconds() / 3600.0, 2)

def within_range(created_at: datetime, since_dt: Optional[datetime], until_dt: Optional[datetime]) -> bool:
    if since_dt and created_at < since_dt:
        return False
    if until_dt and created_at >= until_dt:
        return False
    return True

def _calculate_backoff(attempt: int) -> int:
    """Calculate exponential backoff wait time in seconds."""
    return (attempt + 1) * 2  # 2s, 4s, 6s, etc.

def gh_get(session: requests.Session, url: str, token: str, params: Dict = None, timeout: float = DEFAULT_TIMEOUT, retries: int = DEFAULT_RETRIES) -> requests.Response:
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "gh-pr-times-script"
    }

    for attempt in range(retries):
        try:
            resp = session.get(url, headers=headers, params=params or {}, timeout=timeout)

            # Handle rate limiting
            if resp.status_code == 403 and "rate limit" in resp.text.lower():
                reset = resp.headers.get("x-ratelimit-reset")
                if reset:
                    try:
                        wait_for = max(0, int(reset) - int(time.time())) + 1
                        print(f"⏳ Rate limited. Sleeping {wait_for}s until reset...", file=sys.stderr)
                        time.sleep(wait_for)
                        resp = session.get(url, headers=headers, params=params or {}, timeout=timeout)
                    except Exception:
                        pass

            # Handle server errors with retry
            if resp.status_code >= 500 and attempt < retries - 1:
                wait_time = _calculate_backoff(attempt)
                print(f"⚠️  Server error {resp.status_code}. Retrying in {wait_time}s... (attempt {attempt + 1}/{retries})", file=sys.stderr)
                time.sleep(wait_time)
                continue

            resp.raise_for_status()
            return resp

        except requests.exceptions.Timeout:
            if attempt < retries - 1:
                wait_time = _calculate_backoff(attempt)
                print(f"⚠️  Request timeout. Retrying in {wait_time}s... (attempt {attempt + 1}/{retries})", file=sys.stderr)
                time.sleep(wait_time)
                continue
            else:
                raise
        except requests.exceptions.RequestException as e:
            if attempt < retries - 1:
                wait_time = _calculate_backoff(attempt)
                print(f"⚠️  Request error: {e}. Retrying in {wait_time}s... (attempt {attempt + 1}/{retries})", file=sys.stderr)
                time.sleep(wait_time)
                continue
            else:
                raise

    raise requests.exceptions.HTTPError(f"Failed after {retries} attempts")

def paginate(session: requests.Session, url: str, token: str, params: Dict, timeout: float, sleep_s: float, retries: int = DEFAULT_RETRIES) -> Iterable[List[Dict]]:
    page = 1
    while True:
        q = dict(params or {})
        q["page"] = page
        q["per_page"] = PER_PAGE_LIMIT
        resp = gh_get(session, url, token, q, timeout=timeout, retries=retries)
        items = resp.json()
        if not isinstance(items, list):
            raise RuntimeError(f"Unexpected response for pagination at {url}: {items}")
        if not items:
            break
        yield items
        page += 1
        if sleep_s > 0:
            time.sleep(sleep_s)

def fetch_reviews(session: requests.Session, token: str, owner: str, repo: str, pr_number: int, timeout: float, sleep_s: float, retries: int = DEFAULT_RETRIES) -> List[Dict]:
    url = f"{API_ROOT}/repos/{owner}/{repo}/pulls/{pr_number}/reviews"
    all_reviews: List[Dict] = []
    for batch in paginate(session, url, token, {}, timeout, sleep_s, retries):
        all_reviews.extend(batch)
    return all_reviews

def fetch_issue_comments(session: requests.Session, token: str, owner: str, repo: str, pr_number: int, timeout: float, sleep_s: float, retries: int = DEFAULT_RETRIES) -> List[Dict]:
    """Fetch issue comments (comments on the PR conversation)."""
    url = f"{API_ROOT}/repos/{owner}/{repo}/issues/{pr_number}/comments"
    all_comments: List[Dict] = []
    for batch in paginate(session, url, token, {}, timeout, sleep_s, retries):
        all_comments.extend(batch)
    return all_comments

def fetch_review_comments(session: requests.Session, token: str, owner: str, repo: str, pr_number: int, timeout: float, sleep_s: float, retries: int = DEFAULT_RETRIES) -> List[Dict]:
    """Fetch review comments (inline code review comments)."""
    url = f"{API_ROOT}/repos/{owner}/{repo}/pulls/{pr_number}/comments"
    all_comments: List[Dict] = []
    for batch in paginate(session, url, token, {}, timeout, sleep_s, retries):
        all_comments.extend(batch)
    return all_comments

def fetch_prs(session: requests.Session, token: str, owner: str, repo: str, state: str, timeout: float, sleep_s: float, retries: int = DEFAULT_RETRIES) -> Iterable[Dict]:
    url = f"{API_ROOT}/repos/{owner}/{repo}/pulls"
    params = {"state": state, "sort": "created", "direction": "desc"}
    for batch in paginate(session, url, token, params, timeout, sleep_s, retries):
        for pr in batch:
            yield pr

def enrich_pr(session: requests.Session, token: str, owner: str, repo: str, pr_number: int, timeout: float, retries: int = DEFAULT_RETRIES) -> Dict:
    # Pull the full PR details for counts like additions, deletions, changed_files, commits
    url = f"{API_ROOT}/repos/{owner}/{repo}/pulls/{pr_number}"
    resp = gh_get(session, url, token, timeout=timeout, retries=retries)
    return resp.json()

def count_prs(session: requests.Session, token: str, owner: str, repo: str, state: str,
              since_dt: Optional[datetime], until_dt: Optional[datetime], timeout: float, sleep_s: float, retries: int = DEFAULT_RETRIES) -> int:
    """Count total PRs that match the criteria without fetching full details."""
    count = 0
    for pr in fetch_prs(session, token, owner, repo, state, timeout, sleep_s, retries):
        created_at = dt_from_iso8601(pr.get("created_at"))
        if not created_at:
            continue
        if not within_range(created_at, since_dt, until_dt):
            if since_dt and created_at < since_dt:
                break
            continue
        count += 1
    return count

def get_csv_filename(owner: str, repo: str, out_dir: str) -> str:
    """Generate CSV filename for a specific repo."""
    # Sanitize repo name for filesystem
    safe_name = f"{owner}_{repo}".replace("/", "_").replace("\\", "_")
    csv_filename = f"{safe_name}.csv"

    # Ensure output directory exists
    os.makedirs(out_dir, exist_ok=True)

    return os.path.join(out_dir, csv_filename)

def load_existing_csv(csv_path: str, repo_key: str) -> Tuple[List[Dict], Optional[datetime], set]:
    """Load existing CSV data and find latest PR date and already-processed PRs for this specific repo."""
    existing_rows = []
    latest_date = None
    processed_prs = set()  # Set of PR numbers

    if not os.path.exists(csv_path):
        return existing_rows, latest_date, processed_prs

    try:
        with open(csv_path, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing_rows.append(row)

                # Only track PRs for this specific repo
                if row.get("repo") == repo_key:
                    # Track which PRs we've already processed
                    number = row.get("number")
                    if number:
                        processed_prs.add(str(number))

                    # Track latest creation date
                    created_at = dt_from_iso8601(row.get("created_at"))
                    if created_at:
                        if latest_date is None or created_at > latest_date:
                            latest_date = created_at
    except Exception as e:
        print(f"⚠️  Warning: Could not read existing CSV: {e}", file=sys.stderr)

    return existing_rows, latest_date, processed_prs

def main() -> None:
    args = parse_args()
    token = get_token()
    since_dt = datetime.strptime(args.since, ISO_FORMAT).replace(tzinfo=timezone.utc) if args.since else None
    until_dt = datetime.strptime(args.until, ISO_FORMAT).replace(tzinfo=timezone.utc) if args.until else None

    # Print job summary
    print("=" * 60, file=sys.stderr)
    print("🚀 GitHub PR Review Times Analyzer", file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    print(f"Repositories: {', '.join(args.repos)}", file=sys.stderr)
    print(f"State filter: {args.state}", file=sys.stderr)
    if since_dt:
        print(f"Since: {args.since}", file=sys.stderr)
    if until_dt:
        print(f"Until: {args.until}", file=sys.stderr)
    print(f"Output directory: {args.out_dir}", file=sys.stderr)
    print(f"Mode: {'Full Refresh (ignoring existing data)' if args.force_full_refresh else 'Auto-Resume (smart incremental)'}", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    session = requests.Session()

    fieldnames = [
        "repo", "number", "title", "url", "author", "draft",
        "created_at", "closed_at", "merged_at",
        "additions", "deletions", "changed_files", "commits",
        "reviews_count", "first_review_at", "time_to_first_review_hours",
        "time_to_merge_hours", "open_time_hours",
        "comments_count", "comment_authors", "approvals_count", "approval_authors"
    ]

    for repo_full in args.repos:
        if "/" not in repo_full:
            print(f"Skipping invalid repo identifier: {repo_full}", file=sys.stderr)
            continue
        owner, repo = repo_full.split("/", 1)
        repo_key = f"{owner}/{repo}"

        # Generate CSV filename for this repo
        out_path = get_csv_filename(owner, repo, args.out_dir)
        file_exists = os.path.exists(out_path)

        # Load existing data to check what we already have
        existing_rows = []
        latest_date = None
        processed_prs = set()

        if file_exists and not args.force_full_refresh:
            print(f"\n📂 Loading existing data from {out_path}...", file=sys.stderr)
            existing_rows, latest_date, processed_prs = load_existing_csv(out_path, repo_key)
            if existing_rows:
                print(f"✓ Found {len(existing_rows)} existing PRs", file=sys.stderr)
                if latest_date:
                    print(f"  └─ Latest PR: {latest_date.strftime('%Y-%m-%d %H:%M')}", file=sys.stderr)
                    print(f"  └─ Will fetch only newer PRs", file=sys.stderr)

        # Determine the effective "since" date (latest of user-provided or latest in file)
        effective_since_dt = since_dt
        if latest_date and not args.force_full_refresh:
            # Resume from latest PR date
            if since_dt is None or latest_date > since_dt:
                effective_since_dt = latest_date

        # Count total PRs first
        print(f"\n📊 Counting new PRs in {owner}/{repo}...", file=sys.stderr)
        total_prs = count_prs(session, token, owner, repo, args.state, effective_since_dt, until_dt, args.timeout, args.sleep, args.retries)
        print(f"✓ Found {total_prs} new PRs to process", file=sys.stderr)

        if total_prs == 0:
            print(f"⚠️  No new PRs found. Skipping.", file=sys.stderr)
            continue

        # Open CSV file (append if exists and not forcing refresh, otherwise write new)
        append_mode = file_exists and not args.force_full_refresh
        mode = "a" if append_mode else "w"
        csv_file = open(out_path, mode, newline="", encoding="utf-8")
        csv_writer = csv.DictWriter(csv_file, fieldnames=fieldnames)

        if append_mode:
            print(f"📝 Appending to {out_path}", file=sys.stderr)
        else:
            csv_writer.writeheader()
            print(f"📝 Creating new file {out_path}", file=sys.stderr)

        new_prs_count = 0
        skipped_prs_count = 0

        # Process PRs with progress bar
        pbar = tqdm(total=total_prs, desc=f"Processing {owner}/{repo}", unit="PR", file=sys.stderr)

        try:
            for pr in fetch_prs(session, token, owner, repo, args.state, args.timeout, args.sleep, args.retries):
                created_at = dt_from_iso8601(pr.get("created_at"))
                if not created_at:
                    continue
                if not within_range(created_at, effective_since_dt, until_dt):
                    # Stop early if results are in descending created order and we went past the since date
                    if effective_since_dt and created_at < effective_since_dt:
                        break
                    continue

                pr_number = pr.get("number")

                # Skip if we've already processed this PR
                if str(pr_number) in processed_prs:
                    skipped_prs_count += 1
                    pbar.update(1)
                    continue

                merged_at = dt_from_iso8601(pr.get("merged_at"))
                closed_at = dt_from_iso8601(pr.get("closed_at"))

                pr_url = pr.get("html_url")
                author = (pr.get("user") or {}).get("login")
                title = pr.get("title") or ""
                draft = bool(pr.get("draft"))

                # Update progress bar with current PR info
                pbar.set_postfix_str(f"PR #{pr_number}: {title[:40]}{'...' if len(title) > 40 else ''}")

                try:
                    # Enrich to get size stats
                    full = enrich_pr(session, token, owner, repo, pr_number, args.timeout, args.retries)
                    additions = full.get("additions")
                    deletions = full.get("deletions")
                    changed_files = full.get("changed_files")
                    commits = full.get("commits")

                    # Reviews
                    reviews = fetch_reviews(session, token, owner, repo, pr_number, args.timeout, args.sleep, args.retries)
                    reviews_count = len(reviews)
                    first_review_at = None
                    if reviews:
                        try:
                            first_review_at = min(
                                (dt_from_iso8601(r.get("submitted_at")) for r in reviews if r.get("submitted_at")),
                                default=None
                            )
                        except Exception:
                            first_review_at = None

                    # Approvals (from reviews with state APPROVED)
                    approvals = [r for r in reviews if r.get("state") == "APPROVED"]
                    approvals_count = len(approvals)
                    approval_authors = list(set((r.get("user") or {}).get("login") for r in approvals if (r.get("user") or {}).get("login")))
                    approval_authors_str = ",".join(sorted(approval_authors))

                    # Comments (both issue comments and review comments)
                    issue_comments = fetch_issue_comments(session, token, owner, repo, pr_number, args.timeout, args.sleep, args.retries)
                    review_comments = fetch_review_comments(session, token, owner, repo, pr_number, args.timeout, args.sleep, args.retries)
                    all_comments = issue_comments + review_comments
                    comments_count = len(all_comments)

                    # Count comments per author
                    comment_counts_by_author = {}
                    for comment in all_comments:
                        author_login = (comment.get("user") or {}).get("login")
                        if author_login:
                            comment_counts_by_author[author_login] = comment_counts_by_author.get(author_login, 0) + 1

                    # Format as "author:count,author:count"
                    comment_authors_str = ",".join(f"{author}:{count}" for author, count in sorted(comment_counts_by_author.items()))

                    time_to_first_review_hours = hours_between(created_at, first_review_at)
                    time_to_merge_hours = hours_between(created_at, merged_at)
                    open_time_hours = None
                    if merged_at is None:
                        # If still open, measure time from creation to now
                        # If closed but not merged, measure creation to closed
                        now = datetime.now(timezone.utc)
                        end = closed_at or now
                        open_time_hours = hours_between(created_at, end)

                    # Write row immediately to CSV
                    row = {
                        "repo": repo_key,
                        "number": pr_number,
                        "title": title,
                        "url": pr_url,
                        "author": author,
                        "draft": draft,
                        "created_at": created_at.isoformat(),
                        "closed_at": closed_at.isoformat() if closed_at else "",
                        "merged_at": merged_at.isoformat() if merged_at else "",
                        "additions": additions,
                        "deletions": deletions,
                        "changed_files": changed_files,
                        "commits": commits,
                        "reviews_count": reviews_count,
                        "first_review_at": first_review_at.isoformat() if first_review_at else "",
                        "time_to_first_review_hours": time_to_first_review_hours if time_to_first_review_hours is not None else "",
                        "time_to_merge_hours": time_to_merge_hours if time_to_merge_hours is not None else "",
                        "open_time_hours": open_time_hours if open_time_hours is not None else "",
                        "comments_count": comments_count,
                        "comment_authors": comment_authors_str,
                        "approvals_count": approvals_count,
                        "approval_authors": approval_authors_str,
                    }
                    csv_writer.writerow(row)
                    csv_file.flush()  # Ensure data is written to disk
                    new_prs_count += 1

                except Exception as e:
                    print(f"\n⚠️  Error processing PR #{pr_number}: {e}", file=sys.stderr)
                    print(f"   Skipping this PR and continuing...", file=sys.stderr)

                pbar.update(1)

        except KeyboardInterrupt:
            print(f"\n\n⚠️  Interrupted by user. Partial data has been saved.", file=sys.stderr)
            pbar.close()
            csv_file.close()
            sys.exit(1)
        except Exception as e:
            print(f"\n\n❌ Error: {e}", file=sys.stderr)
            print(f"   Partial data has been saved to {out_path}", file=sys.stderr)
            pbar.close()
            csv_file.close()
            sys.exit(1)

        pbar.close()

        # Close the CSV file for this repo
        csv_file.close()

        # Print summary for this repo
        print(f"\n✓ Completed {owner}/{repo}", file=sys.stderr)
        total_in_file = len(existing_rows) + new_prs_count
        if file_exists and not args.force_full_refresh:
            print(f"  └─ Added {new_prs_count} new PRs", file=sys.stderr)
            if skipped_prs_count > 0:
                print(f"  └─ Skipped {skipped_prs_count} already-processed PRs", file=sys.stderr)
            print(f"  └─ Total PRs in {out_path}: {total_in_file}", file=sys.stderr)
        else:
            print(f"  └─ Wrote {new_prs_count} PRs to {out_path}", file=sys.stderr)

    # Final summary
    print("\n" + "=" * 60, file=sys.stderr)
    print(f"✅ All repositories processed!", file=sys.stderr)
    print(f"   CSV files saved in: {args.out_dir}", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

if __name__ == "__main__":
    main()
