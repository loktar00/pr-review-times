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
    if (!reportData.raw_prs || !reportData.raw_prs[repoName]) return [];

    const prs = reportData.raw_prs[repoName];
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
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('data') || 'report';
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
    const change = Math.abs(slope) * 30;

    item.querySelector('.trend-label').textContent = label;

    const indicator = item.querySelector('.trend-indicator');
    indicator.className = `trend-indicator ${direction}`;
    indicator.textContent = `${emoji} ${direction.toUpperCase()}`;

    item.querySelector('.trend-change').textContent = `Change: ${change.toFixed(2)} hrs/month`;

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

    const content = document.getElementById('content');
    content.innerHTML = '';

    content.appendChild(renderFilterUI());

    if (repo.is_combined && reportData.global_dev_stats && Object.keys(reportData.global_dev_stats).length > 0) {
        content.appendChild(renderGlobalDevStats());
    }

    const periodOrder = ['last_7_days', 'last_30_days', 'last_quarter', 'overall'];

    const tabNav = document.createElement('div');
    tabNav.className = 'tab-navigation';

    periodOrder.forEach(periodKey => {
        const periodInfo = reportData.time_periods[periodKey];
        const hasData = repo.period_stats[periodKey];
        const button = createTabButton(periodKey, periodInfo, hasData);
        tabNav.appendChild(button);
    });

    content.appendChild(tabNav);

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
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`tab-btn-${periodKey}`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-content-${periodKey}`).classList.add('active');
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

    // Overview section
    const overviewTitle = createHeading('h2', `${stats.name} Overview`, 'bar-chart-2', 24);
    tabContent.appendChild(overviewTitle);

    const statsGrid = document.createElement('div');
    statsGrid.className = 'stats-grid';

    statsGrid.appendChild(createStatCard('Total PRs', overall.total_prs));
    statsGrid.appendChild(createStatCard(
        'Merged',
        overall.merged_prs,
        `${formatPercentage(overall.merged_prs, overall.total_prs)}% merge rate`,
        'success'
    ));
    statsGrid.appendChild(createStatCard('Closed (not merged)', overall.closed_not_merged_prs, '', 'warning'));
    statsGrid.appendChild(createStatCard('Still Open', overall.open_prs, '', 'info'));

    tabContent.appendChild(statsGrid);

    // Time metrics
    if (overall.avg_review_time) {
        const reviewToMerge = overall.avg_merge_time - overall.avg_review_time;

        const timeTitle = createHeading('h3', 'Time Metrics', 'clock', 20);
        tabContent.appendChild(timeTitle);

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

        tabContent.appendChild(timeGrid);
    }

    // Trends
    if (trends.review_slope !== null || trends.merge_slope !== null) {
        const trendsTitle = createHeading('h3', 'Trends', 'trending-up', 20);
        tabContent.appendChild(trendsTitle);

        const trendsContainer = document.createElement('div');
        trendsContainer.className = 'trends-container';

        if (trends.review_slope !== null) {
            trendsContainer.appendChild(createTrendItem('Review Time Trend:', trends.review_slope));
        }

        if (trends.merge_slope !== null) {
            trendsContainer.appendChild(createTrendItem('Merge Time Trend:', trends.merge_slope));
        }

        tabContent.appendChild(trendsContainer);
    }

    // Get raw PRs for this period
    const repoName = reportData.repositories.find(r => r.repo_id === repoId)?.repo_name;
    const periodPRs = repoName ? getPRsForPeriod(repoName, periodKey) : [];

    // PR Size Breakdown
    if (periodPRs.length > 0) {
        const sizes = calculatePRSizes(periodPRs);
        const totalPRs = periodPRs.length;

        const sizeTitle = createHeading('h3', 'PR Size Breakdown', 'ruler', 20);
        tabContent.appendChild(sizeTitle);

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

        tabContent.appendChild(sizeGrid);

        // Comment Metrics
        const commentMetrics = calculateCommentMetrics(periodPRs);
        const avgCommentsPerPR = (commentMetrics.totalComments / totalPRs).toFixed(1);

        const commentTitle = createHeading('h3', 'Comment Activity', 'message-square', 20);
        tabContent.appendChild(commentTitle);

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

        tabContent.appendChild(commentGrid);

        // Top Commenters
        if (Object.keys(commentMetrics.commentsByAuthor).length > 0) {
            const sortedCommenters = Object.entries(commentMetrics.commentsByAuthor)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            const commentersTitle = createHeading('h4', 'Top Commenters', 'users', 18);
            commentersTitle.className = 'section-title';
            tabContent.appendChild(commentersTitle);

            const table = createTable('commenter-table-header-template');
            const tbody = table.querySelector('tbody');

            sortedCommenters.forEach(([author, count]) => {
                const row = createCommenterRow(author, count, commentMetrics.totalComments, totalPRs);
                tbody.appendChild(row);
            });

            tabContent.appendChild(table);
        }

        // Approval Metrics
        const approvalMetrics = calculateApprovalMetrics(periodPRs);
        const avgApprovalsPerPR = (approvalMetrics.totalApprovals / totalPRs).toFixed(1);

        const approvalTitle = createHeading('h3', 'Approval Activity', 'check-circle', 20);
        tabContent.appendChild(approvalTitle);

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

        tabContent.appendChild(approvalGrid);

        // Top Approvers
        if (Object.keys(approvalMetrics.approvalsByAuthor).length > 0) {
            const sortedApprovers = Object.entries(approvalMetrics.approvalsByAuthor)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            const approversTitle = createHeading('h4', 'Top Approvers', 'user-check', 18);
            approversTitle.className = 'section-title';
            tabContent.appendChild(approversTitle);

            const table = createTable('approver-table-header-template');
            const tbody = table.querySelector('tbody');

            sortedApprovers.forEach(([author, count]) => {
                const row = createApproverRow(author, count, approvalMetrics.totalApprovals);
                tbody.appendChild(row);
            });

            tabContent.appendChild(table);
        }

        // Recent PRs (for last_7_days period only)
        if (periodKey === 'last_7_days' && periodPRs.length > 0) {
            const sortedPRs = [...periodPRs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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
    }

    // Charts
    const dataDir = getDataDirectory();
    if (charts.trends) {
        const trendsChartTitle = createHeading('h3', 'Trends Over Time', 'trending-up', 20);
        tabContent.appendChild(trendsChartTitle);

        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';

        const img = document.createElement('img');
        img.src = `${dataDir}/${charts.trends}`;
        img.alt = `Trends Chart - ${stats.name}`;

        chartContainer.appendChild(img);
        tabContent.appendChild(chartContainer);
    }

    if (charts.distributions) {
        const distChartTitle = createHeading('h3', 'Distribution Analysis', 'bar-chart', 20);
        tabContent.appendChild(distChartTitle);

        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';

        const img = document.createElement('img');
        img.src = `${dataDir}/${charts.distributions}`;
        img.alt = `Distribution Chart - ${stats.name}`;

        chartContainer.appendChild(img);
        tabContent.appendChild(chartContainer);
    }

    // Per-developer stats
    if (perDev && Object.keys(perDev).length > 0) {
        const sortedDevs = Object.entries(perDev).sort((a, b) => b[1].pr_count - a[1].pr_count);

        const devTitle = createHeading('h3', 'Developer Performance', 'users', 20);
        tabContent.appendChild(devTitle);

        const table = createTable('dev-table-header-template');
        const tbody = table.querySelector('tbody');

        sortedDevs.forEach(([author, devStats]) => {
            const row = createDevTableRow(author, devStats);
            tbody.appendChild(row);
        });

        tabContent.appendChild(table);
    }

    return tabContent;
}

// Load data on page load
loadData();
