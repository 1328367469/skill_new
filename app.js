// State Management
let appState = {
    apiKey: '',
    apiUrl: 'https://api.deepseek.com/v1',
    apiModel: 'deepseek-chat',
    apiDepth: 'balanced',
    newsItems: [],
    activeScope: 'latest', // 'latest' (最新同步) or 'library' (历史归档)
    activeTab: 'all',      // category filters
    searchQuery: ''
};

// DOM Elements
const elements = {
    btnRefresh: document.getElementById('btn-refresh'),
    btnSettings: document.getElementById('btn-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    btnCancelSettings: document.getElementById('btn-cancel-settings'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnEmptySettings: document.getElementById('btn-empty-settings'),
    settingsModal: document.getElementById('settings-modal'),
    loadingOverlay: document.getElementById('loading-overlay'),
    emptyState: document.getElementById('empty-state'),
    panelsContainer: document.getElementById('panels-container'),
    newsList: document.getElementById('news-list'),
    toolsList: document.getElementById('tools-list'),
    searchInput: document.getElementById('search-input'),
    tabs: document.querySelectorAll('.tab'),
    lastUpdatedText: document.getElementById('last-updated-text'),
    scopeBtns: document.querySelectorAll('.scope-btn'),
    
    // API Inputs
    inputApiKey: document.getElementById('input-api-key'),
    inputApiUrl: document.getElementById('input-api-url'),
    inputApiModel: document.getElementById('input-api-model'),
    inputApiDepth: document.getElementById('input-api-depth'),
    
    // Column badge counts
    badgeNewsCount: document.getElementById('badge-news-count'),
    badgeToolsCount: document.getElementById('badge-tools-count'),
    
    // Category Badge counts
    badgeAll: document.getElementById('badge-all'),
    badgeEnterprise: document.getElementById('badge-enterprise'),
    badgeIndividual: document.getElementById('badge-individual'),
    badgeGithub: document.getElementById('badge-github'),
    badgeStarred: document.getElementById('badge-starred'),
    
    // Progress Steps
    stepHN: document.getElementById('step-hn'),
    stepGitHub: document.getElementById('step-github'),
    stepMerge: document.getElementById('step-merge'),
    stepDeepSeek: document.getElementById('step-deepseek')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    initEventListeners();
    await initApp();
});

// Load everything from SQLite backend on startup
async function initApp() {
    try {
        await fetchConfig();
        await fetchNewsData();
        updateUI();
    } catch (e) {
        console.error('Initialization error:', e);
        // If server is not ready yet, display settings modal
        showModal();
    }
}

// Fetch configuration from SQLite backend
async function fetchConfig() {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Failed to load server configurations');
    const data = await res.json();
    
    appState.apiKey = data.apiKey || '';
    appState.apiUrl = data.apiUrl || 'https://api.deepseek.com/v1';
    appState.apiModel = data.apiModel || 'deepseek-chat';
    appState.apiDepth = data.apiDepth || 'balanced';
    
    // Populate form values
    elements.inputApiKey.value = appState.apiKey;
    elements.inputApiUrl.value = appState.apiUrl;
    elements.inputApiModel.value = appState.apiModel;
    elements.inputApiDepth.value = appState.apiDepth;
}

// Fetch news data based on selected scope (latest/library)
async function fetchNewsData() {
    const res = await fetch(`/api/news?scope=${appState.activeScope}`);
    if (!res.ok) throw new Error('Failed to load news data');
    const data = await res.json();
    appState.newsItems = data;
    
    // Handle last updated label formatting based on batch timestamp
    if (data.length > 0) {
        // Find highest sync batch timestamp
        const latestTime = Math.max(...data.map(item => item.sync_batch || 0));
        if (latestTime > 0) {
            const dateStr = new Date(latestTime * 1000).toLocaleString('zh-CN', { hour12: false });
            elements.lastUpdatedText.textContent = `数据雷达周期: ${dateStr}`;
        }
    } else {
        elements.lastUpdatedText.textContent = `暂无雷达数据`;
    }
}

// Save Settings to SQLite backend
async function saveSettings() {
    const apiKey = elements.inputApiKey.value.trim();
    const apiUrl = elements.inputApiUrl.value.trim();
    const apiModel = elements.inputApiModel.value.trim();
    const apiDepth = elements.inputApiDepth.value;
    
    if (!apiKey) {
        alert('请输入 DeepSeek API Key！');
        return;
    }
    
    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey, apiUrl, apiModel, apiDepth })
        });
        
        if (!res.ok) throw new Error('Failed to save config on server');
        
        appState.apiKey = apiKey;
        appState.apiUrl = apiUrl;
        appState.apiModel = apiModel;
        appState.apiDepth = apiDepth;
        
        hideModal();
        updateUI();
        
        if (appState.newsItems.length === 0) {
            alert('配置保存成功！请点击右上角或主页的“同步最新资讯”开始获取内容。');
        }
    } catch (err) {
        alert(`保存配置失败: ${err.message}`);
    }
}

// Toggle starred status in SQLite database
async function toggleStar(url) {
    try {
        const res = await fetch('/api/toggle_star', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        if (!res.ok) throw new Error('Failed to toggle star');
        const data = await res.json();
        
        // Find and update item locally
        const item = appState.newsItems.find(x => x.url === url);
        if (item) {
            item.starred = data.starred;
        }
        
        // If we are currently browsing starred items, re-render immediately
        updateUI();
    } catch (err) {
        console.error(err);
        alert('收藏操作失败，请检查连接');
    }
}

// Empty state button handler
function handleEmptyStateBtnClick() {
    if (appState.apiKey) {
        handleRefresh();
    } else {
        showModal();
    }
}

// Event Listeners registration
function initEventListeners() {
    elements.btnSettings.addEventListener('click', showModal);
    elements.btnEmptySettings.addEventListener('click', handleEmptyStateBtnClick);
    elements.btnCloseModal.addEventListener('click', hideModal);
    elements.btnCancelSettings.addEventListener('click', hideModal);
    elements.btnSaveSettings.addEventListener('click', saveSettings);
    elements.btnRefresh.addEventListener('click', handleRefresh);
    
    // Category tabs filtering
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabId = e.currentTarget.getAttribute('data-tab');
            elements.tabs.forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            appState.activeTab = tabId;
            renderNewsCards();
        });
    });
    
    // Search input keyword filtering
    elements.searchInput.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value.toLowerCase().trim();
        renderNewsCards();
    });
    
    // Scope switching (Latest sync vs Archive library)
    elements.scopeBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const scope = e.currentTarget.getAttribute('data-scope');
            elements.scopeBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            appState.activeScope = scope;
            
            // Show inline loader while fetching scope news
            elements.newsList.innerHTML = '<div style="padding: 2rem; color: var(--text-muted);">正在读取归档...</div>';
            elements.toolsList.innerHTML = '<div style="padding: 2rem; color: var(--text-muted);">正在读取归档...</div>';
            
            try {
                await fetchNewsData();
                updateUI();
            } catch (err) {
                alert(`读取归档失败: ${err.message}`);
            }
        });
    });
}

function showModal() {
    elements.settingsModal.classList.remove('hidden');
}

function hideModal() {
    elements.settingsModal.classList.add('hidden');
}

// Sync/Refresh logic with simulated visual progress stepper
async function handleRefresh() {
    if (!appState.apiKey) {
        showModal();
        alert('请先配置您的 DeepSeek API Key！');
        return;
    }
    
    // Enable loader
    elements.btnRefresh.disabled = true;
    const refreshIcon = elements.btnRefresh.querySelector('svg');
    refreshIcon.classList.add('spinning');
    elements.loadingOverlay.classList.remove('hidden');
    
    resetStepper();
    
    // Timeouts references to clear them if promise resolves early
    const stepsTimeouts = [];
    
    // Start progress simulation
    updateStepStatus('stepHN', 'active');
    
    stepsTimeouts.push(setTimeout(() => {
        updateStepStatus('stepHN', 'success');
        updateStepStatus('stepGitHub', 'active');
    }, 1500));
    
    stepsTimeouts.push(setTimeout(() => {
        updateStepStatus('stepGitHub', 'success');
        updateStepStatus('stepMerge', 'active');
    }, 2800));
    
    stepsTimeouts.push(setTimeout(() => {
        updateStepStatus('stepMerge', 'success');
        updateStepStatus('stepDeepSeek', 'active');
    }, 3800));

    try {
        const res = await fetch('/api/refresh', {
            method: 'POST'
        });
        
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || `Sync server error ${res.status}`);
        }
        
        const data = await res.json();
        
        // Clear all pending timeouts and set success
        stepsTimeouts.forEach(t => clearTimeout(t));
        updateStepStatus('stepHN', 'success');
        updateStepStatus('stepGitHub', 'success');
        updateStepStatus('stepMerge', 'success');
        updateStepStatus('stepDeepSeek', 'success');
        
        // Load latest news
        appState.newsItems = data;
        
        // Make sure we are on the 'latest' scope since we just refreshed
        elements.scopeBtns.forEach(b => {
            if (b.getAttribute('data-scope') === 'latest') b.classList.add('active');
            else b.classList.remove('active');
        });
        appState.activeScope = 'latest';
        
        if (data.length > 0) {
            const latestTime = Math.max(...data.map(item => item.sync_batch || 0));
            const dateStr = new Date(latestTime * 1000).toLocaleString('zh-CN', { hour12: false });
            elements.lastUpdatedText.textContent = `数据雷达周期: ${dateStr}`;
            alert(`同步完成！此次共发现并分析了 ${data.length} 条全新资讯工具。历史已存在的数据已自动跳过去重。`);
        } else {
            alert('同步完成！当前源中所有资讯在本地数据库均已分析过，已自动跳过以节省 Token 开销。');
        }
        
        setTimeout(() => {
            elements.loadingOverlay.classList.add('hidden');
            elements.btnRefresh.disabled = false;
            refreshIcon.classList.remove('spinning');
            updateUI();
        }, 600);
        
    } catch (err) {
        console.error(err);
        alert(`同步异常: ${err.message || err}`);
        
        // Highlight failed step
        stepsTimeouts.forEach(t => clearTimeout(t));
        const activeStep = document.querySelector('.progress-steps .step.active');
        if (activeStep) {
            activeStep.classList.remove('active');
            activeStep.classList.add('failed');
        }
        
        elements.btnRefresh.disabled = false;
        refreshIcon.classList.remove('spinning');
        setTimeout(() => {
            elements.loadingOverlay.classList.add('hidden');
        }, 3000);
    }
}

function resetStepper() {
    const steps = [elements.stepHN, elements.stepGitHub, elements.stepMerge, elements.stepDeepSeek];
    steps.forEach(step => {
        step.className = 'step pending';
    });
}

function updateStepStatus(stepId, status) {
    const stepEl = elements[stepId];
    if (stepEl) {
        stepEl.className = `step ${status}`;
    }
}

// Global UI renderer
function updateUI() {
    updateBadges();
    
    if (appState.newsItems.length === 0) {
        elements.emptyState.classList.remove('hidden');
        elements.panelsContainer.classList.add('hidden');
        
        const emptyTitle = elements.emptyState.querySelector('h2');
        const emptyDesc = elements.emptyState.querySelector('p');
        const emptyBtn = elements.emptyState.querySelector('button');
        
        if (appState.apiKey) {
            emptyTitle.textContent = '数据准备就绪';
            emptyDesc.textContent = '您的 DeepSeek API Key 已安全保存在本地。现在点击下方按钮即可开始同步最新的 AI 降本增效科技新闻与工具！';
            emptyBtn.textContent = '同步最新资讯';
        } else {
            emptyTitle.textContent = '暂无数据';
            emptyDesc.textContent = '点击右上角的 “配置 API Key” 进行初始化，然后点击 “同步最新资讯” 开始探索 AI 的生产力革命。';
            emptyBtn.textContent = '配置 API Key';
        }
    } else {
        elements.emptyState.classList.add('hidden');
        elements.panelsContainer.classList.remove('hidden');
        renderNewsCards();
    }
}

// Compute badge counts based on the active news scope
function updateBadges() {
    const allCount = appState.newsItems.length;
    const enterpriseCount = appState.newsItems.filter(item => item.category === 'enterprise_efficiency').length;
    const individualCount = appState.newsItems.filter(item => item.category === 'individual_productivity').length;
    const githubCount = appState.newsItems.filter(item => item.category === 'github_trend').length;
    const starredCount = appState.newsItems.filter(item => item.starred).length;
    
    elements.badgeAll.textContent = allCount;
    elements.badgeEnterprise.textContent = enterpriseCount;
    elements.badgeIndividual.textContent = individualCount;
    elements.badgeGithub.textContent = githubCount;
    elements.badgeStarred.textContent = starredCount;
}

// Render cards separately into AI News (Hacker News) and AI Tools (GitHub)
function renderNewsCards() {
    elements.newsList.innerHTML = '';
    elements.toolsList.innerHTML = '';
    
    // Filter items based on activeTab (category)
    let filteredList = [];
    if (appState.activeTab === 'all') {
        filteredList = [...appState.newsItems];
    } else if (appState.activeTab === 'starred') {
        filteredList = appState.newsItems.filter(item => item.starred);
    } else {
        filteredList = appState.newsItems.filter(item => item.category === appState.activeTab);
    }
    
    // Filter items based on searchQuery
    if (appState.searchQuery) {
        filteredList = filteredList.filter(item => {
            const titleMatch = item.title.toLowerCase().includes(appState.searchQuery);
            const origTitleMatch = item.originalTitle && item.originalTitle.toLowerCase().includes(appState.searchQuery);
            const summaryMatch = item.summary.toLowerCase().includes(appState.searchQuery);
            const gainMatch = item.efficiencyGain && item.efficiencyGain.toLowerCase().includes(appState.searchQuery);
            const tagMatch = item.tags && item.tags.some(tag => tag.toLowerCase().includes(appState.searchQuery));
            
            return titleMatch || origTitleMatch || summaryMatch || gainMatch || tagMatch;
        });
    }
    
    let newsCount = 0;
    let toolsCount = 0;
    
    filteredList.forEach(item => {
        const card = createCardDOM(item);
        
        // Split by Source
        if (item.source === 'Hacker News') {
            elements.newsList.appendChild(card);
            newsCount++;
        } else {
            elements.toolsList.appendChild(card);
            toolsCount++;
        }
    });
    
    // Update count labels
    elements.badgeNewsCount.textContent = newsCount;
    elements.badgeToolsCount.textContent = toolsCount;
    
    // Show empty prompt inside panels if empty
    if (newsCount === 0) {
        elements.newsList.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted); font-size: 0.9rem;">
                暂无此类新闻资讯
            </div>
        `;
    }
    if (toolsCount === 0) {
        elements.toolsList.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted); font-size: 0.9rem;">
                暂无此类效率软件或平台
            </div>
        `;
    }
}

// Generate complete card HTML structure
function createCardDOM(item) {
    const cardDiv = document.createElement('div');
    cardDiv.className = `news-card cat-${item.category}`;
    
    let categoryName = '开源趋势';
    let categoryClass = 'github';
    if (item.category === 'enterprise_efficiency') {
        categoryName = '企业降本';
        categoryClass = 'enterprise';
    } else if (item.category === 'individual_productivity') {
        categoryName = '员工提效';
        categoryClass = 'individual';
    }
    
    const impactClass = item.impactScore ? item.impactScore.toLowerCase() : 'low';
    const impactName = item.impactScore === 'High' ? '高价值' : (item.impactScore === 'Medium' ? '中等价值' : '普通');
    
    let tagsHTML = '';
    if (Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
            tagsHTML += `<span class="meta-tag">${tag}</span>`;
        });
    }
    
    let sourceIcon = '';
    if (item.source === 'GitHub') {
        sourceIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>`;
    } else {
        sourceIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12H7M16 16H7M16 8H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    
    // Display publication date
    const pubDate = item.published_at || '最近发布';
    
    cardDiv.innerHTML = `
        <div class="card-header">
            <div class="card-badges">
                <span class="tag-badge ${categoryClass}">${categoryName}</span>
                <span class="impact-badge ${impactClass}">${impactName}</span>
            </div>
            <button class="btn-star ${item.starred ? 'starred' : ''}" title="${item.starred ? '取消收藏' : '添加收藏'}">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
            </button>
        </div>
        <div class="card-body">
            <div class="card-title-area">
                <h3 class="card-title">${item.title}</h3>
                ${item.originalTitle ? `<span class="card-title-orig" title="${item.originalTitle}">${item.originalTitle}</span>` : ''}
            </div>
            
            <p class="card-summary">${item.summary}</p>
            
            ${item.efficiencyGain ? `
                <div class="card-efficiency-value" title="降本增效核心亮点">
                    💡 ${item.efficiencyGain}
                </div>
            ` : ''}
            
            <div class="card-tags">
                ${tagsHTML}
            </div>
        </div>
        <div class="card-footer">
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                <span class="source-badge">
                    ${sourceIcon}
                    <span>${item.source}</span>
                </span>
                <span class="pub-date-text">发布日期: ${pubDate}</span>
            </div>
            <a href="${item.url}" target="_blank" rel="noopener" class="btn-link">
                <span>直达链接</span>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
            </a>
        </div>
    `;
    
    // Add bookmark click handler
    cardDiv.querySelector('.btn-star').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStar(item.url);
    });
    
    return cardDiv;
}
