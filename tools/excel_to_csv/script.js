document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const fileListContent = document.getElementById('fileListContent');
    const progressContainer = document.getElementById('progressContainer');
    const progress = document.getElementById('progress');
    const progressText = document.getElementById('progressText');
    const convertBtn = document.getElementById('convertBtn');
    const result = document.getElementById('result');
    const resultMessage = document.getElementById('resultMessage');
    const downloadLinks = document.getElementById('downloadLinks');

    let currentFiles = [];

    // 更新進度條函數
    function updateProgress(percent) {
        progressContainer.style.display = 'block';
        progress.style.width = `${percent}%`;
        progressText.textContent = `${Math.round(percent)}%`;
    }

    // 拖放事件處理
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropZone.classList.add('dragover');
    }

    function unhighlight() {
        dropZone.classList.remove('dragover');
    }

    dropZone.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFileSelect, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = Array.from(dt.files);
        if (files.length > 0) {
            handleFiles(files);
        }
    }

    function handleFileSelect(e) {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            handleFiles(files);
        }
    }

    function handleFiles(files) {
        const validFiles = files.filter(file => {
            const fileExtension = file.name.split('.').pop().toLowerCase();
            return ['xlsx', 'xls'].includes(fileExtension);
        });

        if (validFiles.length === 0) {
            showError('請上傳 Excel 檔案 (.xlsx 或 .xls)');
            return;
        }

        currentFiles = [...currentFiles, ...validFiles];
        updateFileList();
        convertBtn.disabled = false;
    }

    function updateFileList() {
        fileListContent.innerHTML = '';
        if (currentFiles.length > 0) {
            fileList.style.display = 'block';
            currentFiles.forEach((file, index) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${formatFileSize(file.size)}</span>
                    <button class="remove-file" onclick="removeFile(${index})">×</button>
                `;
                fileListContent.appendChild(fileItem);
            });
        } else {
            fileList.style.display = 'none';
        }
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    convertBtn.addEventListener('click', async () => {
        if (currentFiles.length === 0) return;

        try {
            convertBtn.disabled = true;
            progressContainer.style.display = 'block';
            result.style.display = 'none';
            downloadLinks.innerHTML = '';

            // 顯示 25% 進度
            updateProgress(25);

            const zip = new JSZip();
            let processedCount = 0;

            for (let i = 0; i < currentFiles.length; i++) {
                const file = currentFiles[i];
                const data = await readExcelFile(file);
                if (!data || data.length === 0) {
                    throw new Error(`檔案 ${file.name} 內容為空`);
                }

                const csvContent = convertToCSV(data);
                const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
                zip.file(`${fileNameWithoutExt}.csv`, csvContent);

                processedCount++;
                const progressPercent = 25 + (processedCount / currentFiles.length) * 50;
                updateProgress(progressPercent);
            }

            // 顯示 75% 進度
            updateProgress(75);

            const zipContent = await zip.generateAsync({ type: 'blob' });
            const zipUrl = URL.createObjectURL(zipContent);
            
            const downloadLink = document.createElement('a');
            downloadLink.href = zipUrl;
            downloadLink.download = 'converted_files.zip';
            downloadLink.className = 'download-btn';
            downloadLink.textContent = '下載 ZIP 檔案';
            downloadLinks.appendChild(downloadLink);

            // 顯示 100% 進度
            updateProgress(100);

            result.style.display = 'block';
            resultMessage.textContent = '轉換完成！';
            convertBtn.disabled = false;
        } catch (error) {
            showError(error.message);
            convertBtn.disabled = false;
        }
    });

    function readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const workbook = XLSX.read(e.target.result, { 
                        type: 'array',
                        cellDates: true,
                        raw: false,
                        dateNF: 'yyyy-mm-dd',
                        defval: ''
                    });
                    
                    // 尋找名為 "票券資訊 (已完成)" 的工作表
                    const targetSheetName = workbook.SheetNames.find(name => 
                        name.includes('票券資訊') && name.includes('已完成')
                    );
                    
                    if (!targetSheetName) {
                        throw new Error(`檔案 ${file.name} 中找不到「票券資訊 (已完成)」工作表`);
                    }
                    
                    const data = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheetName], {
                        header: 1,
                        defval: '',
                        raw: false,
                        dateNF: 'yyyy-mm-dd'
                    });
                    
                    resolve(data);
                } catch (error) {
                    reject(new Error(`Excel 解析錯誤: ${error.message}`));
                }
            };

            reader.onerror = function() {
                reject(new Error(`讀取檔案 ${file.name} 時發生錯誤`));
            };

            reader.readAsArrayBuffer(file);
        });
    }

    function convertToCSV(data) {
        if (!data || data.length === 0) {
            return '';
        }

        // 獲取所有欄位名稱
        const allFields = Object.keys(data[0]);

        // 處理每一行資料
        const processedData = data.map(row => {
            const newRow = {};
            allFields.forEach(field => {
                // 處理空白值
                let value = row[field];
                if (value === undefined || value === null) {
                    value = '';
                } else {
                    // 轉換為字串並移除前後空白
                    value = String(value).trim();
                }
                newRow[field] = value;
            });
            return newRow;
        });

        // 轉換為 CSV
        return Papa.unparse(processedData, {
            header: true,
            delimiter: ',',
            newline: '\n'
        });
    }

    function showError(message) {
        result.style.display = 'block';
        resultMessage.innerHTML = `<div class="error">${message}</div>`;
    }

    window.removeFile = function(index) {
        currentFiles.splice(index, 1);
        updateFileList();
        if (currentFiles.length === 0) {
            convertBtn.disabled = true;
        }
    };
}); 