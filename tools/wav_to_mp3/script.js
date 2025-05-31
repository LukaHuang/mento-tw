document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    const fileItems = document.getElementById('fileItems');
    const convertBtn = document.getElementById('convertBtn');
    const outputFormat = document.getElementById('outputFormat');
    const bitrate = document.getElementById('bitrate');
    const conversionStatus = document.getElementById('conversionStatus');
    const downloadSection = document.getElementById('downloadSection');
    const downloadAllLink = document.getElementById('downloadAllLink');
    const progressContainer = document.querySelector('.progress-container');
    const overallProgressBar = document.getElementById('overallProgressBar');
    const overallProgressText = document.getElementById('overallProgressText');
    const currentProgressBar = document.getElementById('currentProgressBar');
    const currentProgressText = document.getElementById('currentProgressText');

    let files = [];
    let audioContext = null;
    let convertedFiles = [];

    // Drag and drop handlers
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropArea.classList.add('highlight');
    }

    function unhighlight() {
        dropArea.classList.remove('highlight');
    }

    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        handleFiles(dt.files);
    }

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    async function handleFiles(newFiles) {
        for (let file of newFiles) {
            if (file.type.startsWith('audio/')) {
                files.push(file);
                await addFileToList(file);
            }
        }
        updateConvertButton();
    }

    async function addFileToList(file) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.fileName = file.name;

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-item-info';

        const fileName = document.createElement('div');
        fileName.className = 'file-item-name';
        fileName.textContent = file.name;

        const fileDetails = document.createElement('div');
        fileDetails.className = 'file-item-details';
        fileDetails.textContent = `${formatFileSize(file.size)}`;

        const removeButton = document.createElement('button');
        removeButton.className = 'file-item-remove';
        removeButton.textContent = '×';
        removeButton.onclick = () => removeFile(file.name);

        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileDetails);
        fileItem.appendChild(fileInfo);
        fileItem.appendChild(removeButton);
        fileItems.appendChild(fileItem);

        // Get and display duration
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const duration = audioBuffer.duration;
            fileDetails.textContent += ` • ${formatDuration(duration)}`;
        } catch (error) {
            console.error('Error getting duration:', error);
        }
    }

    function removeFile(fileName) {
        files = files.filter(file => file.name !== fileName);
        const fileItem = fileItems.querySelector(`[data-file-name="${fileName}"]`);
        if (fileItem) {
            fileItem.remove();
        }
        updateConvertButton();
    }

    function updateConvertButton() {
        convertBtn.disabled = files.length === 0;
    }

    function formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function updateProgress(current, total, isOverall = false) {
        const percent = (current / total) * 100;
        if (isOverall) {
            overallProgressBar.style.width = `${percent}%`;
            overallProgressText.textContent = `${Math.round(percent)}%`;
        } else {
            currentProgressBar.style.width = `${percent}%`;
            currentProgressText.textContent = `${Math.round(percent)}%`;
        }
    }

    convertBtn.addEventListener('click', async () => {
        if (files.length === 0) return;

        try {
            conversionStatus.textContent = 'Converting...';
            convertBtn.disabled = true;
            progressContainer.style.display = 'block';
            convertedFiles = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                conversionStatus.textContent = `Converting ${i + 1}/${files.length}: ${file.name}`;
                updateProgress(i, files.length, true);
                updateProgress(0, 100, false);

                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const arrayBuffer = await file.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                const convertedBlob = await convertAudio(audioBuffer, outputFormat.value, parseInt(bitrate.value));
                convertedFiles.push({
                    blob: convertedBlob,
                    name: file.name.split('.')[0] + '.' + outputFormat.value
                });
            }

            // Create zip file with all converted files
            const zip = new JSZip();
            convertedFiles.forEach(file => {
                zip.file(file.name, file.blob);
            });

            const zipBlob = await zip.generateAsync({type: 'blob'});
            const url = URL.createObjectURL(zipBlob);
            downloadAllLink.href = url;
            downloadAllLink.download = 'converted_files.zip';
            
            conversionStatus.textContent = 'All files converted successfully!';
            downloadSection.style.display = 'block';
            updateProgress(files.length, files.length, true);
        } catch (error) {
            console.error('Conversion error:', error);
            conversionStatus.textContent = 'Error during conversion';
        } finally {
            convertBtn.disabled = false;
        }
    });

    async function convertAudio(audioBuffer, targetFormat, bitrate) {
        // Create an offline audio context
        const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );

        // Create a buffer source
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start();

        // Render the audio
        const renderedBuffer = await offlineContext.startRendering();

        // Convert to the target format
        if (targetFormat === 'mp3') {
            return convertToMP3(renderedBuffer, bitrate);
        } else {
            return convertToWAV(renderedBuffer);
        }
    }

    function convertToWAV(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;

        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = audioBuffer.length * blockAlign;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        // RIFF identifier
        writeString(view, 0, 'RIFF');
        // RIFF chunk length
        view.setUint32(4, 36 + dataSize, true);
        // RIFF type
        writeString(view, 8, 'WAVE');
        // format chunk identifier
        writeString(view, 12, 'fmt ');
        // format chunk length
        view.setUint32(16, 16, true);
        // sample format (raw)
        view.setUint16(20, format, true);
        // channel count
        view.setUint16(22, numChannels, true);
        // sample rate
        view.setUint32(24, sampleRate, true);
        // byte rate (sample rate * block align)
        view.setUint32(28, byteRate, true);
        // block align (channel count * bytes per sample)
        view.setUint16(32, blockAlign, true);
        // bits per sample
        view.setUint16(34, bitDepth, true);
        // data chunk identifier
        writeString(view, 36, 'data');
        // data chunk length
        view.setUint32(40, dataSize, true);

        // Write the PCM samples
        const offset = 44;
        const channelData = [];
        for (let i = 0; i < numChannels; i++) {
            channelData.push(audioBuffer.getChannelData(i));
        }

        let pos = 0;
        while (pos < audioBuffer.length) {
            for (let i = 0; i < numChannels; i++) {
                const sample = Math.max(-1, Math.min(1, channelData[i][pos]));
                const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset + pos * blockAlign + i * bytesPerSample, value, true);
            }
            pos++;
            // Update progress
            if (pos % 1000 === 0) {
                updateProgress(pos, audioBuffer.length, false);
            }
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    function convertToMP3(audioBuffer, bitrate) {
        const mp3encoder = new lamejs.Mp3Encoder(audioBuffer.numberOfChannels, audioBuffer.sampleRate, bitrate);
        const mp3Data = [];
        const sampleBlockSize = 1152; // must be multiple of 576
        const numChannels = audioBuffer.numberOfChannels;
        const samples = new Int16Array(sampleBlockSize * numChannels);
        const mp3buf = new Int8Array(1152 * 1.25 + 7200);

        let offset = 0;
        while (offset < audioBuffer.length) {
            const remaining = audioBuffer.length - offset;
            const blockSize = Math.min(sampleBlockSize, remaining);

            // Get samples for all channels
            for (let i = 0; i < blockSize; i++) {
                for (let channel = 0; channel < numChannels; channel++) {
                    const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[offset + i]));
                    samples[i * numChannels + channel] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                }
            }

            // Encode the samples
            const encoded = mp3encoder.encodeBuffer(samples);
            if (encoded.length > 0) {
                mp3Data.push(encoded);
            }

            offset += blockSize;
            // Update progress
            updateProgress(offset, audioBuffer.length, false);
        }

        // Flush the encoder
        const end = mp3encoder.flush();
        if (end.length > 0) {
            mp3Data.push(end);
        }

        return new Blob(mp3Data, { type: 'audio/mp3' });
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
}); 