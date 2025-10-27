# Live Demo

This directory contains a **live demonstration** of the PR Review Time Analysis tool using sample data from two fictional repositories.

## 📊 View the Demo

**[Open the Demo Report](./report.html)** *(Right-click and "Open with Browser" or host on GitHub Pages)*

## 📝 Demo Data

The demonstration uses sample data from two example repositories:
- **example-org/frontend-app** - 25 Pull Requests from frontend development team
- **example-org/backend-api** - 25 Pull Requests from backend development team

Sample developers:
- Frontend: sarah-dev, mike-frontend, alex-ui
- Backend: john-backend, lisa-db, maria-api
- Bot: dependabot[bot]

## ✨ Features Demonstrated

### Multi-Repository Support
- **Combined "All Repositories" view** showing aggregated statistics across both repos
- **Individual repository sections** with dedicated analysis for each repo

### Time Period Analysis
Each repository includes analysis for:
- **Overall**: Complete history of all PRs
- **Last Quarter (90 Days)**: Quarterly performance trends
- **Last 30 Days**: Recent/current sprint metrics

### Visualizations
- **Trend Charts**: Review and merge times over time with trend lines
- **Distribution Histograms**: Show typical vs outlier PR times
- **Per-Developer Statistics**: Individual contributor metrics

### Metrics Tracked
- Time to First Review (creation → first review)
- Time to Merge (creation → merge)
- Review → Merge Time (first review → merge)
- PR counts, merge rates, and developer performance

## 🎯 Use Cases Shown

1. **Team Performance**: See how review times vary across repositories
2. **Individual Metrics**: Compare developer performance with clear visualizations
3. **Trend Analysis**: Identify if review processes are improving or degrading
4. **Multi-Repo Insights**: Understand team-wide patterns across multiple projects

## 🚀 How to Use This Demo

### Local Viewing
Simply open `report.html` in any web browser to see the full interactive report.

### GitHub Pages Hosting
1. Create a `gh-pages` branch
2. Copy the `demo/` folder contents to the root
3. Enable GitHub Pages in repository settings
4. Access at: `https://your-username.github.io/your-repo/`

## 📁 Contents

```
demo/
├── report.html                                    # Main HTML report
├── all_trends_overall.png                        # Combined view charts
├── all_trends_last_quarter.png
├── all_trends_last_30_days.png
├── all_distributions_overall.png
├── all_distributions_last_quarter.png
├── all_distributions_last_30_days.png
├── all_per_developer_stats.png
├── example-org_backend-api_trends_*.png          # Backend repo charts
├── example-org_backend-api_distributions_*.png
├── example-org_backend-api_per_developer_stats.png
├── example-org_frontend-app_trends_*.png         # Frontend repo charts
├── example-org_frontend-app_distributions_*.png
└── example-org_frontend-app_per_developer_stats.png
```

---

*This demo uses fictional data for demonstration purposes only.*

