// 工具：安全檔名
function safeFilename(s) {
    if (!s) return "";
    s = String(s).trim().replace(/[\n\r]/g, '');
    s = s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_\s]/g, '_');
    return s.substring(0, 40);
}

// 工具：欄位名稱正規化
function normalizeKey(key) {
    return key.trim().replace(/\ufeff/g, '').replace(/\s+/g, '_').toLowerCase();
}

// 工具：Actors 欄位取作者
function parseActors(actorsStr) {
    if (!actorsStr) return 'Unknown';
    const lines = actorsStr.split('\n');
    for (const line of lines) {
        if (line.startsWith('name:')) {
            return line.replace('name:', '').trim().replace(/\s+/g, '_');
        }
    }
    return 'Unknown';
}

// 取得 publish_time 的 YYYY-MM-DD
function getPublishDate(row) {
    const pub = row.publish_time || '';
    if (!pub) return '';
    try {
        const dt = new Date(pub.replace('Z', '+00:00'));
        return dt.toISOString().split('T')[0];
    } catch (e) {
        return pub.substring(0, 10);
    }
}

// 產生 markdown 內容
function dictToMarkdown(row) {
    let md = '---\n';
    
    // 基本資訊
    if (row.post_id) md += `post_id: ${row.post_id}\n`;
    if (row.feedback_id) md += `feedback_id: ${row.feedback_id}\n`;
    if (row.type) md += `type: ${row.type}\n`;
    
    // 作者資訊
    if (row.actors) {
        const actor = parseActors(row.actors);
        md += `author: ${actor}\n`;
    }
    
    // 互動資訊
    if (row.comments) md += `comments: ${row.comments}\n`;
    if (row.likes) md += `likes: ${row.likes}\n`;
    if (row.shares) md += `shares: ${row.shares}\n`;
    if (row.video_view_count) md += `video_view_count: ${row.video_view_count}\n`;
    
    // 時間資訊
    if (row.publish_time) md += `publish_time: ${row.publish_time}\n`;
    if (row.scraped_at) md += `scraped_at: ${row.scraped_at}\n`;
    
    // 連結資訊
    if (row.page_url) md += `page_url: ${row.page_url}\n`;
    if (row.post_url) md += `post_url: ${row.post_url}\n`;
    
    // 附件資訊
    if (row.attachments) md += `attachments: ${row.attachments}\n`;
    if (row.subattachments) md += `subattachments: ${row.subattachments}\n`;
    
    md += '---\n\n';
    
    // 主要內容
    if (row.text) {
        // 取出第一行作為標題
        const lines = row.text.split(/\r?\n/);
        if (lines.length > 0) {
            md += `# ${lines[0]}\n`;
            // 其餘內容
            let rest = lines.slice(1).join('\n');
            // 將 ▋ 替換為換行加上 ##
            rest = rest.replace(/▋/g, '## ▋');
            if (rest.trim().length > 0) {
                md += rest + '\n';
            }
        } else {
            // 若沒有換行，整段都當標題
            md += `# ${row.text}\n`;
        }
    }
    
    return md;
}

// 將 csv row 轉成 dict，key 統一為小寫底線格式
function rowToDict(row) {
    const result = {};
    for (const [key, value] of Object.entries(row)) {
        result[normalizeKey(key)] = value;
    }
    return result;
}

class CsvPreviewer {
    constructor() {
        this.rows = [];
        this.currentIndex = 0;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('csvFile').addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('convertBtn').addEventListener('click', () => this.startConvert());
        document.getElementById('prevBtn').addEventListener('click', () => this.prevRow());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextRow());
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            Papa.parse(e.target.result, {
                header: true,
                complete: (results) => {
                    this.rows = results.data.map(rowToDict);
                    this.currentIndex = 0;
                    this.updateUI();
                    document.getElementById('convertBtn').disabled = false;
                }
            });
        };
        reader.readAsText(file);
    }

    updateUI() {
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const totalRows = document.getElementById('totalRows');
        const currentRow = document.getElementById('currentRow');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');

        if (this.rows.length > 0) {
            fileInfo.style.display = 'block';
            fileName.textContent = document.getElementById('csvFile').files[0].name;
            totalRows.textContent = this.rows.length;
            currentRow.textContent = this.currentIndex + 1;
            prevBtn.disabled = this.currentIndex === 0;
            nextBtn.disabled = this.currentIndex === this.rows.length - 1;
            this.showMarkdownPreview(this.rows[this.currentIndex]);
        } else {
            fileInfo.style.display = 'none';
            prevBtn.disabled = true;
            nextBtn.disabled = true;
        }
    }

    showMarkdownPreview(row) {
        const md = dictToMarkdown(row);
        const preview = document.getElementById('preview');
        preview.value = md;
    }

    prevRow() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateUI();
        }
    }

    nextRow() {
        if (this.currentIndex < this.rows.length - 1) {
            this.currentIndex++;
            this.updateUI();
        }
    }

    async startConvert() {
        const file = document.getElementById('csvFile').files[0];
        if (!file) return;

        // 顯示轉換中的狀態
        const convertBtn = document.getElementById('convertBtn');
        const originalText = convertBtn.textContent;
        convertBtn.disabled = true;
        convertBtn.textContent = 'Converting...';

        try {
            const status = [];
            for (const row of this.rows) {
                const actor = parseActors(row.actors);
                const publishDate = getPublishDate(row);
                const safeText = safeFilename(row.text);
                const filename = `${publishDate}_${safeText}.md`;
                const markdown = dictToMarkdown(row);
                
                status.push({
                    filename,
                    content: markdown,
                    actor
                });
            }

            // 建立下載連結
            const zip = new JSZip();
            for (const item of status) {
                zip.folder(item.actor).file(item.filename, item.content);
            }

            const content = await zip.generateAsync({type: "blob"});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = 'converted_files.zip';
            link.click();

            // 顯示成功訊息
            convertBtn.textContent = 'Converted!';
            setTimeout(() => {
                convertBtn.textContent = originalText;
                convertBtn.disabled = false;
            }, 2000);
        } catch (error) {
            console.error('Conversion error:', error);
            convertBtn.textContent = 'Error!';
            setTimeout(() => {
                convertBtn.textContent = originalText;
                convertBtn.disabled = false;
            }, 2000);
        }
    }
}

// 初始化應用
document.addEventListener('DOMContentLoaded', () => {
    new CsvPreviewer();
});