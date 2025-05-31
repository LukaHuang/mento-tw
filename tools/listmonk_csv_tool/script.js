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
    const fieldMapping = document.getElementById('fieldMapping');
    const emailField = document.getElementById('emailField');
    const nameField = document.getElementById('nameField');
    const attributesField = document.getElementById('attributesField');
    const attributesCheckboxes = document.getElementById('attributesCheckboxes');
    const detectBtn = document.getElementById('detectBtn');
    const warningMessage = document.getElementById('warningMessage');
    const warningContent = document.getElementById('warningContent');

    let files = new Map();
    let currentFile = null;
    let fileHeaders = [];
    let selectedAttributes = new Set();
    const STORAGE_KEY = 'csv_converter_settings';
    let fieldMappingCompleted = false;
    let fileHeadersMap = new Map();

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
        const newFiles = Array.from(dt.files);
        addFiles(newFiles);
    }

    function handleFileSelect(e) {
        const newFiles = Array.from(e.target.files);
        addFiles(newFiles);
    }

    function addFiles(newFiles) {
        newFiles.forEach(file => {
            const fileExtension = file.name.split('.').pop().toLowerCase();
            if (['xlsx', 'csv'].includes(fileExtension)) {
                if (!files.has(file.name)) {
                    files.set(file.name, file);
                }
            } else {
                showError(`不支援的檔案格式: ${file.name}。請上傳 .xlsx 或 .csv 檔案。`);
            }
        });
        updateFileList();
        updateDetectButton();
        fieldMappingCompleted = false;
        fieldMapping.style.display = 'none';
        convertBtn.disabled = true;
    }

    function removeFile(fileName) {
        files.delete(fileName);
        updateFileList();
        updateDetectButton();
        fieldMappingCompleted = false;
        fieldMapping.style.display = 'none';
        convertBtn.disabled = true;
    }

    function updateFileList() {
        fileListContent.innerHTML = '';
        if (files.size > 0) {
            fileList.style.display = 'block';
            files.forEach((file, fileName) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <span class="file-name">${fileName}</span>
                    <span class="file-size">${formatFileSize(file.size)}</span>
                    <button class="remove-file" onclick="removeFile('${fileName}')">×</button>
                `;
                fileListContent.appendChild(fileItem);
            });
        } else {
            fileList.style.display = 'none';
        }
    }

    function updateDetectButton() {
        detectBtn.disabled = files.size === 0;
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function saveSettings() {
        const settings = {
            emailField: emailField.value,
            nameField: nameField.value,
            selectedAttributes: Array.from(selectedAttributes)
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    function loadSettings() {
        const savedSettings = localStorage.getItem(STORAGE_KEY);
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            emailField.value = settings.emailField;
            nameField.value = settings.nameField;
            selectedAttributes = new Set(settings.selectedAttributes);
            
            // 更新 checkbox 狀態
            fileHeaders.forEach(header => {
                const checkbox = document.getElementById(`attr-${header}`);
                if (checkbox) {
                    checkbox.checked = selectedAttributes.has(header);
                }
            });
        }
    }

    function showError(message) {
        const resultDiv = document.getElementById('result');
        resultDiv.innerHTML = `
            <div class="error">
                <h3>Error</h3>
                <p>${message}</p>
                <button id="showDebug" class="btn btn-secondary">Show Debug Information</button>
            </div>
        `;
        
        document.getElementById('showDebug').addEventListener('click', function() {
            const debugInfo = document.getElementById('debugInfo');
            debugInfo.style.display = 'block';
        });
    }

    function showDebugInfo(originalData, errorMessage, fieldMappings) {
        const debugInfo = document.getElementById('debugInfo');
        const originalDataPre = document.getElementById('originalData');
        const errorMessagePre = document.getElementById('errorMessage');
        const fieldMappingsUl = document.getElementById('fieldMappings');

        originalDataPre.textContent = JSON.stringify(originalData, null, 2);

        errorMessagePre.textContent = errorMessage;

        fieldMappingsUl.innerHTML = '';
        fieldMappings.forEach(mapping => {
            const li = document.createElement('li');
            li.textContent = `${mapping.csvField} → ${mapping.requiredField}`;
            fieldMappingsUl.appendChild(li);
        });

        debugInfo.style.display = 'block';
    }

    function updateFieldMapping() {
        fieldMapping.style.display = 'block';
        
        [emailField, nameField].forEach(select => {
            select.innerHTML = '';
        });
        attributesCheckboxes.innerHTML = '';

        fileHeaders.forEach(header => {
            const option = document.createElement('option');
            option.value = header;
            option.textContent = header;
            [emailField, nameField].forEach(select => {
                select.appendChild(option.cloneNode(true));
            });

            const checkboxContainer = document.createElement('div');
            checkboxContainer.className = 'attribute-checkbox';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `attr-${header}`;
            checkbox.value = header;
            checkbox.checked = selectedAttributes.has(header);
            checkbox.addEventListener('change', handleAttributeCheckboxChange);

            const label = document.createElement('label');
            label.htmlFor = `attr-${header}`;
            label.textContent = header;

            checkboxContainer.appendChild(checkbox);
            checkboxContainer.appendChild(label);
            attributesCheckboxes.appendChild(checkboxContainer);
        });

        autoMatchFields();
        
        loadSettings();
    }

    function handleAttributeCheckboxChange(e) {
        const header = e.target.value;
        if (e.target.checked) {
            selectedAttributes.add(header);
        } else {
            selectedAttributes.delete(header);
        }
        saveSettings();
    }

    function autoMatchFields() {
        const emailPatterns = ['email', 'mail', '電子郵件', '信箱', 'Email'];
        const namePatterns = ['name', '姓名', '名稱', '訂購人姓名', '參加人姓名'];

        function findMatchingField(patterns) {
            return fileHeaders.find(header => 
                patterns.some(pattern => 
                    header.toLowerCase().includes(pattern.toLowerCase())
                )
            );
        }

        const emailMatch = findMatchingField(emailPatterns);
        const nameMatch = findMatchingField(namePatterns);

        if (emailMatch) {
            emailField.value = emailMatch;
        }
        if (nameMatch) {
            nameField.value = nameMatch;
        }

        // 只有在沒有儲存的設定時才自動選擇所有欄位
        const savedSettings = localStorage.getItem(STORAGE_KEY);
        if (!savedSettings) {
            fileHeaders.forEach(header => {
                if (header !== emailField.value && header !== nameField.value) {
                    selectedAttributes.add(header);
                    const checkbox = document.getElementById(`attr-${header}`);
                    if (checkbox) checkbox.checked = true;
                }
            });
            saveSettings();
        }
    }

    function convertExcelData(data) {
        return data.map(row => {
            const attributes = {};
            
            selectedAttributes.forEach(header => {
                if (row[header] !== undefined) {
                    attributes[header] = row[header];
                }
            });

            const newRow = {
                email: row[emailField.value],
                name: row[nameField.value],
                attributes: JSON.stringify(attributes)
            };
            
            newRow.email = newRow.email.replace(/\s+/g, '');

            if (!newRow.name.startsWith('"') || !newRow.name.endsWith('"')) {
                newRow.name = `"${newRow.name}"`;
            }

            return newRow;
        });
    }

    function convertCSVData(data) {
        return data.map(row => {
            const attributes = {};
            
            selectedAttributes.forEach(header => {
                if (row[header] !== undefined) {
                    attributes[header] = row[header];
                }
            });

            const newRow = {
                email: row[emailField.value],
                name: row[nameField.value],
                attributes: JSON.stringify(attributes)
            };
            
            newRow.email = newRow.email.replace(/\s+/g, '');

            if (!newRow.name.startsWith('"') || !newRow.name.endsWith('"')) {
                newRow.name = `"${newRow.name}"`;
            }

            return newRow;
        });
    }

    function convertData(data) {
        return data.map(row => {
            const attributes = {};
            
            selectedAttributes.forEach(header => {
                if (row[header] !== undefined) {
                    attributes[header] = row[header];
                }
            });

            const newRow = {
                email: row[emailField.value],
                name: row[nameField.value],
                attributes: JSON.stringify(attributes)
            };
            
            newRow.email = newRow.email.replace(/\s+/g, '');

            if (!newRow.name.startsWith('"') || !newRow.name.endsWith('"')) {
                newRow.name = `"${newRow.name}"`;
            }

            return newRow;
        });
    }

    emailField.addEventListener('change', saveSettings);
    nameField.addEventListener('change', saveSettings);

    function showWarning(message) {
        warningMessage.style.display = 'block';
        warningContent.textContent = message;
    }

    function hideWarning() {
        warningMessage.style.display = 'none';
    }

    function checkFileConsistency() {
        if (files.size === 0) {
            showError('請先上傳檔案');
            return false;
        }

        let firstFileHeaders = null;
        let inconsistentFiles = [];

        files.forEach((file, fileName) => {
            const fileExtension = fileName.split('.').pop().toLowerCase();
            if (!['xlsx', 'csv'].includes(fileExtension)) {
                showError(`不支援的檔案格式: ${fileName}。請上傳 .xlsx 或 .csv 檔案。`);
                return false;
            }
        });

        // 獲取第一個檔案的標頭
        const firstFile = Array.from(files.keys())[0];
        firstFileHeaders = fileHeadersMap.get(firstFile);

        if (!firstFileHeaders) {
            showError('無法讀取檔案標頭');
            return false;
        }

        // 檢查其他檔案的標頭是否一致
        for (const [fileName, headers] of fileHeadersMap.entries()) {
            if (fileName !== firstFile) {
                if (headers.length !== firstFileHeaders.length || 
                    !headers.every(header => firstFileHeaders.includes(header))) {
                    inconsistentFiles.push(fileName);
                }
            }
        }

        if (inconsistentFiles.length > 0) {
            showWarning('警告：多個檔案的欄位格式不一致，可能會導致轉換結果不正確。');
            return false;
        }
        return true;
    }

    detectBtn.addEventListener('click', async () => {
        if (files.size === 0) return;

        try {
            detectBtn.disabled = true;
            progressContainer.style.display = 'block';
            result.style.display = 'none';
            downloadLinks.innerHTML = '';
            hideWarning();

            let totalFiles = files.size;
            let processedFiles = 0;
            fileHeadersMap.clear();

            for (const [fileName, file] of files) {
                try {
                    const data = await readFile(file);
                    if (!data || data.length === 0) {
                        throw new Error('檔案內容為空');
                    }
                } catch (error) {
                    console.error(`Error reading ${fileName}:`, error);
                }

                processedFiles++;
                const progress = (processedFiles / totalFiles) * 100;
                updateProgress(progress);
            }

            if (!checkFileConsistency()) {
                showWarning('警告：多個檔案的欄位格式不一致，可能會導致轉換結果不正確。');
            }

            fieldMapping.style.display = 'block';
            detectBtn.disabled = false;
            convertBtn.disabled = false;
            fieldMappingCompleted = true;
        } catch (error) {
            showError(error.message);
            detectBtn.disabled = false;
        }
    });

    convertBtn.addEventListener('click', async () => {
        if (files.size === 0 || !fieldMappingCompleted) return;

        try {
            convertBtn.disabled = true;
            progressContainer.style.display = 'block';
            result.style.display = 'none';
            downloadLinks.innerHTML = '';

            let totalFiles = files.size;
            let processedFiles = 0;
            let successCount = 0;
            let errorCount = 0;
            let errorMessages = [];
            const zip = new JSZip();

            for (const [fileName, file] of files) {
                try {
                    const fileExtension = fileName.split('.').pop().toLowerCase();
                    const data = await readFile(file);
                    
                    if (!data || data.length === 0) {
                        throw new Error('檔案內容為空');
                    }

                    if (!emailField.value || !nameField.value) {
                        throw new Error('請選擇 email 和 name 欄位');
                    }

                    let convertedData;
                    if (fileExtension === 'xlsx') {
                        convertedData = convertExcelData(data);
                    } else if (fileExtension === 'csv') {
                        convertedData = convertCSVData(data);
                    }

                    const csvContent = Papa.unparse(convertedData);
                    
                    const csvFileName = fileName.replace(/\.[^/.]+$/, '') + '.csv';
                    zip.file(csvFileName, csvContent);

                    successCount++;
                } catch (error) {
                    console.error(`Error processing ${fileName}:`, error);
                    errorCount++;
                    errorMessages.push(`${fileName}: ${error.message}`);
                    showDebugInfo(data, error.message, getFieldMappings());
                }

                processedFiles++;
                const progress = (processedFiles / totalFiles) * 100;
                updateProgress(progress);
            }

            if (successCount > 0) {
                const zipContent = await zip.generateAsync({ type: 'blob' });
                const zipUrl = URL.createObjectURL(zipContent);
                const zipLink = document.createElement('a');
                zipLink.href = zipUrl;
                zipLink.download = 'converted_files.zip';
                zipLink.className = 'download-btn';
                zipLink.textContent = '下載所有檔案 (ZIP)';
                downloadLinks.appendChild(zipLink);
            }

            result.style.display = 'block';
            if (errorCount > 0) {
                resultMessage.innerHTML = `
                    轉換完成！<br>
                    成功: ${successCount}，失敗: ${errorCount}<br>
                    ${errorMessages.map(msg => `<div class="error-message">${msg}</div>`).join('')}
                `;
            } else {
                resultMessage.textContent = `轉換完成！成功: ${successCount}，失敗: ${errorCount}`;
            }
            convertBtn.disabled = false;
        } catch (error) {
            result.style.display = 'block';
            resultMessage.innerHTML = `轉換失敗: ${error.message}`;
            convertBtn.disabled = false;
        }
    });

    function updateProgress(percent) {
        progress.style.width = `${percent}%`;
        progressText.textContent = `${Math.round(percent)}%`;
    }

    function parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const workbook = XLSX.read(e.target.result, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const data = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);
                    
                    if (!data || data.length === 0) {
                        reject(new Error('Excel 檔案為空或格式不正確'));
                        return;
                    }

                    // 處理日期時間欄位
                    const processedData = data.map(row => {
                        const processedRow = { ...row };
                        Object.keys(processedRow).forEach(key => {
                            if (key.includes('時間') || key.includes('Time')) {
                                const date = new Date(processedRow[key]);
                                if (!isNaN(date)) {
                                    processedRow[key] = date.toISOString();
                                }
                            }
                        });
                        return processedRow;
                    });

                    fileHeaders = Object.keys(processedData[0] || {});
                    updateFieldMapping();
                    resolve(processedData);
                } catch (error) {
                    reject(new Error(`Excel 解析錯誤: ${error.message}`));
                }
            };

            reader.onerror = function() {
                reject(new Error('讀取 Excel 檔案時發生錯誤'));
            };

            reader.readAsArrayBuffer(file);
        });
    }

    function parseCSVFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const csvText = e.target.result;
                    Papa.parse(csvText, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                            const data = results.data;
                            if (!data || data.length === 0) {
                                reject(new Error('CSV 檔案為空或格式不正確'));
                                return;
                            }

                            // 處理日期時間欄位
                            const processedData = data.map(row => {
                                const processedRow = { ...row };
                                Object.keys(processedRow).forEach(key => {
                                    if (key.includes('時間') || key.includes('Time')) {
                                        const date = new Date(processedRow[key]);
                                        if (!isNaN(date)) {
                                            processedRow[key] = date.toISOString();
                                        }
                                    }
                                });
                                return processedRow;
                            });

                            fileHeaders = Object.keys(processedData[0] || {});
                            fileHeadersMap.set(file.name, fileHeaders);
                            updateFieldMapping();
                            fieldMappingCompleted = true;
                            convertBtn.disabled = false;
                            resolve(processedData);
                        },
                        error: (error) => {
                            reject(new Error(`CSV 解析錯誤: ${error.message}`));
                        }
                    });
                } catch (error) {
                    reject(new Error(`CSV 檔案處理錯誤: ${error.message}`));
                }
            };

            reader.onerror = function() {
                reject(new Error('讀取 CSV 檔案時發生錯誤'));
            };

            reader.readAsText(file, 'UTF-8');
        });
    }

    function readFile(file) {
        const fileExtension = file.name.split('.').pop().toLowerCase();
        
        if (fileExtension === 'xlsx') {
            return parseExcelFile(file);
        } else if (fileExtension === 'csv') {
            return parseCSVFile(file);
        } else {
            return Promise.reject(new Error('不支援的檔案格式'));
        }
    }

    function getFieldMappings() {
        // Implementation of getFieldMappings function
        // This is a placeholder and should be replaced with the actual implementation
        return [];
    }

    function validateData(data, fieldMappings) {
        // Implementation of validateData function
        // This is a placeholder and should be replaced with the actual implementation
        return { isValid: true };
    }

    function transformData(data, fieldMappings) {
        // Implementation of transformData function
        // This is a placeholder and should be replaced with the actual implementation
        return data;
    }

    function showSuccess(transformedData) {
        // Implementation of showSuccess function
        // This is a placeholder and should be replaced with the actual implementation
    }

    window.removeFile = removeFile;
}); 