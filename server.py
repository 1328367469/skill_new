import http.server
import socketserver
import sqlite3
import json
import os
import urllib.request
import urllib.error
import datetime
import time

PORT = 8234
DB_FILE = 'data.db'

# Initialize SQLite database
def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Configuration table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    
    # News items table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS news_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT UNIQUE,
            title TEXT,
            original_title TEXT,
            source TEXT,
            category TEXT,
            efficiency_gain TEXT,
            summary TEXT,
            impact_score TEXT,
            tags TEXT,
            published_at TEXT,
            created_at TEXT,
            starred INTEGER DEFAULT 0,
            sync_batch INTEGER
        )
    ''')
    
    # Insert default settings if empty
    cursor.execute("SELECT COUNT(*) FROM config")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO config (key, value) VALUES ('api_url', 'https://api.deepseek.com/v1')")
        cursor.execute("INSERT INTO config (key, value) VALUES ('api_model', 'deepseek-chat')")
        cursor.execute("INSERT INTO config (key, value) VALUES ('api_depth', 'balanced')")
        cursor.execute("INSERT INTO config (key, value) VALUES ('api_key', '')")
    
    conn.commit()
    conn.close()

# Helper: Get config value
def get_config(key, default=''):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM config WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else default

# Helper: Update config value
def set_config(key, value):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()

# Helper: Check if URL exists in DB
def url_exists(url):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    clean_url = url.split('#')[0].split('?')[0].lower().strip()
    # Check both matching original URL and fuzzy cleaned URL
    cursor.execute("SELECT 1 FROM news_items WHERE url = ? OR url LIKE ?", (url, f"%{clean_url}%"))
    exists = cursor.fetchone() is not None
    conn.close()
    return exists

# Fetch Hacker News API
def fetch_hn():
    print("Fetching news from Hacker News...")
    seven_days_ago = int(time.time()) - (7 * 24 * 60 * 60)
    queries = ['AI', 'LLM', 'productivity', 'efficiency']
    all_hits = []
    seen_urls = set()
    
    for q in queries:
        url = f"https://hn.algolia.com/api/v1/search?query={urllib.parse.quote(q)}&tags=story&numericFilters=created_at_i>{seven_days_ago}&hitsPerPage=15"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=8) as response:
                data = json.loads(response.read().decode('utf-8'))
                hits = data.get('hits', [])
                for hit in hits:
                    hit_url = hit.get('url')
                    if hit_url and hit.get('title'):
                        clean_url = hit_url.split('#')[0].split('?')[0].lower().strip()
                        if clean_url not in seen_urls and not url_exists(hit_url):
                            seen_urls.add(clean_url)
                            # Parse publication date
                            created_at = hit.get('created_at', '')
                            pub_date = created_at[:10] if created_at else datetime.date.today().isoformat()
                            all_hits.append({
                                'title': hit.get('title'),
                                'url': hit_url,
                                'source': 'Hacker News',
                                'score': hit.get('points', 0),
                                'description': hit.get('story_text', '') or '',
                                'published_at': pub_date
                            })
        except Exception as e:
            print(f"Error fetching HN query {q}: {e}")
            
    # Sort by points
    all_hits.sort(key=lambda x: x['score'], reverse=True)
    return all_hits

# Fetch GitHub trending repos
def fetch_github():
    print("Fetching repositories from GitHub...")
    date_str = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
    queries = [
        f"topic:ai+created:>{date_str}",
        f"ai+productivity+created:>{date_str}"
    ]
    all_repos = []
    seen_urls = set()
    
    for q in queries:
        url = f"https://api.github.com/search/repositories?q={q}&sort=stars&order=desc&per_page=25"
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'application/vnd.github.v3+json'
            })
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))
                items = data.get('items', [])
                for item in items:
                    html_url = item.get('html_url')
                    if html_url and item.get('full_name'):
                        clean_url = html_url.split('#')[0].split('?')[0].lower().strip()
                        if clean_url not in seen_urls and not url_exists(html_url):
                            seen_urls.add(clean_url)
                            # Parse publication date
                            created_at = item.get('created_at', '')
                            pub_date = created_at[:10] if created_at else datetime.date.today().isoformat()
                            all_repos.append({
                                'title': item.get('full_name'),
                                'url': html_url,
                                'source': 'GitHub',
                                'score': item.get('stargazers_count', 0),
                                'description': item.get('description', '') or '',
                                'published_at': pub_date
                            })
        except Exception as e:
            print(f"Error fetching GitHub query {q}: {e}")
            
    # Sort by stars
    all_repos.sort(key=lambda x: x['score'], reverse=True)
    return all_repos

# Custom API Handler
class APIRequestHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.0'
    
    def log_message(self, format, *args):
        # Override to log cleanly
        print(f"[{self.log_date_time_string()}] {format%args}")

    def do_GET(self):
        url_parsed = urllib.parse.urlparse(self.path)
        path = url_parsed.path
        query_params = urllib.parse.parse_qs(url_parsed.query)
        
        # Route API queries
        if path == '/api/config':
            self.handle_get_config()
        elif path == '/api/news':
            self.handle_get_news(query_params)
        else:
            # Fallback to serving static files from current directory
            # Clean up root
            if path == '/':
                self.path = '/index.html'
            super().do_GET()

    def do_POST(self):
        url_parsed = urllib.parse.urlparse(self.path)
        path = url_parsed.path
        
        if path == '/api/config':
            self.handle_post_config()
        elif path == '/api/refresh':
            self.handle_post_refresh()
        elif path == '/api/toggle_star':
            self.handle_post_toggle_star()
        else:
            self.send_error_json(404, "Endpoint not found")

    # Send standard JSON headers and payload
    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Connection', 'close')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def send_error_json(self, status, message):
        self.send_json({"error": message}, status)

    # API Handler: GET /api/config
    def handle_get_config(self):
        config_data = {
            "apiKey": get_config("api_key"),
            "apiUrl": get_config("api_url"),
            "apiModel": get_config("api_model"),
            "apiDepth": get_config("api_depth")
        }
        self.send_json(config_data)

    # API Handler: POST /api/config
    def handle_post_config(self):
        content_length = int(self.headers['Content-Length'])
        post_data = json.loads(self.rfile.read(content_length).decode('utf-8'))
        
        set_config("api_key", post_data.get("apiKey", ""))
        set_config("api_url", post_data.get("apiUrl", "https://api.deepseek.com/v1"))
        set_config("api_model", post_data.get("apiModel", "deepseek-chat"))
        set_config("api_depth", post_data.get("apiDepth", "balanced"))
        
        self.send_json({"status": "ok"})

    # API Handler: GET /api/news?scope=latest|library
    def handle_get_news(self, params):
        scope = params.get('scope', ['latest'])[0]
        
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        if scope == 'latest':
            # Get the max sync batch
            cursor.execute("SELECT MAX(sync_batch) FROM news_items")
            max_batch = cursor.fetchone()[0]
            if max_batch:
                cursor.execute("SELECT * FROM news_items WHERE sync_batch = ? ORDER BY id DESC", (max_batch,))
                rows = cursor.fetchall()
            else:
                rows = []
        else: # library / archives
            cursor.execute("SELECT * FROM news_items ORDER BY sync_batch DESC, id DESC")
            rows = cursor.fetchall()
            
        items = []
        for row in rows:
            items.append({
                "id": row["id"],
                "url": row["url"],
                "title": row["title"],
                "originalTitle": row["original_title"],
                "source": row["source"],
                "category": row["category"],
                "efficiencyGain": row["efficiency_gain"],
                "summary": row["summary"],
                "impactScore": row["impact_score"],
                "tags": json.loads(row["tags"]) if row["tags"] else [],
                "published_at": row["published_at"],
                "starred": bool(row["starred"]),
                "sync_batch": row["sync_batch"]
            })
            
        conn.close()
        self.send_json(items)

    # API Handler: POST /api/toggle_star
    def handle_post_toggle_star(self):
        content_length = int(self.headers['Content-Length'])
        post_data = json.loads(self.rfile.read(content_length).decode('utf-8'))
        url = post_data.get('url')
        
        if not url:
            self.send_error_json(400, "URL is required")
            return
            
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # Check current starred status
        cursor.execute("SELECT starred FROM news_items WHERE url = ?", (url,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            self.send_error_json(404, "News item not found in local library")
            return
            
        new_starred = 1 - row[0]
        cursor.execute("UPDATE news_items SET starred = ? WHERE url = ?", (new_starred, url))
        conn.commit()
        conn.close()
        
        self.send_json({"status": "ok", "starred": bool(new_starred)})

    # API Handler: POST /api/refresh
    def handle_post_refresh(self):
        api_key = get_config("api_key")
        api_url = get_config("api_url")
        api_model = get_config("api_model")
        api_depth = get_config("api_depth")
        
        if not api_key:
            self.send_error_json(400, "API key is not configured on the server. Please save it first.")
            return

        try:
            # 1. Fetch from HN & GitHub
            hn_items = fetch_hn()
            github_items = fetch_github()
            
            # 2. Select slice size based on depth rules
            slice_size = 9
            if api_depth == 'saving':
                slice_size = 5
            elif api_depth == 'deep':
                slice_size = 15
                
            top_hn = hn_items[:slice_size]
            top_git = github_items[:slice_size]
            merged_items = top_hn + top_git
            
            print(f"Total new unique items discovered: {len(merged_items)}")
            if len(merged_items) == 0:
                # No new items to process, return empty list with a status
                self.send_json([])
                return
                
            # 3. Call DeepSeek API
            analyzed_items = self.call_deepseek_api(merged_items, api_key, api_url, api_model, api_depth)
            
            # 4. Save to SQLite database
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            sync_batch = int(time.time())
            created_at = datetime.datetime.now().isoformat()
            
            inserted_items = []
            for item in analyzed_items:
                # Find matching original item to retrieve the published_at field
                url = item.get('url')
                orig_item = next((x for x in merged_items if x['url'] == url), None)
                pub_date = orig_item['published_at'] if orig_item else datetime.date.today().isoformat()
                
                try:
                    cursor.execute('''
                        INSERT INTO news_items 
                        (url, title, original_title, source, category, efficiency_gain, summary, impact_score, tags, published_at, created_at, sync_batch)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        url,
                        item.get('title'),
                        item.get('originalTitle'),
                        item.get('source'),
                        item.get('category'),
                        item.get('efficiencyGain'),
                        item.get('summary'),
                        item.get('impactScore'),
                        json.dumps(item.get('tags', [])),
                        pub_date,
                        created_at,
                        sync_batch
                    ))
                    inserted_items.append({
                        "url": url,
                        "title": item.get('title'),
                        "originalTitle": item.get('originalTitle'),
                        "source": item.get('source'),
                        "category": item.get('category'),
                        "efficiencyGain": item.get('efficiencyGain'),
                        "summary": item.get('summary'),
                        "impactScore": item.get('impactScore'),
                        "tags": item.get('tags', []),
                        "published_at": pub_date,
                        "starred": False,
                        "sync_batch": sync_batch
                    })
                except sqlite3.IntegrityError:
                    # Duplicate check, skip
                    print(f"Skipped duplicate insert: {url}")
                    
            conn.commit()
            conn.close()
            
            self.send_json(inserted_items)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            self.send_error_json(500, f"Sync processing failed: {str(e)}")

    # DeepSeek API Client caller
    def call_deepseek_api(self, items, api_key, api_url, api_model, api_depth):
        # Format list to minimize tokens
        desc_trim = 130
        mode_instruction = ''
        target_count = '6-9'
        summary_sentences = '2-3'
        tag_count = '2-3'
        
        if api_depth == 'saving':
            desc_trim = 80;
            mode_instruction = '【省流模式开启】：为了极致节省您的 Token，请只挑选 4-6 个最匹配的主题条目。并且，请确保将每个条目的中文总结控制在 1-2 句极简概要，标签限制在 2 个。';
            target_count = '4-6'
            summary_sentences = '1-2'
            tag_count = '2'
        elif api_depth == 'deep':
            desc_trim = 200;
            mode_instruction = '【深度雷达模式开启】：请提供详尽的多维度信息。每个筛选条目的中文总结长度为 3-4 句以包含完整的背景和技术价值，标签设置为 2-4 个。挑选 8-12 个最匹配的条目。';
            target_count = '8-12'
            summary_sentences = '3-4'
            tag_count = '2-4'
        else:
            # balanced
            desc_trim = 130;
            mode_instruction = '【均衡推荐模式开启】：在广度与 Token 消耗间进行折中。挑选 6-9 个最匹配的条目，且每个条目的中文总结控制在 2-3 句话，标签设置 2-3 个。'

        clean_input = []
        for x in items:
            clean_input.append({
                "title": x["title"],
                "url": x["url"],
                "source": x["source"],
                "score": x["score"],
                "desc": x["description"][:desc_trim] if x["description"] else ''
            })

        system_prompt = f"""你是一个专业的科技主编和AI效率专家。你的工作是分析一组最新的科技新闻和GitHub项目，挑选出其中最符合以下主题的条目：
1. 【企业降本增效】：能帮助企业优化流程、降低IT或运营成本、自动化业务流程的工具或新闻。
2. 【个人提效】：能切实提高员工、开发人员、设计师、办公人员日常工作效率的AI软件、平台、MCP服务、工作流工具等。
3. 【开源趋势】：在GitHub上极具潜力、处于上升期的AI开源项目，对开发者和企业有直接应用价值。

{mode_instruction}
请从输入列表中筛选出最相关的 {target_count} 个条目，过滤掉纯理论学术论文、硬件发布、没有具体可用软件工具的泛泛之谈、或无关的社会新闻。

对于筛选出的每个条目，按照以下 JSON 格式进行返回。请确保输出是一个合法的 JSON 对象，格式如下：
{{
  "items": [
    {{
      "title": "中文标题（翻译并润色，使其对中国读者具有吸引力和可读性）",
      "originalTitle": "原始标题/项目名",
      "url": "原始链接",
      "source": "来源，必须是 'Hacker News' 或 'GitHub'",
      "category": "分类，必须是 'enterprise_efficiency' 或 'individual_productivity' 或 'github_trend'",
      "efficiencyGain": "1-2句中文解释该工具/新闻如何降本或增效，明确痛点和价值点",
      "summary": "{summary_sentences}句中文详细概述该技术或工具的背景、核心功能以及实际应用场景",
      "impactScore": "影响力评分，必须是 'High' 或 'Medium' 或 'Low' 中的一个",
      "tags": ["标签1", "标签2"]
    }}
  ]
}}

注意：
- 【严格禁止虚构，必须完全真实】你只能从我给出的待分析技术项目列表中筛选条目，严禁自行虚构、自我编造任何项目、新闻或外部URL。
- 每一个返回条目的 'url' 必须与我给出的输入列表中对应条目的 'url' 完全一致。
- 每一个返回条目的 'originalTitle' 必须与我给出的输入列表中对应条目的 'title' 完全一致。
- 严格遵循指定的三个 category (enterprise_efficiency, individual_productivity, github_trend) 和三个 impactScore (High, Medium, Low) 字符串。
- 标签数量限制在 {tag_count} 之间，如 "RAG", "MCP", "自动化" 等。
- 必须返回合法的 JSON 格式。"""

        user_prompt = f"这里是待分析的最新技术项目列表：\n{json.dumps(clean_input, indent=2, ensure_ascii=False)}"
        
        request_body = {
            "model": api_model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "temperature": 0.2,
            "response_format": { "type": "json_object" }
        }
        
        req_data = json.dumps(request_body).encode('utf-8')
        endpoint = f"{api_url}/chat/completions"
        
        req = urllib.request.Request(
            endpoint,
            data=req_data,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}'
            },
            method='POST'
        )
        
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                content = res_data['choices'][0]['message']['content'].strip()
                
                # Robust parse
                if content.startswith('```'):
                    content = content.replace('```json', '').replace('```', '').strip()
                
                parsed_json = json.loads(content)
                return parsed_json.get('items', [])
                
        except urllib.error.HTTPError as he:
            err_body = he.read().decode('utf-8') if he else ''
            raise Exception(f"DeepSeek API error ({he.code}): {err_body}")

# Main execution
if __name__ == '__main__':
    init_db()
    # Change working directory to ensure file server points to workspace root
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Avoid socket in-use issues
    class SingleThreadedHTTPServer(http.server.HTTPServer):
        allow_reuse_address = True

    with SingleThreadedHTTPServer(("", PORT), APIRequestHandler) as httpd:
        print(f"==================================================")
        print(f" AI EffiHub Backend & Database Server running")
        print(f" URL: http://localhost:{PORT}")
        print(f" Database file: {os.path.abspath(DB_FILE)}")
        print(f"==================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.shutdown()
