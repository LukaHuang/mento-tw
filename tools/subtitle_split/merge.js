document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const settingsSection = document.getElementById('settingsSection');
    const fileList = document.getElementById('fileList');
    const mergeButton = document.getElementById('mergeButton');

    let uploadedFiles = [];

    // 拖放處理
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    // 點擊上傳
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // 處理上傳的檔案
    async function handleFiles(files) {
        for (const file of files) {
            if (!file.name.toLowerCase().endsWith('.srt')) {
                alert(`檔案 ${file.name} 不是 .srt 格式！`);
                continue;
            }

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

        // 依照起始編號排序
        uploadedFiles.sort((a, b) => a.firstNumber - b.firstNumber);
        
        // 更新界面
        updateFileList();
        settingsSection.style.display = 'block';
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

    // 更新檔案列表
    function updateFileList() {
        fileList.innerHTML = uploadedFiles.map((file, index) => `
            <div class="file-item">
                <div class="file-info">
                    <div class="file-name">${file.file.name}</div>
                    <div class="file-range">字幕範圍：${file.firstNumber} - ${file.lastNumber}</div>
                </div>
                <button class="remove-btn" data-index="${index}">移除</button>
            </div>
        `).join('');

        // 添加移除按鈕事件
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                uploadedFiles.splice(index, 1);
                updateFileList();
                mergeButton.disabled = uploadedFiles.length < 2;
            });
        });
    }

    // 合併檔案
    mergeButton.addEventListener('click', () => {
        if (uploadedFiles.length < 2) return;

        // 檢查是否有重疊的範圍
        for (let i = 0; i < uploadedFiles.length - 1; i++) {
            if (uploadedFiles[i].lastNumber >= uploadedFiles[i + 1].firstNumber) {
                alert('檢測到字幕範圍重疊！請確保檔案範圍不重疊。');
                return;
            }
        }

        // 合併所有內容
        const mergedContent = uploadedFiles
            .map(file => file.content.trim())
            .join('\n\n') + '\n';

        // 下載合併後的檔案
        const blob = new Blob([mergedContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `merged_subtitles_${timestamp}.srt`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}); 