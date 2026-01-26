// ========================================
// Theme Management
// ========================================
function initializeTheme() {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggle(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeToggle(newTheme);
    updateChartsTheme(newTheme);
}

function updateThemeToggle(theme) {
    const toggleButton = document.getElementById('theme-toggle');
    if (!toggleButton) return;

    const icon = toggleButton.querySelector('.theme-toggle-icon');

    if (theme === 'dark') {
        icon.setAttribute('data-lucide', 'sun');
        toggleButton.setAttribute('title', 'Switch to Light Mode');
    } else {
        icon.setAttribute('data-lucide', 'moon');
        toggleButton.setAttribute('title', 'Switch to Dark Mode');
    }

    // Reinitialize icons after change
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function createThemeToggle() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const toggleButton = document.createElement('button');
    toggleButton.className = 'theme-toggle';
    toggleButton.id = 'theme-toggle';
    toggleButton.setAttribute('aria-label', 'Toggle theme');
    toggleButton.setAttribute('title', currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');

    const icon = document.createElement('i');
    icon.className = 'theme-toggle-icon';
    icon.setAttribute('data-lucide', currentTheme === 'dark' ? 'sun' : 'moon');

    toggleButton.appendChild(icon);
    toggleButton.addEventListener('click', toggleTheme);

    return toggleButton;
}

// Initialize theme on load
initializeTheme();

// ========================================
// Global State
// ========================================
let reportData = null;
let currentRepoId = 'overall';
let excludedUsers = new Set();
let filteredData = null;
let chartInstances = [];

// ========================================
// Chart Management
// ========================================
function destroyCharts() {
    chartInstances.forEach(chart => {
        try {
            chart.destroy();
        } catch (e) {
            // Chart may already be destroyed
        }
    });
    chartInstances = [];
}

function getChartColors() {
    return [
        '#2563eb', // blue
        '#10b981', // emerald
        '#f59e0b', // amber
        '#ef4444', // red
        '#8b5cf6', // violet
        '#06b6d4', // cyan
        '#f97316', // orange
        '#84cc16', // lime
        '#ec4899', // pink
        '#6366f1'  // indigo
    ];
}

function getChartTheme() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    return {
        mode: theme,
        foreColor: theme === 'dark' ? '#e2e8f0' : '#1e293b',
        background: 'transparent'
    };
}

function updateChartsTheme(theme) {
    const foreColor = theme === 'dark' ? '#e2e8f0' : '#1e293b';
    chartInstances.forEach(chart => {
        try {
            chart.updateOptions({
                theme: { mode: theme },
                chart: {
                    foreColor: foreColor,
                    background: 'transparent'
                },
                grid: {
                    borderColor: theme === 'dark' ? '#334155' : '#e2e8f0'
                },
                xaxis: {
                    labels: { style: { colors: foreColor } },
                    axisBorder: { color: theme === 'dark' ? '#475569' : '#cbd5e1' },
                    axisTicks: { color: theme === 'dark' ? '#475569' : '#cbd5e1' }
                },
                yaxis: {
                    labels: { style: { colors: foreColor } }
                }
            });
        } catch (e) {
            // Chart may not support all options
        }
    });
}

// Utility functions
function hoursToDays(hours) {
    return (hours / 24).toFixed(1);
}

function getPRSize(pr, config) {
    const additions = parseFloat(pr.additions) || 0;
    const deletions = parseFloat(pr.deletions) || 0;
    const totalChanges = additions + deletions;

    if (totalChanges < config.pr_size_small) return 'small';
    if (totalChanges < config.pr_size_medium) return 'medium';
    return 'large';
}

function parseCommentCounts(commentStr) {
    if (!commentStr) return {};
    const result = {};
    commentStr.split(',').forEach(item => {
        const [author, count] = item.split(':');
        if (author && count) {
            result[author.trim()] = parseInt(count.trim()) || 0;
        }
    });
    return result;
}

function parseAuthorList(authorStr) {
    if (!authorStr) return [];
    return authorStr.split(',').map(a => a.trim()).filter(a => a);
}

function filterPR(pr) {
    if (excludedUsers.size === 0) return true;
    if (excludedUsers.has(pr.author)) return false;
    return true;
}

function filterCommentCounts(commentStr) {
    if (excludedUsers.size === 0) return commentStr;

    const counts = parseCommentCounts(commentStr);
    const filtered = {};

    for (const [author, count] of Object.entries(counts)) {
        if (!excludedUsers.has(author)) {
            filtered[author] = count;
        }
    }

    return Object.entries(filtered)
        .map(([author, count]) => `${author}:${count}`)
        .join(',');
}

function filterApprovalAuthors(authorStr) {
    if (excludedUsers.size === 0) return authorStr;
    const authors = parseAuthorList(authorStr);
    const filtered = authors.filter(a => !excludedUsers.has(a));
    return filtered.join(',');
}

function formatTime(hours) {
    if (hours === null || hours === undefined) return 'N/A';
    return `${hours.toFixed(1)}h (${hoursToDays(hours)}d)`;
}

function formatPercentage(value, total) {
    if (!total) return '0.0';
    return ((value / total) * 100).toFixed(1);
}

function formatNumber(num) {
    if (num === null || num === undefined) return 'N/A';
    if (Math.abs(num) >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (Math.abs(num) >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
}

// ========================================
// Chart Data Aggregation Functions
// ========================================

function getAggregationPeriod(periodKey) {
    return periodKey === 'last_7_days' ? 'day' : 'week';
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function formatDateKey(date, aggregation) {
    const d = new Date(date);
    if (aggregation === 'day') {
        return d.toISOString().split('T')[0];
    } else {
        const weekStart = getWeekStart(d);
        return weekStart.toISOString().split('T')[0];
    }
}

function aggregateCodeChangesByDeveloper(prs, periodKey) {
    const aggregation = getAggregationPeriod(periodKey);
    const dataByDateAndDev = {};
    const developers = new Set();

    prs.forEach(pr => {
        if (!pr.merged_at) return; // Only count merged PRs

        const date = pr.merged_at || pr.created_at;
        if (!date) return;

        const dateKey = formatDateKey(date, aggregation);
        const author = pr.author || 'unknown';
        const additions = parseFloat(pr.additions) || 0;
        const deletions = parseFloat(pr.deletions) || 0;
        const totalChanges = additions + deletions;

        developers.add(author);

        if (!dataByDateAndDev[dateKey]) {
            dataByDateAndDev[dateKey] = {};
        }
        if (!dataByDateAndDev[dateKey][author]) {
            dataByDateAndDev[dateKey][author] = { total: 0, additions: 0, deletions: 0 };
        }
        dataByDateAndDev[dateKey][author].total += totalChanges;
        dataByDateAndDev[dateKey][author].additions += additions;
        dataByDateAndDev[dateKey][author].deletions += deletions;
    });

    const sortedDates = Object.keys(dataByDateAndDev).sort();
    const devArray = Array.from(developers);

    // Sort developers by total contributions (descending to get top 10)
    const devTotals = {};
    devArray.forEach(dev => {
        devTotals[dev] = 0;
        sortedDates.forEach(date => {
            if (dataByDateAndDev[date][dev]) {
                devTotals[dev] += dataByDateAndDev[date][dev].total;
            }
        });
    });
    devArray.sort((a, b) => devTotals[b] - devTotals[a]);

    // Take top 10 contributors - in stacked charts, earlier series form the baseline
    const topDevs = devArray.slice(0, 10);

    const series = topDevs.map(dev => ({
        name: dev,
        data: sortedDates.map(date => {
            const devData = dataByDateAndDev[date][dev] || { total: 0, additions: 0, deletions: 0 };
            return {
                x: new Date(date).getTime(),
                y: devData.total,
                additions: devData.additions,
                deletions: devData.deletions
            };
        })
    }));

    return { categories: sortedDates, series };
}

function aggregateReviewTimesByDeveloper(prs, outlierCap = 200) {
    // Calculate 95th percentile
    const reviewTimes = prs
        .map(pr => parseFloat(pr.time_to_first_review_hours))
        .filter(t => !isNaN(t) && t !== null);

    if (reviewTimes.length === 0) {
        return { categories: [], series: [] };
    }

    reviewTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(reviewTimes.length * 0.95);
    const p95 = reviewTimes[p95Index] || outlierCap;
    const cap = Math.min(p95, outlierCap);

    const dataByDev = {};
    const developers = new Set();

    prs.forEach(pr => {
        const reviewTime = parseFloat(pr.time_to_first_review_hours);
        if (isNaN(reviewTime) || reviewTime === null || reviewTime > cap) return;

        const date = pr.created_at;
        if (!date) return;

        const author = pr.author || 'unknown';
        developers.add(author);

        if (!dataByDev[author]) {
            dataByDev[author] = [];
        }
        dataByDev[author].push({
            x: new Date(date).getTime(),
            y: reviewTime,
            title: pr.title,
            number: pr.number
        });
    });

    const devArray = Array.from(developers);

    // Sort by number of data points
    devArray.sort((a, b) => (dataByDev[b]?.length || 0) - (dataByDev[a]?.length || 0));

    const series = devArray.slice(0, 10).map(dev => ({
        name: dev,
        data: (dataByDev[dev] || []).sort((a, b) => a.x - b.x)
    }));

    return { series };
}

function aggregatePRVelocity(prs, periodKey) {
    const dataByWeekAndDev = {};
    const developers = new Set();

    prs.forEach(pr => {
        if (!pr.merged_at) return;

        const date = pr.merged_at;
        const weekKey = formatDateKey(date, 'week');
        const author = pr.author || 'unknown';

        developers.add(author);

        if (!dataByWeekAndDev[weekKey]) {
            dataByWeekAndDev[weekKey] = {};
        }
        dataByWeekAndDev[weekKey][author] = (dataByWeekAndDev[weekKey][author] || 0) + 1;
    });

    const sortedWeeks = Object.keys(dataByWeekAndDev).sort();
    const devArray = Array.from(developers);

    // Sort by total PRs
    const devTotals = {};
    devArray.forEach(dev => {
        devTotals[dev] = 0;
        sortedWeeks.forEach(week => {
            devTotals[dev] += dataByWeekAndDev[week][dev] || 0;
        });
    });
    devArray.sort((a, b) => devTotals[b] - devTotals[a]);

    const series = devArray.slice(0, 10).map(dev => ({
        name: dev,
        data: sortedWeeks.map(week => ({
            x: new Date(week).getTime(),
            y: dataByWeekAndDev[week][dev] || 0
        }))
    }));

    return { categories: sortedWeeks, series };
}

// ========================================
// Chart Rendering Functions
// ========================================

function renderCodeChangesChart(containerId, data, theme) {
    if (!data.series || data.series.length === 0) return null;

    const themeConfig = getChartTheme();
    const options = {
        chart: {
            type: 'line',
            height: 350,
            foreColor: themeConfig.foreColor,
            background: 'transparent',
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    selection: true,
                    zoom: true,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                    reset: true
                }
            },
            animations: { enabled: true }
        },
        colors: getChartColors(),
        series: data.series,
        stroke: { curve: 'smooth', width: 3 },
        markers: {
            size: 5,
            hover: { size: 7 }
        },
        xaxis: {
            type: 'datetime',
            labels: {
                style: { colors: themeConfig.foreColor },
                datetimeFormatter: {
                    year: 'yyyy',
                    month: "MMM 'yy",
                    day: 'dd MMM',
                    hour: 'HH:mm'
                }
            },
            axisBorder: { color: theme === 'dark' ? '#475569' : '#cbd5e1' },
            axisTicks: { color: theme === 'dark' ? '#475569' : '#cbd5e1' }
        },
        yaxis: {
            title: { text: 'Lines Changed', style: { color: themeConfig.foreColor } },
            labels: {
                style: { colors: themeConfig.foreColor },
                formatter: (val) => formatNumber(val)
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'left',
            labels: { colors: themeConfig.foreColor }
        },
        grid: {
            borderColor: theme === 'dark' ? '#334155' : '#e2e8f0'
        },
        tooltip: {
            shared: true,
            intersect: false,
            theme: theme,
            custom: function({ series, seriesIndex, dataPointIndex, w }) {
                const data = w.config.series;
                let html = '<div class="apexcharts-tooltip-custom" style="padding: 8px;">';

                // Date header
                const timestamp = w.globals.seriesX[0][dataPointIndex];
                const date = new Date(timestamp).toLocaleDateString();
                html += `<div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">${date}</div>`;

                // Each series
                data.forEach((s, i) => {
                    if (s.data[dataPointIndex] && s.data[dataPointIndex].y > 0) {
                        const point = s.data[dataPointIndex];
                        const color = w.globals.colors[i];
                        html += `<div style="margin: 4px 0;">
                            <span style="color: ${color}; font-weight: bold;">${s.name}</span>:
                            ${formatNumber(point.y)}
                            <span style="color: #10b981;">(+${formatNumber(point.additions || 0)})</span>
                            <span style="color: #ef4444;">(-${formatNumber(point.deletions || 0)})</span>
                        </div>`;
                    }
                });

                html += '</div>';
                return html;
            }
        },
        dataLabels: { enabled: false }
    };

    const container = document.getElementById(containerId);
    if (!container) return null;

    const chart = new ApexCharts(container, options);
    chart.render();
    chartInstances.push(chart);
    return chart;
}

function renderReviewTimesChart(containerId, data, theme) {
    if (!data.series || data.series.length === 0) return null;

    const themeConfig = getChartTheme();
    const options = {
        chart: {
            type: 'scatter',
            height: 350,
            foreColor: themeConfig.foreColor,
            background: 'transparent',
            toolbar: { show: true },
            animations: { enabled: true },
            zoom: { enabled: true, type: 'xy' }
        },
        colors: getChartColors(),
        series: data.series,
        xaxis: {
            type: 'datetime',
            labels: {
                style: { colors: themeConfig.foreColor },
                datetimeFormatter: {
                    year: 'yyyy',
                    month: "MMM 'yy",
                    day: 'dd MMM'
                }
            },
            axisBorder: { color: theme === 'dark' ? '#475569' : '#cbd5e1' },
            axisTicks: { color: theme === 'dark' ? '#475569' : '#cbd5e1' }
        },
        yaxis: {
            title: { text: 'Hours to First Review', style: { color: themeConfig.foreColor } },
            labels: {
                style: { colors: themeConfig.foreColor },
                formatter: (val) => val.toFixed(1) + 'h'
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'left',
            labels: { colors: themeConfig.foreColor }
        },
        grid: {
            borderColor: theme === 'dark' ? '#334155' : '#e2e8f0'
        },
        tooltip: {
            shared: false,
            theme: theme,
            custom: function({ seriesIndex, dataPointIndex, w }) {
                const point = w.config.series[seriesIndex].data[dataPointIndex];
                const author = w.config.series[seriesIndex].name;
                const color = w.globals.colors[seriesIndex];
                const date = new Date(point.x).toLocaleDateString();

                return `<div style="padding: 8px;">
                    <div style="font-weight: bold; color: ${color};">${author}</div>
                    <div>PR #${point.number || 'N/A'}</div>
                    <div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${point.title || ''}</div>
                    <div style="margin-top: 4px;">
                        <strong>${point.y.toFixed(1)} hours</strong> to first review
                    </div>
                    <div style="color: #888; font-size: 0.9em;">${date}</div>
                </div>`;
            }
        },
        markers: {
            size: 6,
            hover: { size: 8 }
        }
    };

    const container = document.getElementById(containerId);
    if (!container) return null;

    const chart = new ApexCharts(container, options);
    chart.render();
    chartInstances.push(chart);
    return chart;
}

function renderPRVelocityChart(containerId, data, theme) {
    if (!data.series || data.series.length === 0) return null;

    const themeConfig = getChartTheme();
    const options = {
        chart: {
            type: 'line',
            height: 350,
            foreColor: themeConfig.foreColor,
            background: 'transparent',
            toolbar: { show: true },
            animations: { enabled: true }
        },
        colors: getChartColors(),
        series: data.series,
        stroke: { curve: 'smooth', width: 3 },
        markers: {
            size: 5,
            hover: { size: 7 }
        },
        xaxis: {
            type: 'datetime',
            labels: {
                style: { colors: themeConfig.foreColor },
                datetimeFormatter: {
                    year: 'yyyy',
                    month: "MMM 'yy",
                    day: 'dd MMM'
                }
            },
            axisBorder: { color: theme === 'dark' ? '#475569' : '#cbd5e1' },
            axisTicks: { color: theme === 'dark' ? '#475569' : '#cbd5e1' }
        },
        yaxis: {
            title: { text: 'PRs Merged', style: { color: themeConfig.foreColor } },
            labels: {
                style: { colors: themeConfig.foreColor },
                formatter: (val) => Math.round(val)
            },
            min: 0
        },
        legend: {
            position: 'top',
            horizontalAlign: 'left',
            labels: { colors: themeConfig.foreColor }
        },
        grid: {
            borderColor: theme === 'dark' ? '#334155' : '#e2e8f0'
        },
        tooltip: {
            shared: true,
            intersect: false,
            theme: theme,
            x: { format: 'dd MMM yyyy' },
            y: { formatter: (val) => val + ' PRs' }
        }
    };

    const container = document.getElementById(containerId);
    if (!container) return null;

    const chart = new ApexCharts(container, options);
    chart.render();
    chartInstances.push(chart);
    return chart;
}

function createChartSection(title, iconName, chartId) {
    const section = cloneTemplate('chart-section-template');
    const titleEl = section.querySelector('.chart-title');
    titleEl.appendChild(createIcon(iconName, 20));
    titleEl.appendChild(document.createTextNode(title));

    const wrapper = section.querySelector('.chart-wrapper');
    wrapper.id = chartId;

    return section;
}

function formatNumberWithSign(num) {
    if (num === null || num === undefined) return 'N/A';
    const sign = num >= 0 ? '+' : '';
    return sign + formatNumber(num);
}

function calculatePRSizes(prs) {
    const sizes = { small: 0, medium: 0, large: 0 };
    prs.forEach(pr => {
        const size = getPRSize(pr, reportData.config);
        sizes[size]++;
    });
    return sizes;
}

function calculateCommentMetrics(prs) {
    let totalComments = 0;
    const commentsByAuthor = {};

    prs.forEach(pr => {
        const commentCounts = parseCommentCounts(filterCommentCounts(pr.comment_authors || ''));
        for (const [author, count] of Object.entries(commentCounts)) {
            totalComments += count;
            commentsByAuthor[author] = (commentsByAuthor[author] || 0) + count;
        }
    });

    return { totalComments, commentsByAuthor };
}

function calculateApprovalMetrics(prs) {
    const approvalsByAuthor = {};
    let totalApprovals = 0;

    prs.forEach(pr => {
        const approvalAuthors = parseAuthorList(filterApprovalAuthors(pr.approval_authors || ''));
        approvalAuthors.forEach(author => {
            approvalsByAuthor[author] = (approvalsByAuthor[author] || 0) + 1;
            totalApprovals++;
        });
    });

    return { totalApprovals, approvalsByAuthor };
}

function getPRsForPeriod(repoName, periodKey) {
    if (!reportData.raw_prs) return [];

    // Handle combined "All Repositories" view
    let prs;
    if (repoName === 'All Repositories') {
        prs = [];
        for (const repoPRs of Object.values(reportData.raw_prs)) {
            prs = prs.concat(repoPRs);
        }
    } else {
        if (!reportData.raw_prs[repoName]) return [];
        prs = reportData.raw_prs[repoName];
    }

    const periodInfo = reportData.time_periods[periodKey];

    let filtered = prs.filter(pr => filterPR(pr));

    if (periodInfo.days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - periodInfo.days);

        filtered = filtered.filter(pr => {
            const createdAt = new Date(pr.created_at);
            return createdAt >= cutoffDate;
        });
    }

    return filtered;
}

function getDataDirectory() {
    // Detect if we're in web/ subdirectory (development) or at root (production/gh-pages)
    const isInWebDir = window.location.pathname.includes('/web/');
    return isInWebDir ? '../report' : 'report';
}

// Icon helper function
function createIcon(iconName, size = 16) {
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    icon.style.width = `${size}px`;
    icon.style.height = `${size}px`;
    icon.style.display = 'inline-block';
    icon.style.verticalAlign = 'middle';
    icon.style.marginRight = '8px';
    return icon;
}

// Initialize Lucide icons after DOM updates
function initIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Create heading with icon
function createHeading(tag, text, iconName, size = 20) {
    const heading = document.createElement(tag);
    heading.appendChild(createIcon(iconName, size));
    const headingText = document.createTextNode(text);
    heading.appendChild(headingText);
    return heading;
}

// Template helper functions
function cloneTemplate(templateId) {
    const template = document.getElementById(templateId);
    return template.content.cloneNode(true);
}

function createNavItem(repo, isActive) {
    const navItem = cloneTemplate('nav-item-template');
    const item = navItem.querySelector('.nav-item');
    const iconName = repo.is_combined ? 'bar-chart-2' : 'folder';

    item.classList.toggle('active', isActive);
    item.onclick = () => switchRepository(repo.repo_id);

    const titleElement = item.querySelector('.nav-item-title');
    titleElement.innerHTML = '';
    titleElement.appendChild(createIcon(iconName, 16));
    const titleText = document.createTextNode(repo.repo_name);
    titleElement.appendChild(titleText);

    item.querySelector('.nav-item-meta').textContent = `${repo.total_prs} PRs`;

    return navItem;
}

function createStatCard(label, value, subText = '', variantClass = '') {
    const card = cloneTemplate('stat-card-template');
    const cardDiv = card.querySelector('.stat-card');

    if (variantClass) cardDiv.classList.add(variantClass);

    cardDiv.querySelector('.stat-label').textContent = label;
    cardDiv.querySelector('.stat-value').textContent = value;

    const subElement = cardDiv.querySelector('.stat-sub');
    if (subText) {
        subElement.textContent = subText;
    } else {
        subElement.remove();
    }

    return card;
}

function createStatCardWithExtraInfo(label, value, subText, extraText, variantClass = '') {
    const card = createStatCard(label, value, subText, variantClass);
    const cardDiv = card.querySelector('.stat-card');

    const extraElement = document.createElement('div');
    extraElement.className = 'stat-sub stat-sub-extra';
    extraElement.textContent = extraText;
    cardDiv.appendChild(extraElement);

    return card;
}

function createFilterTag(username) {
    const tag = cloneTemplate('filter-tag-template');
    tag.querySelector('.filter-tag-name').textContent = username;
    tag.querySelector('.filter-tag-remove').onclick = () => removeExcludedUser(username);
    return tag;
}

function createTabButton(periodKey, periodInfo, hasData) {
    const button = cloneTemplate('tab-button-template');
    const btn = button.querySelector('.tab-button');

    btn.textContent = periodInfo.name;
    btn.id = `tab-btn-${periodKey}`;
    btn.onclick = () => switchTab(periodKey);
    if (!hasData) btn.classList.add('no-data');

    return button;
}

function createDevTableRow(author, stats) {
    const row = cloneTemplate('dev-table-row-template');
    const tr = row.querySelector('tr');

    const reviewTime = formatTime(stats.avg_review_time);
    const mergeTime = formatTime(stats.avg_merge_time);
    const reviewToMerge = (stats.avg_review_time && stats.avg_merge_time)
        ? formatTime(stats.avg_merge_time - stats.avg_review_time)
        : 'N/A';

    const nameCell = tr.querySelector('.dev-name');
    const strong = document.createElement('strong');
    strong.textContent = author;
    nameCell.appendChild(strong);

    tr.querySelector('.dev-pr-count').textContent = stats.pr_count;
    tr.querySelector('.dev-review-time').textContent = reviewTime;
    tr.querySelector('.dev-merge-time').textContent = mergeTime;
    tr.querySelector('.dev-review-to-merge').textContent = reviewToMerge;

    return row;
}

function createCommenterRow(author, count, totalComments, totalPRs) {
    const row = cloneTemplate('commenter-row-template');
    const tr = row.querySelector('tr');

    const nameCell = tr.querySelector('.commenter-name');
    const strong = document.createElement('strong');
    strong.textContent = author;
    nameCell.appendChild(strong);

    tr.querySelector('.commenter-count').textContent = count;
    tr.querySelector('.commenter-percentage').textContent = `${formatPercentage(count, totalComments)}%`;
    tr.querySelector('.commenter-avg').textContent = (count / totalPRs).toFixed(1);

    return row;
}

function createApproverRow(author, count, totalApprovals) {
    const row = cloneTemplate('approver-row-template');
    const tr = row.querySelector('tr');

    const nameCell = tr.querySelector('.approver-name');
    const strong = document.createElement('strong');
    strong.textContent = author;
    nameCell.appendChild(strong);

    tr.querySelector('.approver-count').textContent = count;
    tr.querySelector('.approver-percentage').textContent = `${formatPercentage(count, totalApprovals)}%`;

    return row;
}

function createPRRow(pr, config) {
    const row = cloneTemplate('pr-row-template');
    const tr = row.querySelector('tr');

    const size = getPRSize(pr, config);
    const status = pr.merged_at ? '✅ Merged' : pr.closed_at ? '❌ Closed' : '🔄 Open';
    const createdDate = new Date(pr.created_at).toLocaleDateString();

    const numberCell = tr.querySelector('.pr-number');
    const link = document.createElement('a');
    link.href = pr.url;
    link.target = '_blank';
    link.className = 'pr-link';
    link.textContent = `#${pr.number}`;
    numberCell.appendChild(link);

    tr.querySelector('.pr-title').textContent = pr.title;
    tr.querySelector('.pr-author').textContent = pr.author;

    const sizeCell = tr.querySelector('.pr-size');
    const sizeSpan = document.createElement('span');
    sizeSpan.className = `pr-size-${size}`;
    sizeSpan.textContent = size;
    sizeCell.appendChild(sizeSpan);

    tr.querySelector('.pr-status').textContent = status;
    tr.querySelector('.pr-created').textContent = createdDate;

    return row;
}

function createTrendItem(label, slope) {
    const item = cloneTemplate('trend-item-template');
    const direction = slope < 0 ? 'decreasing' : 'increasing';
    const emoji = slope < 0 ? '🟢' : '🔴';
    const changeHoursPerMonth = Math.abs(slope) * 30;
    const changeDaysPerMonth = changeHoursPerMonth / 24;

    item.querySelector('.trend-label').textContent = label;

    const indicator = item.querySelector('.trend-indicator');
    indicator.className = `trend-indicator ${direction}`;
    indicator.textContent = `${emoji} ${direction.toUpperCase()}`;

    // Show in days if >= 1 day, otherwise show in hours
    if (changeDaysPerMonth >= 1) {
        item.querySelector('.trend-change').textContent = `Change: ${changeDaysPerMonth.toFixed(1)} days/month`;
    } else {
        item.querySelector('.trend-change').textContent = `Change: ${changeHoursPerMonth.toFixed(1)} hrs/month`;
    }

    return item;
}

function createTable(headerTemplateId) {
    const table = document.createElement('table');
    table.className = 'dev-table';

    const header = cloneTemplate(headerTemplateId);
    table.appendChild(header);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    return table;
}

// Load JSON data
async function loadData() {
    try {
        const dataDir = getDataDirectory();
        const response = await fetch(`${dataDir}/report-data.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        reportData = await response.json();
        initializeApp();
    } catch (error) {
        const loadingDiv = document.getElementById('loading');
        loadingDiv.innerHTML = '';

        const errorState = cloneTemplate('error-state-template');
        errorState.querySelector('.error-message').textContent = error.message;
        loadingDiv.appendChild(errorState);

        console.error('Error loading data:', error);
    }
}

// Initialize the app
function initializeApp() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    renderSidebar();
    renderRepository(currentRepoId);
}

// Render sidebar navigation
function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'sidebar-header';


    const title = document.createElement('div');
    title.className = 'sidebar-title';
    title.appendChild(createIcon('bar-chart-3', 18));
    const titleText = document.createTextNode('PR Analytics');
    title.appendChild(titleText);
    header.appendChild(title);

    sidebar.appendChild(header);

    // Add theme toggle to header (before title)
    const themeToggle = createThemeToggle();
    header.appendChild(themeToggle);


    reportData.repositories.forEach(repo => {
        const isActive = repo.repo_id === currentRepoId;
        const navItem = createNavItem(repo, isActive);
        sidebar.appendChild(navItem);
    });

    initIcons();
}

// Switch repository view
function switchRepository(repoId) {
    currentRepoId = repoId;
    renderSidebar();
    renderRepository(repoId);
}

// Render global developer stats
function renderGlobalDevStats() {
    const statsSection = cloneTemplate('global-dev-stats-template');
    const tbody = statsSection.querySelector('.dev-stats-tbody');

    const sortedDevs = Object.entries(reportData.global_dev_stats)
        .sort((a, b) => b[1].pr_count - a[1].pr_count);

    sortedDevs.forEach(([author, stats]) => {
        const row = createDevTableRow(author, stats);
        tbody.appendChild(row);
    });

    initIcons();

    return statsSection;
}

// Render filter UI
function renderFilterUI() {
    const filterSection = cloneTemplate('filter-section-template');

    const input = filterSection.querySelector('.filter-input');
    const button = filterSection.querySelector('.filter-button');

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addExcludedUser();
    });

    button.addEventListener('click', addExcludedUser);

    if (excludedUsers.size > 0) {
        const tagsContainer = filterSection.querySelector('.filter-tags-container');
        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'filter-tags';

        Array.from(excludedUsers).forEach(user => {
            const tag = createFilterTag(user);
            tagsDiv.appendChild(tag);
        });

        tagsContainer.appendChild(tagsDiv);
    }

    initIcons();

    return filterSection;
}

// Add excluded user
function addExcludedUser() {
    const input = document.getElementById('exclude-user-input');
    const username = input.value.trim();

    if (username && !excludedUsers.has(username)) {
        excludedUsers.add(username);
        input.value = '';
        renderRepository(currentRepoId);
    }
}

// Remove excluded user
function removeExcludedUser(username) {
    excludedUsers.delete(username);
    renderRepository(currentRepoId);
}

// Render repository content
function renderRepository(repoId) {
    const repo = reportData.repositories.find(r => r.repo_id === repoId);
    if (!repo) return;

    // Destroy existing charts before re-rendering
    destroyCharts();

    const content = document.getElementById('content');
    content.innerHTML = '';

    content.appendChild(renderFilterUI());

    if (repo.is_combined && reportData.global_dev_stats && Object.keys(reportData.global_dev_stats).length > 0) {
        content.appendChild(renderGlobalDevStats());
    }

    const periodOrder = ['last_7_days', 'last_14_days', 'last_30_days', 'last_3_months', 'last_6_months', 'overall'];

    const tabNav = document.createElement('div');
    tabNav.className = 'tab-navigation';

    periodOrder.forEach(periodKey => {
        const periodInfo = reportData.time_periods[periodKey];
        const hasData = repo.period_stats[periodKey];
        const button = createTabButton(periodKey, periodInfo, hasData);
        tabNav.appendChild(button);
    });

    // Add custom range button
    const customBtn = document.createElement('button');
    customBtn.className = 'tab-button';
    customBtn.id = 'tab-btn-custom';
    customBtn.textContent = 'Custom Range';
    customBtn.addEventListener('click', () => {
        const customRange = document.getElementById('custom-date-range');
        if (customRange.style.display === 'none' || !customRange.style.display) {
            customRange.style.display = 'flex';
        } else {
            customRange.style.display = 'none';
        }
    });
    tabNav.appendChild(customBtn);

    content.appendChild(tabNav);

    // Custom date range inputs
    const customRange = document.createElement('div');
    customRange.id = 'custom-date-range';
    customRange.className = 'custom-date-range';
    customRange.style.display = 'none';

    const startLabel = document.createElement('label');
    startLabel.textContent = 'From: ';
    const startDate = document.createElement('input');
    startDate.type = 'date';
    startDate.id = 'custom-start-date';
    startDate.className = 'date-input';

    const endLabel = document.createElement('label');
    endLabel.textContent = 'To: ';
    const endDate = document.createElement('input');
    endDate.type = 'date';
    endDate.id = 'custom-end-date';
    endDate.className = 'date-input';

    // Set default dates
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    startDate.value = thirtyDaysAgo.toISOString().split('T')[0];
    endDate.value = today.toISOString().split('T')[0];

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.className = 'apply-date-btn';
    applyBtn.addEventListener('click', () => {
        renderCustomPeriod(repo.repo_id, startDate.value, endDate.value);
    });

    customRange.appendChild(startLabel);
    customRange.appendChild(startDate);
    customRange.appendChild(endLabel);
    customRange.appendChild(endDate);
    customRange.appendChild(applyBtn);

    content.appendChild(customRange);

    periodOrder.forEach(periodKey => {
        const periodStats = repo.period_stats[periodKey];
        const periodCharts = repo.period_charts[periodKey] || {};
        const periodContent = renderPeriodContent(periodKey, periodStats, periodCharts, repo.repo_id);
        content.appendChild(periodContent);
    });

    const firstPeriodWithData = periodOrder.find(p => repo.period_stats[p]);
    switchTab(firstPeriodWithData || periodOrder[0]);

    initIcons();
}

// Switch tab
function switchTab(periodKey) {
    // Update button states
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`tab-btn-${periodKey}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // Hide custom date range when switching to preset periods
    if (periodKey !== 'custom') {
        const customRange = document.getElementById('custom-date-range');
        if (customRange) customRange.style.display = 'none';
    }

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const tabContent = document.getElementById(`tab-content-${periodKey}`);
    if (tabContent) {
        tabContent.classList.add('active');
    }
}

// Store custom PRs for chart rendering
let customPeriodPRs = [];

// Render custom date range period
function renderCustomPeriod(repoId, startDateStr, endDateStr) {
    const repo = reportData.repositories.find(r => r.repo_id === repoId);
    if (!repo) return;

    // Remove existing custom tab content if any
    const existingCustom = document.getElementById('tab-content-custom');
    if (existingCustom) {
        existingCustom.remove();
    }

    // Get PRs for custom date range
    const repoName = repo.repo_name;

    // Parse dates properly (add time component to avoid timezone issues)
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T23:59:59');

    let allPRs;
    if (repoName === 'All Repositories') {
        allPRs = [];
        for (const repoPRs of Object.values(reportData.raw_prs)) {
            allPRs = allPRs.concat(repoPRs);
        }
    } else {
        allPRs = reportData.raw_prs[repoName] || [];
    }

    customPeriodPRs = allPRs.filter(pr => {
        if (!filterPR(pr)) return false;
        const createdAt = new Date(pr.created_at);
        return createdAt >= startDate && createdAt <= endDate;
    });

    console.log(`Custom period: ${startDateStr} to ${endDateStr}, found ${customPeriodPRs.length} PRs`);

    // Calculate stats for custom period
    const customStats = calculateCustomPeriodStats(customPeriodPRs, startDateStr, endDateStr);

    // Create and append custom tab content
    const content = document.getElementById('content');
    const customContent = renderCustomPeriodContent(customStats, repoId, startDateStr, endDateStr);
    content.appendChild(customContent);

    // Switch to custom tab
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab-btn-custom').classList.add('active');

    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-content-custom').classList.add('active');
}

// Render custom period content (similar to renderPeriodContent but uses customPeriodPRs)
function renderCustomPeriodContent(stats, repoId, startDateStr, endDateStr) {
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    tabContent.id = 'tab-content-custom';

    if (!stats) {
        const emptyState = cloneTemplate('empty-state-template');
        emptyState.querySelector('.empty-state-title').textContent = 'No PRs in Custom Range';
        emptyState.querySelector('.empty-state-message').textContent = `No pull requests found between ${startDateStr} and ${endDateStr}.`;
        tabContent.appendChild(emptyState);
        return tabContent;
    }

    const overall = stats.overall;
    const perDev = stats.per_dev;
    const trends = stats.trends;
    const delivery = stats.delivery;

    // Delivery Title
    const deliveryTitle = createHeading('h2', `${startDateStr} to ${endDateStr} - Delivery Metrics`, 'package', 24);
    tabContent.appendChild(deliveryTitle);

    // Delivery Stats Grid
    if (delivery) {
        const deliveryGrid = document.createElement('div');
        deliveryGrid.className = 'stats-grid delivery-grid';

        deliveryGrid.appendChild(createStatCard(
            'Lines Added',
            '+' + formatNumber(delivery.total_additions),
            `${delivery.prs_merged} PRs merged`,
            'stat-card-additions'
        ));

        deliveryGrid.appendChild(createStatCard(
            'Lines Removed',
            '-' + formatNumber(delivery.total_deletions),
            '',
            'stat-card-deletions'
        ));

        const netClass = delivery.net_change >= 0 ? 'stat-card-growth' : 'stat-card-reduction';
        deliveryGrid.appendChild(createStatCard(
            'Net Change',
            formatNumberWithSign(delivery.net_change),
            delivery.net_change >= 0 ? 'Codebase growth' : 'Codebase reduction',
            netClass
        ));

        deliveryGrid.appendChild(createStatCard(
            'Total Commits',
            formatNumber(delivery.total_commits),
            `Across ${delivery.prs_opened} PRs`,
            'info'
        ));

        tabContent.appendChild(deliveryGrid);

        // PR Status Grid
        const prStatusTitle = createHeading('h3', 'PR Status', 'git-pull-request', 20);
        tabContent.appendChild(prStatusTitle);

        const prStatusGrid = document.createElement('div');
        prStatusGrid.className = 'stats-grid';

        prStatusGrid.appendChild(createStatCard('PRs Opened', delivery.prs_opened, '', ''));
        prStatusGrid.appendChild(createStatCard(
            'PRs Merged',
            delivery.prs_merged,
            `${formatPercentage(delivery.prs_merged, delivery.prs_opened)}% merge rate`,
            'success'
        ));
        prStatusGrid.appendChild(createStatCard('PRs Closed', delivery.prs_closed, 'Without merge', 'warning'));
        prStatusGrid.appendChild(createStatCard('Still Open', overall.open_prs, '', 'info'));

        tabContent.appendChild(prStatusGrid);

        // Top Contributors
        if (delivery.per_developer && Object.keys(delivery.per_developer).length > 0) {
            const sortedContributors = Object.entries(delivery.per_developer)
                .sort((a, b) => b[1].additions - a[1].additions)
                .slice(0, 10);

            const contributorsTitle = createHeading('h3', 'Top Contributors by Code Volume', 'users', 20);
            tabContent.appendChild(contributorsTitle);

            const table = createTable('delivery-contributor-table-header-template');
            const tbody = table.querySelector('tbody');

            sortedContributors.forEach(([author, devStats]) => {
                const row = createDeliveryContributorRow(author, devStats);
                tbody.appendChild(row);
            });

            tabContent.appendChild(table);
        }
    }

    // Charts section using customPeriodPRs
    if (customPeriodPRs.length > 0) {
        const chartsTitle = createHeading('h2', 'Activity Charts', 'bar-chart-3', 24);
        tabContent.appendChild(chartsTitle);

        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        const chartContainerId = `chart-custom-${repoId.replace(/[^a-zA-Z0-9]/g, '')}`;

        const codeChangesData = aggregateCodeChangesByDeveloper(customPeriodPRs, 'custom');
        if (codeChangesData.series && codeChangesData.series.length > 0) {
            const codeChangesSection = createChartSection('Code Changes Over Time', 'git-commit', `${chartContainerId}-code`);
            tabContent.appendChild(codeChangesSection);
        }

        const reviewTimesData = aggregateReviewTimesByDeveloper(customPeriodPRs);
        if (reviewTimesData.series && reviewTimesData.series.length > 0) {
            const reviewTimesSection = createChartSection('Time to First Review', 'clock', `${chartContainerId}-review`);
            tabContent.appendChild(reviewTimesSection);
        }

        const velocityData = aggregatePRVelocity(customPeriodPRs, 'custom');
        if (velocityData.series && velocityData.series.length > 0) {
            const velocitySection = createChartSection('PR Velocity (Merged per Week)', 'trending-up', `${chartContainerId}-velocity`);
            tabContent.appendChild(velocitySection);
        }

        setTimeout(() => {
            if (codeChangesData.series && codeChangesData.series.length > 0) {
                renderCodeChangesChart(`${chartContainerId}-code`, codeChangesData, theme);
            }
            if (reviewTimesData.series && reviewTimesData.series.length > 0) {
                renderReviewTimesChart(`${chartContainerId}-review`, reviewTimesData, theme);
            }
            if (velocityData.series && velocityData.series.length > 0) {
                renderPRVelocityChart(`${chartContainerId}-velocity`, velocityData, theme);
            }
            initIcons();
        }, 100);
    }

    // Review metrics collapsible
    const reviewDetails = document.createElement('details');
    reviewDetails.className = 'review-metrics-details';

    const reviewSummary = document.createElement('summary');
    reviewSummary.className = 'review-metrics-summary';
    reviewSummary.innerHTML = '<i data-lucide="clock" style="width: 20px; height: 20px; display: inline-block; vertical-align: middle; margin-right: 8px;"></i>Review Time Metrics';
    reviewDetails.appendChild(reviewSummary);

    const reviewContent = document.createElement('div');
    reviewContent.className = 'review-metrics-content';

    if (overall.avg_review_time) {
        const reviewToMerge = overall.avg_merge_time - overall.avg_review_time;

        const timeGrid = document.createElement('div');
        timeGrid.className = 'stats-grid';

        timeGrid.appendChild(createStatCardWithExtraInfo(
            'Time to First Review',
            `${overall.avg_review_time.toFixed(1)}h`,
            `Avg: ${hoursToDays(overall.avg_review_time)} days | Median: ${overall.median_review_time.toFixed(1)}h`,
            'Creation → First Review Submission'
        ));

        timeGrid.appendChild(createStatCard(
            'Time to Merge',
            `${overall.avg_merge_time.toFixed(1)}h`,
            `Avg: ${hoursToDays(overall.avg_merge_time)} days | Median: ${overall.median_merge_time.toFixed(1)}h`
        ));

        timeGrid.appendChild(createStatCardWithExtraInfo(
            'Review → Merge Time',
            `${reviewToMerge.toFixed(1)}h`,
            `${hoursToDays(reviewToMerge)} days avg`,
            'First Review → Final Merge'
        ));

        reviewContent.appendChild(timeGrid);
    }

    if (perDev && Object.keys(perDev).length > 0) {
        const sortedDevs = Object.entries(perDev).sort((a, b) => b[1].pr_count - a[1].pr_count);

        const devTitle = createHeading('h3', 'Developer Review Performance', 'users', 20);
        reviewContent.appendChild(devTitle);

        const table = createTable('dev-table-header-template');
        const tbody = table.querySelector('tbody');

        sortedDevs.forEach(([author, devStats]) => {
            const row = createDevTableRow(author, devStats);
            tbody.appendChild(row);
        });

        reviewContent.appendChild(table);
    }

    reviewDetails.appendChild(reviewContent);
    tabContent.appendChild(reviewDetails);

    initIcons();
    return tabContent;
}

// Calculate stats for custom date range
function calculateCustomPeriodStats(prs, startDate, endDate) {
    if (prs.length === 0) return null;

    // Calculate overall stats
    const reviewTimes = prs.map(pr => parseFloat(pr.time_to_first_review_hours)).filter(t => !isNaN(t));
    const mergeTimes = prs.map(pr => parseFloat(pr.time_to_merge_hours)).filter(t => !isNaN(t));

    const mergedPRs = prs.filter(pr => pr.merged_at);
    const closedNotMerged = prs.filter(pr => pr.closed_at && !pr.merged_at);
    const openPRs = prs.filter(pr => !pr.closed_at);

    // Per-developer stats
    const devStats = {};
    prs.forEach(pr => {
        const author = pr.author || 'unknown';
        if (!devStats[author]) {
            devStats[author] = { pr_count: 0, review_times: [], merge_times: [] };
        }
        devStats[author].pr_count++;
        const rt = parseFloat(pr.time_to_first_review_hours);
        const mt = parseFloat(pr.time_to_merge_hours);
        if (!isNaN(rt)) devStats[author].review_times.push(rt);
        if (!isNaN(mt)) devStats[author].merge_times.push(mt);
    });

    const perDev = {};
    for (const [author, data] of Object.entries(devStats)) {
        if (data.pr_count >= 1) {
            perDev[author] = {
                pr_count: data.pr_count,
                avg_review_time: data.review_times.length > 0 ? data.review_times.reduce((a, b) => a + b, 0) / data.review_times.length : null,
                avg_merge_time: data.merge_times.length > 0 ? data.merge_times.reduce((a, b) => a + b, 0) / data.merge_times.length : null
            };
        }
    }

    // Delivery metrics
    let totalAdditions = 0, totalDeletions = 0, totalCommits = 0;
    const devDelivery = {};

    prs.forEach(pr => {
        const additions = parseFloat(pr.additions) || 0;
        const deletions = parseFloat(pr.deletions) || 0;
        const commits = parseFloat(pr.commits) || 0;
        const author = pr.author || 'unknown';

        totalAdditions += additions;
        totalDeletions += deletions;
        totalCommits += commits;

        if (!devDelivery[author]) {
            devDelivery[author] = { additions: 0, deletions: 0, commits: 0, prs_opened: 0, prs_merged: 0 };
        }
        devDelivery[author].additions += additions;
        devDelivery[author].deletions += deletions;
        devDelivery[author].commits += commits;
        devDelivery[author].prs_opened++;
        if (pr.merged_at) devDelivery[author].prs_merged++;
    });

    const perDevDelivery = {};
    for (const [author, data] of Object.entries(devDelivery)) {
        perDevDelivery[author] = {
            additions: data.additions,
            deletions: data.deletions,
            net_change: data.additions - data.deletions,
            commits: data.commits,
            prs_opened: data.prs_opened,
            prs_merged: data.prs_merged
        };
    }

    return {
        name: `${startDate} to ${endDate}`,
        pr_count: prs.length,
        overall: {
            total_prs: prs.length,
            merged_prs: mergedPRs.length,
            closed_not_merged_prs: closedNotMerged.length,
            open_prs: openPRs.length,
            avg_review_time: reviewTimes.length > 0 ? reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length : null,
            median_review_time: reviewTimes.length > 0 ? reviewTimes.sort((a, b) => a - b)[Math.floor(reviewTimes.length / 2)] : null,
            avg_merge_time: mergeTimes.length > 0 ? mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length : null,
            median_merge_time: mergeTimes.length > 0 ? mergeTimes.sort((a, b) => a - b)[Math.floor(mergeTimes.length / 2)] : null
        },
        per_dev: perDev,
        trends: { review_slope: null, merge_slope: null },
        delivery: {
            total_additions: totalAdditions,
            total_deletions: totalDeletions,
            net_change: totalAdditions - totalDeletions,
            total_commits: totalCommits,
            prs_opened: prs.length,
            prs_merged: mergedPRs.length,
            prs_closed: closedNotMerged.length,
            per_developer: perDevDelivery
        }
    };
}

// Create delivery contributor table row
function createDeliveryContributorRow(author, stats) {
    const row = cloneTemplate('delivery-contributor-row-template');
    const tr = row.querySelector('tr');

    const nameCell = tr.querySelector('.contributor-name');
    const strong = document.createElement('strong');
    strong.textContent = author;
    nameCell.appendChild(strong);

    const additionsCell = tr.querySelector('.contributor-additions');
    additionsCell.textContent = '+' + formatNumber(stats.additions);
    additionsCell.classList.add('delivery-additions');

    const deletionsCell = tr.querySelector('.contributor-deletions');
    deletionsCell.textContent = '-' + formatNumber(stats.deletions);
    deletionsCell.classList.add('delivery-deletions');

    tr.querySelector('.contributor-net').textContent = formatNumberWithSign(stats.net_change);
    tr.querySelector('.contributor-prs').textContent = stats.prs_merged;

    return row;
}

// Render period content
function renderPeriodContent(periodKey, stats, charts, repoId) {
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    tabContent.id = `tab-content-${periodKey}`;

    if (!stats) {
        const emptyState = cloneTemplate('empty-state-template');
        tabContent.appendChild(emptyState);
        return tabContent;
    }

    const overall = stats.overall;
    const perDev = stats.per_dev;
    const trends = stats.trends;
    const delivery = stats.delivery;

    // ========================================
    // DELIVERY METRICS SECTION (Primary)
    // ========================================

    // Delivery Overview Title
    const deliveryTitle = createHeading('h2', `${stats.name} - Delivery Metrics`, 'package', 24);
    tabContent.appendChild(deliveryTitle);

    // Delivery Stats Grid
    if (delivery) {
        const deliveryGrid = document.createElement('div');
        deliveryGrid.className = 'stats-grid delivery-grid';

        // Lines Added
        deliveryGrid.appendChild(createStatCard(
            'Lines Added',
            '+' + formatNumber(delivery.total_additions),
            `${delivery.prs_merged} PRs merged`,
            'stat-card-additions'
        ));

        // Lines Removed
        deliveryGrid.appendChild(createStatCard(
            'Lines Removed',
            '-' + formatNumber(delivery.total_deletions),
            '',
            'stat-card-deletions'
        ));

        // Net Change
        const netClass = delivery.net_change >= 0 ? 'stat-card-growth' : 'stat-card-reduction';
        deliveryGrid.appendChild(createStatCard(
            'Net Change',
            formatNumberWithSign(delivery.net_change),
            delivery.net_change >= 0 ? 'Codebase growth' : 'Codebase reduction',
            netClass
        ));

        // Total Commits
        deliveryGrid.appendChild(createStatCard(
            'Total Commits',
            formatNumber(delivery.total_commits),
            `Across ${delivery.prs_opened} PRs`,
            'info'
        ));

        tabContent.appendChild(deliveryGrid);

        // PR Status Grid
        const prStatusTitle = createHeading('h3', 'PR Status', 'git-pull-request', 20);
        tabContent.appendChild(prStatusTitle);

        const prStatusGrid = document.createElement('div');
        prStatusGrid.className = 'stats-grid';

        prStatusGrid.appendChild(createStatCard('PRs Opened', delivery.prs_opened, '', ''));
        prStatusGrid.appendChild(createStatCard(
            'PRs Merged',
            delivery.prs_merged,
            `${formatPercentage(delivery.prs_merged, delivery.prs_opened)}% merge rate`,
            'success'
        ));
        prStatusGrid.appendChild(createStatCard('PRs Closed', delivery.prs_closed, 'Without merge', 'warning'));
        prStatusGrid.appendChild(createStatCard('Still Open', overall.open_prs, '', 'info'));

        tabContent.appendChild(prStatusGrid);

        // Top Contributors by Code Volume
        if (delivery.per_developer && Object.keys(delivery.per_developer).length > 0) {
            const sortedContributors = Object.entries(delivery.per_developer)
                .sort((a, b) => b[1].additions - a[1].additions)
                .slice(0, 10);

            const contributorsTitle = createHeading('h3', 'Top Contributors by Code Volume', 'users', 20);
            tabContent.appendChild(contributorsTitle);

            const table = createTable('delivery-contributor-table-header-template');
            const tbody = table.querySelector('tbody');

            sortedContributors.forEach(([author, devStats]) => {
                const row = createDeliveryContributorRow(author, devStats);
                tbody.appendChild(row);
            });

            tabContent.appendChild(table);
        }
    }

    // ========================================
    // INTERACTIVE CHARTS SECTION
    // ========================================

    // Get raw PRs for charts
    const repoName = reportData.repositories.find(r => r.repo_id === repoId)?.repo_name;
    const chartPRs = repoName ? getPRsForPeriod(repoName, periodKey) : [];

    if (chartPRs.length > 0) {
        const chartsTitle = createHeading('h2', 'Activity Charts', 'bar-chart-3', 24);
        tabContent.appendChild(chartsTitle);

        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        const chartContainerId = `chart-${periodKey}-${repoId.replace(/[^a-zA-Z0-9]/g, '')}`;

        // Code Changes Chart
        const codeChangesData = aggregateCodeChangesByDeveloper(chartPRs, periodKey);
        if (codeChangesData.series && codeChangesData.series.length > 0) {
            const codeChangesSection = createChartSection('Code Changes Over Time', 'git-commit', `${chartContainerId}-code`);
            tabContent.appendChild(codeChangesSection);
        }

        // Review Times Chart
        const reviewTimesData = aggregateReviewTimesByDeveloper(chartPRs);
        if (reviewTimesData.series && reviewTimesData.series.length > 0) {
            const reviewTimesSection = createChartSection('Time to First Review', 'clock', `${chartContainerId}-review`);
            tabContent.appendChild(reviewTimesSection);
        }

        // PR Velocity Chart
        const velocityData = aggregatePRVelocity(chartPRs, periodKey);
        if (velocityData.series && velocityData.series.length > 0) {
            const velocitySection = createChartSection('PR Velocity (Merged per Week)', 'trending-up', `${chartContainerId}-velocity`);
            tabContent.appendChild(velocitySection);
        }

        // Render charts after DOM is ready
        setTimeout(() => {
            if (codeChangesData.series && codeChangesData.series.length > 0) {
                renderCodeChangesChart(`${chartContainerId}-code`, codeChangesData, theme);
            }
            if (reviewTimesData.series && reviewTimesData.series.length > 0) {
                renderReviewTimesChart(`${chartContainerId}-review`, reviewTimesData, theme);
            }
            if (velocityData.series && velocityData.series.length > 0) {
                renderPRVelocityChart(`${chartContainerId}-velocity`, velocityData, theme);
            }
            initIcons();
        }, 100);
    }

    // ========================================
    // REVIEW TIME METRICS SECTION (Collapsible)
    // ========================================

    const reviewDetails = document.createElement('details');
    reviewDetails.className = 'review-metrics-details';

    const reviewSummary = document.createElement('summary');
    reviewSummary.className = 'review-metrics-summary';
    reviewSummary.innerHTML = '<i data-lucide="clock" style="width: 20px; height: 20px; display: inline-block; vertical-align: middle; margin-right: 8px;"></i>Review Time Metrics';
    reviewDetails.appendChild(reviewSummary);

    const reviewContent = document.createElement('div');
    reviewContent.className = 'review-metrics-content';

    // Time metrics
    if (overall.avg_review_time) {
        const reviewToMerge = overall.avg_merge_time - overall.avg_review_time;

        const timeGrid = document.createElement('div');
        timeGrid.className = 'stats-grid';

        timeGrid.appendChild(createStatCardWithExtraInfo(
            'Time to First Review',
            `${overall.avg_review_time.toFixed(1)}h`,
            `Avg: ${hoursToDays(overall.avg_review_time)} days | Median: ${overall.median_review_time.toFixed(1)}h`,
            'Creation → First Review Submission'
        ));

        timeGrid.appendChild(createStatCard(
            'Time to Merge',
            `${overall.avg_merge_time.toFixed(1)}h`,
            `Avg: ${hoursToDays(overall.avg_merge_time)} days | Median: ${overall.median_merge_time.toFixed(1)}h`
        ));

        timeGrid.appendChild(createStatCardWithExtraInfo(
            'Review → Merge Time',
            `${reviewToMerge.toFixed(1)}h`,
            `${hoursToDays(reviewToMerge)} days avg`,
            'First Review → Final Merge'
        ));

        reviewContent.appendChild(timeGrid);
    }

    // Trends
    if (trends.review_slope !== null || trends.merge_slope !== null) {
        const trendsTitle = createHeading('h3', 'Trends', 'trending-up', 20);
        reviewContent.appendChild(trendsTitle);

        const trendsContainer = document.createElement('div');
        trendsContainer.className = 'trends-container';

        if (trends.review_slope !== null) {
            trendsContainer.appendChild(createTrendItem('Review Time Trend:', trends.review_slope));
        }

        if (trends.merge_slope !== null) {
            trendsContainer.appendChild(createTrendItem('Merge Time Trend:', trends.merge_slope));
        }

        reviewContent.appendChild(trendsContainer);
    }

    // PR Size Breakdown - reuse chartPRs from above
    if (chartPRs.length > 0) {
        const sizes = calculatePRSizes(chartPRs);
        const totalPRs = chartPRs.length;

        const sizeTitle = createHeading('h3', 'PR Size Breakdown', 'ruler', 20);
        reviewContent.appendChild(sizeTitle);

        const sizeGrid = document.createElement('div');
        sizeGrid.className = 'stats-grid';

        sizeGrid.appendChild(createStatCard(
            'Small PRs',
            sizes.small,
            `${formatPercentage(sizes.small, totalPRs)}% | < ${reportData.config.pr_size_small} lines`,
            'stat-card-small-pr'
        ));

        sizeGrid.appendChild(createStatCard(
            'Medium PRs',
            sizes.medium,
            `${formatPercentage(sizes.medium, totalPRs)}% | ${reportData.config.pr_size_small}-${reportData.config.pr_size_medium} lines`,
            'stat-card-medium-pr'
        ));

        sizeGrid.appendChild(createStatCard(
            'Large PRs',
            sizes.large,
            `${formatPercentage(sizes.large, totalPRs)}% | > ${reportData.config.pr_size_medium} lines`,
            'stat-card-large-pr'
        ));

        reviewContent.appendChild(sizeGrid);

        // Comment Metrics
        const commentMetrics = calculateCommentMetrics(chartPRs);
        const avgCommentsPerPR = (commentMetrics.totalComments / totalPRs).toFixed(1);

        const commentTitle = createHeading('h3', 'Comment Activity', 'message-square', 20);
        reviewContent.appendChild(commentTitle);

        const commentGrid = document.createElement('div');
        commentGrid.className = 'stats-grid';

        commentGrid.appendChild(createStatCard(
            'Total Comments',
            commentMetrics.totalComments,
            `${avgCommentsPerPR} avg per PR`,
            'stat-card-comments'
        ));

        commentGrid.appendChild(createStatCard(
            'Active Commenters',
            Object.keys(commentMetrics.commentsByAuthor).length,
            'Unique participants',
            'stat-card-commenters'
        ));

        reviewContent.appendChild(commentGrid);

        // Top Commenters
        if (Object.keys(commentMetrics.commentsByAuthor).length > 0) {
            const sortedCommenters = Object.entries(commentMetrics.commentsByAuthor)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            const commentersTitle = createHeading('h4', 'Top Commenters', 'users', 18);
            commentersTitle.className = 'section-title';
            reviewContent.appendChild(commentersTitle);

            const table = createTable('commenter-table-header-template');
            const tbody = table.querySelector('tbody');

            sortedCommenters.forEach(([author, count]) => {
                const row = createCommenterRow(author, count, commentMetrics.totalComments, totalPRs);
                tbody.appendChild(row);
            });

            reviewContent.appendChild(table);
        }

        // Approval Metrics
        const approvalMetrics = calculateApprovalMetrics(chartPRs);
        const avgApprovalsPerPR = (approvalMetrics.totalApprovals / totalPRs).toFixed(1);

        const approvalTitle = createHeading('h3', 'Approval Activity', 'check-circle', 20);
        reviewContent.appendChild(approvalTitle);

        const approvalGrid = document.createElement('div');
        approvalGrid.className = 'stats-grid';

        approvalGrid.appendChild(createStatCard(
            'Total Approvals',
            approvalMetrics.totalApprovals,
            `${avgApprovalsPerPR} avg per PR`,
            'stat-card-approvals'
        ));

        approvalGrid.appendChild(createStatCard(
            'Active Approvers',
            Object.keys(approvalMetrics.approvalsByAuthor).length,
            'Unique approvers',
            'stat-card-approvers'
        ));

        reviewContent.appendChild(approvalGrid);

        // Top Approvers
        if (Object.keys(approvalMetrics.approvalsByAuthor).length > 0) {
            const sortedApprovers = Object.entries(approvalMetrics.approvalsByAuthor)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            const approversTitle = createHeading('h4', 'Top Approvers', 'user-check', 18);
            approversTitle.className = 'section-title';
            reviewContent.appendChild(approversTitle);

            const table = createTable('approver-table-header-template');
            const tbody = table.querySelector('tbody');

            sortedApprovers.forEach(([author, count]) => {
                const row = createApproverRow(author, count, approvalMetrics.totalApprovals);
                tbody.appendChild(row);
            });

            reviewContent.appendChild(table);
        }
    }

    // Per-developer stats
    if (perDev && Object.keys(perDev).length > 0) {
        const sortedDevs = Object.entries(perDev).sort((a, b) => b[1].pr_count - a[1].pr_count);

        const devTitle = createHeading('h3', 'Developer Review Performance', 'users', 20);
        reviewContent.appendChild(devTitle);

        const table = createTable('dev-table-header-template');
        const tbody = table.querySelector('tbody');

        sortedDevs.forEach(([author, devStats]) => {
            const row = createDevTableRow(author, devStats);
            tbody.appendChild(row);
        });

        reviewContent.appendChild(table);
    }

    reviewDetails.appendChild(reviewContent);
    tabContent.appendChild(reviewDetails);

    // ========================================
    // RECENT PRs SECTION (Outside collapsible)
    // ========================================

    // Recent PRs (for last_7_days period only)
    if (periodKey === 'last_7_days' && chartPRs.length > 0) {
        const sortedPRs = [...chartPRs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const prTitle = createHeading('h3', 'Recent PRs (Last 7 Days)', 'list', 20);
        tabContent.appendChild(prTitle);

        const table = createTable('pr-table-header-template');
        const tbody = table.querySelector('tbody');

        sortedPRs.forEach(pr => {
            const row = createPRRow(pr, reportData.config);
            tbody.appendChild(row);
        });

        tabContent.appendChild(table);
    }

    return tabContent;
}

// Load data on page load
loadData();
