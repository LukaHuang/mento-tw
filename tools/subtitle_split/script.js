document.addEventListener('DOMContentLoaded', () => {
    // 工具切換相關元素
    const splitToolBtn = document.getElementById('splitToolBtn');
    const mergeToolBtn = document.getElementById('mergeToolBtn');
    const splitTool = document.getElementById('splitTool');
    const mergeTool = document.getElementById('mergeTool');

    // 從 localStorage 讀取上次使用的工具
    const lastUsedTool = localStorage.getItem('lastUsedTool') || 'split';

    // 分割工具相關元素
    const splitDropZone = document.getElementById('splitDropZone');
    const splitFileInput = document.getElementById('splitFileInput');
    const splitSettings = document.getElementById('splitSettings');
    const splitFileName = document.getElementById('splitFileName');
    const totalLines = document.getElementById('totalLines');
    const linesPerFile = document.getElementById('linesPerFile');
    const splitButton = document.getElementById('splitButton');
    const previewList = document.getElementById('previewList');

    // 合併工具相關元素
    const mergeDropZone = document.getElementById('mergeDropZone');
    const mergeFileInput = document.getElementById('mergeFileInput');
    const mergeSettings = document.getElementById('mergeSettings');
    const mergeFileList = document.getElementById('mergeFileList');
    const mergeButton = document.getElementById('mergeButton');

    // 從 localStorage 讀取上次的行數設定
    const savedLinesPerFile = localStorage.getItem('linesPerFile');
    if (savedLinesPerFile) {
        linesPerFile.value = savedLinesPerFile;
    }

    // 監聽行數輸入，並保存到 localStorage
    linesPerFile.addEventListener('change', () => {
        localStorage.setItem('linesPerFile', linesPerFile.value);
        updatePreview();
    });

    // 工具切換功能
    function switchToTool(tool) {
        // 移除所有工具的 active 狀態
        splitToolBtn.classList.remove('active');
        mergeToolBtn.classList.remove('active');
        splitTool.classList.remove('active');
        mergeTool.classList.remove('active');

        // 設置選中工具的 active 狀態
        if (tool === 'split') {
            splitToolBtn.classList.add('active');
            splitTool.classList.add('active');
        } else {
            mergeToolBtn.classList.add('active');
            mergeTool.classList.add('active');
        }
        localStorage.setItem('lastUsedTool', tool);
    }

    splitToolBtn.addEventListener('click', () => switchToTool('split'));
    mergeToolBtn.addEventListener('click', () => switchToTool('merge'));

    // 初始化顯示上次使用的工具
    switchToTool(lastUsedTool);

    // 分割工具狀態
    let splitFile = null;
    let splitContent = '';
    let subtitleBlocks = [];

    // 合併工具狀態
    let uploadedFiles = [];

    // === 分割工具功能 ===
    // 拖放處理
    splitDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        splitDropZone.classList.add('dragover');
    });

    splitDropZone.addEventListener('dragleave', () => {
        splitDropZone.classList.remove('dragover');
    });

    splitDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        splitDropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleSplitFile(e.dataTransfer.files[0]);
        }
    });

    // 點擊上傳
    splitDropZone.addEventListener('click', () => {
        splitFileInput.click();
    });

    splitFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleSplitFile(e.target.files[0]);
        }
    });

    // 處理分割檔案
    function handleSplitFile(file) {
        if (!file.name.toLowerCase().endsWith('.srt')) {
            alert('請上傳 .srt 格式的檔案！');
            return;
        }

        splitFile = file;
        splitFileName.textContent = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            splitContent = e.target.result;
            subtitleBlocks = parseSubtitleBlocks(splitContent);
            totalLines.textContent = subtitleBlocks.length;
            splitSettings.style.display = 'block';
            updatePreview();
        };
        reader.readAsText(file, 'UTF-8');
    }

    // 解析字幕塊
    function parseSubtitleBlocks(content) {
        return content.trim().split('\n\n').filter(block => block.trim() !== '');
    }

    // 更新預覽
    function updatePreview() {
        const blocksPerFile = parseInt(linesPerFile.value) || 0;
        if (blocksPerFile <= 0) {
            previewList.innerHTML = '';
            splitButton.disabled = true;
            return;
        }

        const totalBlocks = subtitleBlocks.length;
        const files = Math.ceil(totalBlocks / blocksPerFile);
        
        let previewHTML = '';
        for (let i = 0; i < files; i++) {
            const startBlock = i * blocksPerFile + 1;
            const endBlock = Math.min((i + 1) * blocksPerFile, totalBlocks);
            previewHTML += `
                <div class="preview-item">
                    檔案 ${i + 1}: 第 ${startBlock} - ${endBlock} 字幕
                </div>
            `;
        }
        
        previewList.innerHTML = previewHTML;
        splitButton.disabled = false;
    }

    // 分割檔案
    splitButton.addEventListener('click', async () => {
        const blocksPerFile = parseInt(linesPerFile.value);
        if (blocksPerFile <= 0) return;

        splitButton.disabled = true;
        splitButton.textContent = '處理中...';

        try {
            const zip = new JSZip();
            const totalBlocks = subtitleBlocks.length;
            const files = Math.ceil(totalBlocks / blocksPerFile);

            for (let i = 0; i < files; i++) {
                const start = i * blocksPerFile;
                const end = Math.min((i + 1) * blocksPerFile, totalBlocks);
                const startNumber = i * blocksPerFile + 1;
                const endNumber = Math.min((i + 1) * blocksPerFile, totalBlocks);
                const fileContent = subtitleBlocks.slice(start, end).join('\n\n') + '\n';
                
                const baseName = splitFile.name.replace('.srt', '');
                zip.file(`${baseName}_${startNumber}-${endNumber}.srt`, fileContent);
            }

            const zipContent = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 9 }
            });

            const url = URL.createObjectURL(zipContent);
            const a = document.createElement('a');
            const baseName = splitFile.name.replace('.srt', '');
            const zipFileName = `${baseName}_split.zip`;
            a.href = url;
            a.download = zipFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            splitButton.textContent = '分割並下載';
            splitButton.disabled = false;
        } catch (error) {
            console.error('Error creating zip file:', error);
            alert('創建壓縮檔案時發生錯誤！');
            splitButton.textContent = '分割並下載';
            splitButton.disabled = false;
        }
    });

    // === 合併工具功能 ===
    // 拖放處理
    mergeDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        mergeDropZone.classList.add('dragover');
    });

    mergeDropZone.addEventListener('dragleave', () => {
        mergeDropZone.classList.remove('dragover');
    });

    mergeDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        mergeDropZone.classList.remove('dragover');
        handleMergeFiles(e.dataTransfer.files);
    });

    // 點擊上傳
    mergeDropZone.addEventListener('click', () => {
        mergeFileInput.click();
    });

    mergeFileInput.addEventListener('change', (e) => {
        handleMergeFiles(e.target.files);
    });

    // 處理合併檔案
    async function handleMergeFiles(files) {
        let hasTxtFile = false;
        for (const file of files) {
            const isTextFile = file.name.toLowerCase().endsWith('.txt');
            const isSrtFile = file.name.toLowerCase().endsWith('.srt');
            
            if (!isTextFile && !isSrtFile) {
                alert(`檔案 ${file.name} 不是支援的格式！請上傳 .srt 或 .txt 格式的檔案。`);
                continue;
            }

            if (isTextFile) {
                hasTxtFile = true;
            }
        }

        // 如果有 txt 檔案，詢問是否繼續
        if (hasTxtFile) {
            if (!confirm('偵測到有 .txt 格式的檔案，是否要繼續合併？')) {
                return;
            }
        }

        for (const file of files) {
            try {
                const content = await readFileContent(file);
                const { firstNumber, lastNumber } = getSubtitleRange(content);
                
                uploadedFiles.push({
                    file: file,
                    content: content,
                    firstNumber: firstNumber,
                    lastNumber: lastNumber
                });
            } catch (error) {
                console.error('Error processing file:', error);
                alert(`處理檔案 ${file.name} 時發生錯誤！`);
            }
        }

        uploadedFiles.sort((a, b) => a.firstNumber - b.firstNumber);
        updateMergeFileList();
        mergeSettings.style.display = 'block';
        mergeButton.disabled = uploadedFiles.length < 2;
    }

    // 讀取檔案內容
    function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file, 'UTF-8');
        });
    }

    // 獲取字幕範圍
    function getSubtitleRange(content) {
        const blocks = content.trim().split('\n\n');
        let firstNumber = Infinity;
        let lastNumber = -Infinity;

        for (const block of blocks) {
            const lines = block.split('\n');
            if (lines.length >= 1) {
                const number = parseInt(lines[0]);
                if (!isNaN(number)) {
                    firstNumber = Math.min(firstNumber, number);
                    lastNumber = Math.max(lastNumber, number);
                }
            }
        }

        return { firstNumber, lastNumber };
    }

    // 更新合併檔案列表
    function updateMergeFileList() {
        mergeFileList.innerHTML = uploadedFiles.map((file, index) => `
            <div class="file-item">
                <div class="file-info">
                    <div class="file-name">${file.file.name}</div>
                    <div class="file-range">字幕範圍：${file.firstNumber} - ${file.lastNumber}</div>
                </div>
                <button class="remove-btn" data-index="${index}">移除</button>
            </div>
        `).join('');

        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                uploadedFiles.splice(index, 1);
                updateMergeFileList();
                mergeButton.disabled = uploadedFiles.length < 2;
            });
        });
    }

    // 合併檔案
    mergeButton.addEventListener('click', () => {
        if (uploadedFiles.length < 2) return;

        // 檢查重疊的範圍
        const overlaps = [];
        for (let i = 0; i < uploadedFiles.length - 1; i++) {
            for (let j = i + 1; j < uploadedFiles.length; j++) {
                const file1 = uploadedFiles[i];
                const file2 = uploadedFiles[j];
                
                // 檢查是否有重疊
                if (file1.lastNumber >= file2.firstNumber && file1.firstNumber <= file2.lastNumber) {
                    const overlapStart = Math.max(file1.firstNumber, file2.firstNumber);
                    const overlapEnd = Math.min(file1.lastNumber, file2.lastNumber);
                    overlaps.push({
                        file1: file1.file.name,
                        file2: file2.file.name,
                        range: `${overlapStart}-${overlapEnd}`
                    });
                }
            }
        }

        // 如果有重疊，顯示詳細資訊並詢問是否繼續
        if (overlaps.length > 0) {
            let message = '檢測到以下字幕重疊：\n\n';
            overlaps.forEach(overlap => {
                message += `${overlap.file1} 和 ${overlap.file2}\n`;
                message += `重疊範圍：${overlap.range}\n\n`;
            });
            message += '後面的檔案將會覆蓋前面的檔案內容。\n是否要繼續合併？';

            if (!confirm(message)) {
                return;
            }
        }

        // 解析所有檔案的字幕塊
        const allSubtitles = new Map(); // 使用 Map 來存儲字幕，編號作為 key

        for (const file of uploadedFiles) {
            const blocks = file.content.trim().split('\n\n');
            
            for (const block of blocks) {
                const lines = block.split('\n');
                if (lines.length >= 1) {
                    const number = parseInt(lines[0]);
                    if (!isNaN(number)) {
                        // 後面的檔案會覆蓋前面的
                        allSubtitles.set(number, block);
                    }
                }
            }
        }

        // 將字幕按編號排序
        const sortedSubtitles = Array.from(allSubtitles.entries())
            .sort(([a], [b]) => a - b)
            .map(([_, block]) => block);

        // 合併所有字幕
        const mergedContent = sortedSubtitles.join('\n\n') + '\n';

        const blob = new Blob([mergedContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const firstFile = uploadedFiles[0].file.name.replace('.srt', '');
        a.download = `${firstFile}_merged.srt`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}); 