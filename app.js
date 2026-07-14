// State Management
let appState = {
    apiKey: '',
    apiUrl: 'https://api.deepseek.com/v1',
    apiModel: 'deepseek-chat',
    apiDepth: 'balanced',
    newsItems: [],
    starredUrls: new Set(),
    activeTab: 'all',
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
    newsGrid: document.getElementById('news-grid'),
    searchInput: document.getElementById('search-input'),
    tabs: document.querySelectorAll('.tab'),
    lastUpdatedText: document.getElementById('last-updated-text'),
    
    // API Inputs
    inputApiKey: document.getElementById('input-api-key'),
    inputApiUrl: document.getElementById('input-api-url'),
    inputApiModel: document.getElementById('input-api-model'),
    inputApiDepth: document.getElementById('input-api-depth'),
    
    // Badge counts
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
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadNewsData();
    initEventListeners();
    updateUI();
});

// Load Settings from LocalStorage
function loadSettings() {
    appState.apiKey = localStorage.getItem('effihub_api_key') || '';
    appState.apiUrl = localStorage.getItem('effihub_api_url') || 'https://api.deepseek.com/v1';
    appState.apiModel = localStorage.getItem('effihub_api_model') || 'deepseek-chat';
    appState.apiDepth = localStorage.getItem('effihub_api_depth') || 'balanced';
    
    const starredList = JSON.parse(localStorage.getItem('effihub_starred') || '[]');
    appState.starredUrls = new Set(starredList);
    
    // Populate form values
    elements.inputApiKey.value = appState.apiKey;
    elements.inputApiUrl.value = appState.apiUrl;
    elements.inputApiModel.value = appState.apiModel;
    elements.inputApiDepth.value = appState.apiDepth;
}

// Load News Data from LocalStorage
function loadNewsData() {
    const rawData = localStorage.getItem('effihub_news');
    if (rawData) {
        try {
            appState.newsItems = JSON.parse(rawData);
            const lastUpdated = localStorage.getItem('effihub_last_updated');
            if (lastUpdated) {
                elements.lastUpdatedText.textContent = `上次更新: ${lastUpdated}`;
            }
        } catch (e) {
            console.error('Error parsing stored news:', e);
            appState.newsItems = [];
        }
    }
}

// Save Settings to LocalStorage
function saveSettings() {
    const key = elements.inputApiKey.value.trim();
    const url = elements.inputApiUrl.value.trim();
    const model = elements.inputApiModel.value.trim();
    const depth = elements.inputApiDepth.value;
    
    if (!key) {
        alert('请输入 DeepSeek API Key！');
        return;
    }
    
    appState.apiKey = key;
    appState.apiUrl = url;
    appState.apiModel = model;
    appState.apiDepth = depth;
    
    localStorage.setItem('effihub_api_key', key);
    localStorage.setItem('effihub_api_url', url);
    localStorage.setItem('effihub_api_model', model);
    localStorage.setItem('effihub_api_depth', depth);
    
    hideModal();
    updateUI();
    
    if (appState.newsItems.length === 0) {
        alert('配置保存成功！请点击右上角“同步最新资讯”开始获取内容。');
    }
}

// Star / Unstar toggle handler
function toggleStar(url) {
    if (appState.starredUrls.has(url)) {
        appState.starredUrls.delete(url);
    } else {
        appState.starredUrls.add(url);
    }
    
    // Save to local storage
    localStorage.setItem('effihub_starred', JSON.stringify([...appState.starredUrls]));
    
    // Re-render
    updateUI();
}

// Empty state button handler (either fetch or show modal based on configuration state)
function handleEmptyStateBtnClick() {
    if (appState.apiKey) {
        handleRefresh();
    } else {
        showModal();
    }
}

// Event Listeners Registration
function initEventListeners() {
    // Settings modal interactions
    elements.btnSettings.addEventListener('click', showModal);
    elements.btnEmptySettings.addEventListener('click', handleEmptyStateBtnClick);
    elements.btnCloseModal.addEventListener('click', hideModal);
    elements.btnCancelSettings.addEventListener('click', hideModal);
    elements.btnSaveSettings.addEventListener('click', saveSettings);
    
    // Refresh handler
    elements.btnRefresh.addEventListener('click', handleRefresh);
    
    // Tabs filtering
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabId = e.currentTarget.getAttribute('data-tab');
            elements.tabs.forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            appState.activeTab = tabId;
            renderNewsCards();
        });
    });
    
    // Search handler
    elements.searchInput.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value.toLowerCase().trim();
        renderNewsCards();
    });
}

function showModal() {
    elements.settingsModal.classList.remove('hidden');
}

function hideModal() {
    elements.settingsModal.classList.add('hidden');
}

// Main Refresh Function
async function handleRefresh() {
    if (!appState.apiKey) {
        showModal();
        alert('请先配置您的 DeepSeek API Key！');
        return;
    }
    
    // Set UI to loading state
    elements.btnRefresh.disabled = true;
    const refreshIcon = elements.btnRefresh.querySelector('svg');
    refreshIcon.classList.add('spinning');
    elements.loadingOverlay.classList.remove('hidden');
    
    // Reset Stepper
    resetStepper();
    
    try {
        // Step 1: Hacker News API
        updateStepStatus('stepHN', 'active');
        const hnStories = await fetchHackerNews();
        updateStepStatus('stepHN', 'success');
        
        // Step 2: GitHub API
        updateStepStatus('stepGitHub', 'active');
        const githubRepos = await fetchGitHubTrending();
        updateStepStatus('stepGitHub', 'success');
        
        // Step 3: Deduplication and ranking
        updateStepStatus('stepMerge', 'active');
        const mergedData = deduplicateAndRank(hnStories, githubRepos);
        updateStepStatus('stepMerge', 'success');
        
        if (mergedData.length === 0) {
            throw new Error('未获取到有效的新闻和仓库数据，请检查网络后再试。');
        }
        
        // Step 4: DeepSeek AI analysis
        updateStepStatus('stepDeepSeek', 'active');
        const processedItems = await analyzeWithDeepSeek(mergedData);
        updateStepStatus('stepDeepSeek', 'success');
        
        // Save results
        appState.newsItems = processedItems;
        localStorage.setItem('effihub_news', JSON.stringify(processedItems));
        
        const nowString = new Date().toLocaleString('zh-CN', { hour12: false });
        localStorage.setItem('effihub_last_updated', nowString);
        elements.lastUpdatedText.textContent = `上次更新: ${nowString}`;
        
        // Finished successfully
        setTimeout(() => {
            elements.loadingOverlay.classList.add('hidden');
            elements.btnRefresh.disabled = false;
            refreshIcon.classList.remove('spinning');
            updateUI();
        }, 800);
        
    } catch (err) {
        console.error(err);
        alert(`同步失败: ${err.message || err}`);
        
        // Highlight failed step
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

// Reset loader stepper visual styles
function resetStepper() {
    const steps = [elements.stepHN, elements.stepGitHub, elements.stepMerge, elements.stepDeepSeek];
    steps.forEach(step => {
        step.className = 'step pending';
    });
}

// Update state helper for loading overlay
function updateStepStatus(stepId, status) {
    const stepEl = elements[stepId];
    if (stepEl) {
        stepEl.className = `step ${status}`;
    }
}

/* API Fetch Functions */

// Fetch Hacker News stories related to AI / productivity
async function fetchHackerNews() {
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
    const queries = ['AI', 'LLM', 'productivity', 'efficiency'];
    let allHits = [];
    
    // We run parallel calls to Hacker News algolia API
    const fetchPromises = queries.map(async (q) => {
        const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&numericFilters=created_at_i>${sevenDaysAgo}&hitsPerPage=15`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HN search query "${q}" failed`);
            const data = await res.json();
            return data.hits || [];
        } catch (e) {
            console.warn(`Error fetching HN query "${q}":`, e);
            return [];
        }
    });
    
    const results = await Promise.all(fetchPromises);
    results.forEach(hits => {
        allHits = allHits.concat(hits);
    });
    
    return allHits;
}

// Fetch GitHub trending repositories
async function fetchGitHubTrending() {
    const dateStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    let allRepos = [];
    
    // We execute two queries to find high quality repositories
    // Q1: topic:ai created within 7 days sorted by stars
    // Q2: AI productivity tools created within 7 days sorted by stars
    const queries = [
        `topic:ai+created:>${dateStr}`,
        `ai+productivity+created:>${dateStr}`
    ];
    
    const fetchPromises = queries.map(async (q) => {
        const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=25`;
        try {
            const res = await fetch(url, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (!res.ok) throw new Error(`GitHub query "${q}" failed: ${res.status}`);
            const data = await res.json();
            return data.items || [];
        } catch (e) {
            console.warn(`Error fetching GitHub query "${q}":`, e);
            return [];
        }
    });
    
    const results = await Promise.all(fetchPromises);
    results.forEach(items => {
        allRepos = allRepos.concat(items);
    });
    
    return allRepos;
}

// Deduplicate articles and repos, rank them, select top N
function deduplicateAndRank(hnStories, githubRepos) {
    const seenUrls = new Set();
    const list = [];
    
    // Process Hacker News stories
    hnStories.forEach(story => {
        if (!story.url || !story.title) return;
        
        // Clean URL to prevent minor duplicates (hash/query params)
        const cleanUrl = story.url.split('#')[0].split('?')[0].toLowerCase().trim();
        if (seenUrls.has(cleanUrl)) return;
        
        seenUrls.add(cleanUrl);
        list.push({
            title: story.title,
            url: story.url,
            source: 'Hacker News',
            score: story.points || 0,
            description: story.story_text || '',
            author: story.author
        });
    });
    // Sort HN stories by points descending
    list.sort((a, b) => b.score - a.score);
    
    // Slice size based on apiDepth optimization rules
    let sliceSize = 9; // balanced mode
    if (appState.apiDepth === 'saving') sliceSize = 5;
    if (appState.apiDepth === 'deep') sliceSize = 15;
    
    const topHN = list.slice(0, sliceSize);
    
    // Process GitHub repos
    const gitList = [];
    githubRepos.forEach(repo => {
        if (!repo.html_url || !repo.full_name) return;
        
        const cleanUrl = repo.html_url.split('#')[0].split('?')[0].toLowerCase().trim();
        if (seenUrls.has(cleanUrl)) return;
        
        seenUrls.add(cleanUrl);
        gitList.push({
            title: repo.full_name,
            url: repo.html_url,
            source: 'GitHub',
            score: repo.stargazers_count || 0,
            description: repo.description || ''
        });
    });
    
    // Sort GitHub repos by stars descending
    gitList.sort((a, b) => b.score - a.score);
    const topGit = gitList.slice(0, sliceSize);
    
    // Combine both arrays
    return [...topHN, ...topGit];
}

// Send selected items to DeepSeek for analysis and synthesis
async function analyzeWithDeepSeek(items) {
    // Determine trim length and output instructions based on depth configuration to minimize tokens
    let descTrim = 130;
    let modeInstruction = '';
    let targetCount = '6-9';
    let summarySentences = '2-3';
    let tagCount = '2-3';
    
    if (appState.apiDepth === 'saving') {
        descTrim = 80;
        modeInstruction = '【省流模式开启】：为了极致节省您的 Token，请只挑选 4-6 个最匹配的主题条目。并且，请确保将每个条目的中文总结控制在 1-2 句极简概要，标签限制在 2 个。';
        targetCount = '4-6';
        summarySentences = '1-2';
        tagCount = '2';
    } else if (appState.apiDepth === 'deep') {
        descTrim = 200;
        modeInstruction = '【深度雷达模式开启】：请提供详尽的多维度信息。每个筛选条目的中文总结长度为 3-4 句以包含完整的背景和技术价值，标签设置为 2-4 个。挑选 8-12 个最匹配的条目。';
        targetCount = '8-12';
        summarySentences = '3-4';
        tagCount = '2-4';
    } else {
        // Balanced (default)
        descTrim = 130;
        modeInstruction = '【均衡推荐模式开启】：在广度与 Token 消耗间进行折中。挑选 6-9 个最匹配的条目，且每个条目的中文总结控制在 2-3 句话，标签设置 2-3 个。';
    }

    // Structure input to minimize tokens while retaining critical context
    const cleanInputList = items.map(item => ({
        title: item.title,
        url: item.url,
        source: item.source,
        score: item.score,
        desc: item.description ? item.description.substring(0, descTrim) : ''
    }));
    
    const systemPrompt = `你是一个专业的科技主编和AI效率专家。你的工作是分析一组最新的科技新闻和GitHub项目，挑选出其中最符合以下主题的条目：
1. 【企业降本增效】：能帮助企业优化流程、降低IT或运营成本、自动化业务流程的工具或新闻。
2. 【个人提效】：能切实提高员工、开发人员、设计师、办公人员日常工作效率的AI软件、平台、MCP服务、工作流工具等。
3. 【开源趋势】：在GitHub上极具潜力、处于上升期的AI开源项目，对开发者和企业有直接应用价值。

${modeInstruction}
请从输入列表中筛选出最相关的 ${targetCount} 个条目，过滤掉纯理论学术论文、硬件发布、没有具体可用软件工具的泛泛之谈、或无关的社会新闻。

对于筛选出的每个条目，按照以下 JSON 格式进行返回。请确保输出是一个合法的 JSON 对象，格式如下：
{
  "items": [
    {
      "title": "中文标题（翻译并润色，使其对中国读者具有吸引力和可读性）",
      "originalTitle": "原始标题/项目名",
      "url": "原始链接",
      "source": "来源，必须是 'Hacker News' 或 'GitHub'",
      "category": "分类，必须是 'enterprise_efficiency' 或 'individual_productivity' 或 'github_trend'",
      "efficiencyGain": "1-2句中文解释该工具/新闻如何降本或增效，明确痛点和价值点",
      "summary": "${summarySentences}句中文详细概述该技术或工具的背景、核心功能以及实际应用场景",
      "impactScore": "影响力评分，必须是 'High' 或 'Medium' 或 'Low' 中的一个",
      "tags": ["标签1", "标签2"] 
    }
  ]
}

注意：
- 【严格禁止虚构，必须完全真实】你只能从我给出的待分析技术项目列表中筛选条目，严禁自行虚构、自我编造任何项目、新闻或外部URL。
- 每一个返回条目的 'url' 必须与我给出的输入列表中对应条目的 'url' 完全一致。
- 每一个返回条目的 'originalTitle' 必须与我给出的输入列表中对应条目的 'title' 完全一致。
- 严格遵循指定的三个 category (enterprise_efficiency, individual_productivity, github_trend) 和三个 impactScore (High, Medium, Low) 字符串。
- 标签数量限制在 ${tagCount} 之间，如 "RAG", "MCP", "自动化" 等。
- 必须返回合法的 JSON 格式。`;

    const userPrompt = `这里是待分析的最新技术项目列表：\n${JSON.stringify(cleanInputList, null, 2)}`;
    
    const requestBody = {
        model: appState.apiModel,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
    };
    
    console.log(`Calling DeepSeek API at: ${appState.apiUrl}/chat/completions`);
    
    const response = await fetch(`${appState.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${appState.apiKey}`
        },
        body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API 调用失败 (${response.status}): ${errorText || '未知错误'}`);
    }
    
    const resData = await response.json();
    const content = resData.choices[0].message.content;
    console.log('DeepSeek RAW Response:', content);
    
    // Robustly parse the content JSON
    let parsedData;
    try {
        // Strip markdown code blocks if any exist
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```')) {
            cleanContent = cleanContent.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        }
        parsedData = JSON.parse(cleanContent);
    } catch (parseErr) {
        console.error('Failed to parse DeepSeek response directly, attempting fallback regex extract:', parseErr);
        // Fallback regex attempt
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                parsedData = JSON.parse(jsonMatch[0]);
            } catch (fallbackErr) {
                throw new Error('LLM 返回的格式无法被解析为合法的 JSON。请重试或检查模型表现。');
            }
        } else {
            throw new Error('LLM 返回内容中没有找到合法的 JSON。');
        }
    }
    
    if (!parsedData || !Array.isArray(parsedData.items)) {
        throw new Error('LLM 响应的 JSON 中缺少 "items" 数组属性。');
    }
    
    return parsedData.items;
}

/* UI Rendering Functions */

// Global UI state updater
function updateUI() {
    updateBadges();
    
    if (appState.newsItems.length === 0) {
        elements.emptyState.classList.remove('hidden');
        elements.newsGrid.classList.add('hidden');
        
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
        elements.newsGrid.classList.remove('hidden');
        renderNewsCards();
    }
}

// Compute badge item counts dynamically
function updateBadges() {
    const allCount = appState.newsItems.length;
    const enterpriseCount = appState.newsItems.filter(item => item.category === 'enterprise_efficiency').length;
    const individualCount = appState.newsItems.filter(item => item.category === 'individual_productivity').length;
    const githubCount = appState.newsItems.filter(item => item.category === 'github_trend').length;
    const starredCount = appState.newsItems.filter(item => appState.starredUrls.has(item.url)).length;
    
    elements.badgeAll.textContent = allCount;
    elements.badgeEnterprise.textContent = enterpriseCount;
    elements.badgeIndividual.textContent = individualCount;
    elements.badgeGithub.textContent = githubCount;
    elements.badgeStarred.textContent = starredCount;
}

// Filter and render news card list
function renderNewsCards() {
    elements.newsGrid.innerHTML = '';
    
    // Filter by Tab
    let filteredList = [];
    if (appState.activeTab === 'all') {
        filteredList = [...appState.newsItems];
    } else if (appState.activeTab === 'starred') {
        filteredList = appState.newsItems.filter(item => appState.starredUrls.has(item.url));
    } else {
        filteredList = appState.newsItems.filter(item => item.category === appState.activeTab);
    }
    
    // Filter by Search Query
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
    
    if (filteredList.length === 0) {
        elements.newsGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; width: 100%; border: none; padding: 3rem 1rem;">
                <div class="empty-icon" style="width: 50px; height: 50px;">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
                <h3>未找到匹配的内容</h3>
                <p>尝试切换筛选栏，或换一个搜索词试试。</p>
            </div>
        `;
        return;
    }
    
    // Render Cards
    filteredList.forEach(item => {
        const isStarred = appState.starredUrls.has(item.url);
        const card = createCardDOM(item, isStarred);
        elements.newsGrid.appendChild(card);
    });
}

// Generate complete card HTML structure
function createCardDOM(item, isStarred) {
    const cardDiv = document.createElement('div');
    cardDiv.className = `news-card cat-${item.category}`;
    
    // Translate technical keywords to Chinese badges
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
    
    // Create Tag elements
    let tagsHTML = '';
    if (Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
            tagsHTML += `<span class="meta-tag">${tag}</span>`;
        });
    }
    
    // Format Hacker News points vs GitHub Stars
    let sourceIcon = '';
    if (item.source === 'GitHub') {
        sourceIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>`;
    } else {
        sourceIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;
    }
    
    cardDiv.innerHTML = `
        <div class="card-header">
            <div class="card-badges">
                <span class="tag-badge ${categoryClass}">${categoryName}</span>
                <span class="impact-badge ${impactClass}">${impactName}</span>
            </div>
            <button class="btn-star ${isStarred ? 'starred' : ''}" title="${isStarred ? '取消收藏' : '添加收藏'}">
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
                <div class="card-efficiency-value" title="降本增效价值亮点">
                    💡 ${item.efficiencyGain}
                </div>
            ` : ''}
            
            <div class="card-tags">
                ${tagsHTML}
            </div>
        </div>
        <div class="card-footer">
            <span class="source-badge">
                ${sourceIcon}
                <span>${item.source}</span>
            </span>
            <a href="${item.url}" target="_blank" rel="noopener" class="btn-link">
                <span>直达链接</span>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
            </a>
        </div>
    `;
    
    // Star toggle button handler inside card DOM
    cardDiv.querySelector('.btn-star').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStar(item.url);
    });
    
    return cardDiv;
}
