// ==UserScript==
// @name         MangaDex Cover Downloader
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Download high-resolution covers from MangaDex with automatic version detection
// @author       You
// @match        https://mangadex.org/title/*
// @match        https://mangadex.org/*
// @match        https://www.mangadex.org/title/*
// @match        https://www.mangadex.org/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // CSS für das UI
    const style = document.createElement('style');
    style.textContent = `
        #mangadex-downloader {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 1px solid #0f3460;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            min-width: 320px;
            max-width: 420px;
            backdrop-filter: blur(10px);
        }

        #mangadex-downloader h3 {
            margin: 0 0 15px 0;
            color: #ff6740;
            font-size: 18px;
            font-weight: 600;
            text-shadow: 0 2px 4px rgba(255, 103, 64, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        #mangadex-downloader button {
            background: linear-gradient(135deg, #ff6740 0%, #ff8360 100%);
            color: white;
            border: none;
            padding: 12px 16px;
            border-radius: 8px;
            cursor: pointer;
            margin: 6px 0;
            width: 100%;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(255, 103, 64, 0.3);
        }

        #mangadex-downloader button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(255, 103, 64, 0.4);
            background: linear-gradient(135deg, #ff8360 0%, #ff9980 100%);
        }

        #mangadex-downloader button:active {
            transform: translateY(0);
        }

        #mangadex-downloader button:disabled {
            background: linear-gradient(135deg, #2d2d44 0%, #1f1f2e 100%);
            cursor: not-allowed;
            box-shadow: none;
            opacity: 0.6;
        }

        #mangadex-downloader .analyze-button {
            background: linear-gradient(135deg, #00b4d8 0%, #0096c7 100%);
            box-shadow: 0 4px 12px rgba(0, 180, 216, 0.3);
        }

        #mangadex-downloader .analyze-button:hover {
            background: linear-gradient(135deg, #48cae4 0%, #00b4d8 100%);
            box-shadow: 0 6px 16px rgba(0, 180, 216, 0.4);
        }

        #mangadex-progress {
            margin-top: 12px;
            font-size: 13px;
            color: #e0e0e0;
            background: rgba(15, 52, 96, 0.4);
            padding: 10px 12px;
            border-radius: 8px;
            display: none;
            border-left: 3px solid #00b4d8;
        }

        #mangadex-log {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid #0f3460;
            padding: 10px;
            margin-top: 12px;
            font-size: 11px;
            color: #b8b8d1;
            background: rgba(0, 0, 0, 0.3);
            display: none;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
        }

        #mangadex-log::-webkit-scrollbar {
            width: 8px;
        }

        #mangadex-log::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
        }

        #mangadex-log::-webkit-scrollbar-thumb {
            background: #0f3460;
            border-radius: 4px;
        }

        #mangadex-log::-webkit-scrollbar-thumb:hover {
            background: #1a4d7a;
        }

        .mangadex-series-info {
            background: rgba(15, 52, 96, 0.3);
            padding: 12px;
            border-radius: 8px;
            margin: 12px 0;
            font-size: 13px;
            color: #e0e0e0;
            border-left: 3px solid #ff6740;
        }

        .mangadex-series-info strong {
            color: #48cae4;
        }

        .version-selector {
            background: rgba(15, 52, 96, 0.3);
            padding: 12px;
            border-radius: 8px;
            margin: 10px 0;
            display: none;
            border-left: 3px solid #00b4d8;
        }

        .version-selector h4 {
            margin: 0 0 10px 0;
            font-size: 13px;
            color: #48cae4;
        }

        .range-selector {
            background: rgba(15, 52, 96, 0.3);
            padding: 12px;
            border-radius: 8px;
            margin: 10px 0;
            display: none;
            border-left: 3px solid #00b4d8;
        }

        .range-selector h4 {
            margin: 0 0 10px 0;
            font-size: 13px;
            color: #48cae4;
        }

        .range-inputs {
            display: flex;
            gap: 10px;
            align-items: center;
            margin: 10px 0;
        }

        .range-inputs input {
            width: 60px;
            padding: 6px;
            border: 1px solid #0f3460;
            border-radius: 4px;
            font-size: 13px;
            background: rgba(0, 0, 0, 0.3);
            color: #e0e0e0;
        }

        .range-inputs label {
            font-size: 12px;
            color: #e0e0e0;
        }

        .range-selector small {
            color: #b8b8d1;
        }

        .version-option {
            display: flex;
            align-items: center;
            margin: 5px 0;
            padding: 8px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid #0f3460;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .version-option:hover {
            background: rgba(0, 180, 216, 0.2);
            border-color: #00b4d8;
        }

        .version-option input {
            margin-right: 8px;
        }

        .version-option label {
            cursor: pointer;
            flex: 1;
            color: #e0e0e0;
            font-size: 13px;
            font-weight: 500;
        }

        .show-log {
            display: block !important;
        }

        .show-progress {
            display: block !important;
        }

        .show-version-selector {
            display: block !important;
        }

        .show-range-selector {
            display: block !important;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        #mangadex-downloader {
            animation: fadeIn 0.4s ease-out;
        }
    `;
    document.head.appendChild(style);

    // UI erstellen
    const ui = document.createElement('div');
    ui.id = 'mangadex-downloader';
    ui.innerHTML = `
        <h3>📚 MangaDex Cover Downloader</h3>
        <div class="mangadex-series-info" id="series-info">Bereit zum Analysieren...</div>
        <button id="analyze-covers" class="analyze-button">🔍 Cover analysieren</button>
        <div class="version-selector" id="version-selector">
            <h4>Mehrere Versionen gefunden:</h4>
            <div id="version-options"></div>
            <button id="confirm-version">✓ Version auswählen</button>
        </div>
        <div class="range-selector" id="range-selector">
            <h4>Cover-Bereich auswählen:</h4>
            <div class="range-inputs">
                <label>Von:</label>
                <input type="number" id="range-from" min="1" value="1">
                <label>Bis:</label>
                <input type="number" id="range-to" min="1" value="1">
            </div>
            <small style="color: #666;">Leer lassen für alle Cover</small>
        </div>
        <button id="start-download" disabled style="display: none;">📁 Ordner wählen & herunterladen</button>
        <button id="toggle-log" style="display: none;">🔍 Details anzeigen</button>
        <div id="mangadex-progress"></div>
        <div id="mangadex-log"></div>
    `;
    document.body.appendChild(ui);

    const analyzeButton = document.getElementById('analyze-covers');
    const startButton = document.getElementById('start-download');
    const toggleLogButton = document.getElementById('toggle-log');
    const versionSelector = document.getElementById('version-selector');
    const versionOptions = document.getElementById('version-options');
    const confirmVersionButton = document.getElementById('confirm-version');
    const rangeSelector = document.getElementById('range-selector');
    const rangeFromInput = document.getElementById('range-from');
    const rangeToInput = document.getElementById('range-to');
    const progressDiv = document.getElementById('mangadex-progress');
    const logDiv = document.getElementById('mangadex-log');
    const seriesInfoDiv = document.getElementById('series-info');

    let isAnalyzing = false;
    let isDownloading = false;
    let allCovers = [];
    let selectedCovers = [];
    let seriesTitle = '';
    let mangaId = '';
    let selectedVersion = null;

    function log(message) {
        console.log('[MangaDex Cover Downloader]', message);
        logDiv.innerHTML += `<div>${new Date().toLocaleTimeString()}: ${message}</div>`;
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    function updateProgress(message) {
        progressDiv.innerHTML = message;
        progressDiv.classList.add('show-progress');
    }

    function hideProgress() {
        progressDiv.classList.remove('show-progress');
    }

    // Extrahiere Manga-ID aus URL
    function getMangaId() {
        const match = window.location.pathname.match(/\/title\/([a-f0-9-]+)/);
        return match ? match[1] : null;
    }

    // Hole Manga-Informationen via API
    async function getMangaInfo() {
        try {
            const response = await fetch(`https://api.mangadex.org/manga/${mangaId}?includes[]=cover_art`);
            const data = await response.json();
            
            if (data.result === 'ok') {
                const title = data.data.attributes.title.en || 
                             data.data.attributes.title['ja-ro'] || 
                             Object.values(data.data.attributes.title)[0] || 
                             'Unknown';
                return { title };
            }
        } catch (error) {
            log(`✗ Fehler beim Laden der Manga-Info: ${error.message}`);
        }
        return null;
    }

    // Hole alle Cover für diesen Manga
    async function getAllCovers() {
        try {
            let offset = 0;
            const limit = 100;
            const covers = [];

            while (true) {
                const response = await fetch(
                    `https://api.mangadex.org/cover?manga[]=${mangaId}&limit=${limit}&offset=${offset}&order[volume]=asc&locales[]=ja`
                );
                const data = await response.json();

                if (data.result === 'ok') {
                    log(`API lieferte ${data.data.length} Cover (offset ${offset})`);
                    
                    // Filtere strikt nach japanischen Covern UND gültigen Volume-Nummern
                    const jaCovers = data.data.filter(cover => {
                        const locale = cover.attributes.locale;
                        const volume = cover.attributes.volume;
                        
                        // Log jedes Cover zur Analyse
                        log(`Cover gefunden - Volume: ${volume}, Locale: ${locale || 'none'}`);
                        
                        // Überspringe Cover ohne Volume-Nummer
                        if (!volume || volume === null || volume === 'null') {
                            log(`  → Überspringe: Keine Volume-Nummer`);
                            return false;
                        }
                        
                        // Nur Cover mit locale 'ja' ODER ohne locale (Standard sind oft japanisch)
                        const isJapanese = !locale || locale === 'ja';
                        if (!isJapanese) {
                            log(`  → Überspringe: Nicht japanisch (${locale})`);
                        }
                        return isJapanese;
                    });
                    
                    log(`Nach Filter: ${jaCovers.length} japanische Cover mit Volume-Nummer`);
                    covers.push(...jaCovers);
                    
                    if (data.data.length < limit) {
                        break; // Keine weiteren Seiten
                    }
                    offset += limit;
                } else {
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 250));
            }

            // Entferne Duplikate basierend auf Volume-Nummer
            // Wenn es mehrere Cover für dasselbe Volume gibt, behalte nur das mit locale='ja'
            const volumeMap = new Map();
            covers.forEach(cover => {
                const vol = cover.attributes.volume;
                const locale = cover.attributes.locale;
                
                if (!volumeMap.has(vol)) {
                    volumeMap.set(vol, cover);
                } else {
                    // Wenn bereits ein Cover für dieses Volume existiert
                    const existing = volumeMap.get(vol);
                    // Bevorzuge das mit locale='ja'
                    if (locale === 'ja' && existing.attributes.locale !== 'ja') {
                        log(`Ersetze Cover für Volume ${vol}: ${existing.attributes.locale || 'none'} → ja`);
                        volumeMap.set(vol, cover);
                    }
                }
            });
            
            const uniqueCovers = Array.from(volumeMap.values());
            log(`Nach Duplikat-Entfernung: ${uniqueCovers.length} einzigartige Cover`);

            return uniqueCovers;
        } catch (error) {
            log(`✗ Fehler beim Laden der Cover: ${error.message}`);
            return [];
        }
    }

    // Parse Bandnummer (unterstützt 1, 1.1, 1.2, etc.)
    function parseVolume(volumeStr) {
        if (!volumeStr || volumeStr === 'null' || volumeStr === 'undefined') {
            return { main: 0, sub: 0 };
        }
        
        // Konvertiere zu String falls nötig
        const volString = String(volumeStr).trim();
        if (!volString) {
            return { main: 0, sub: 0 };
        }
        
        const parts = volString.split('.');
        const main = parseInt(parts[0]) || 0;
        const sub = parts.length > 1 ? parseInt(parts[1]) || 0 : 0;
        
        return { main, sub };
    }

    // Erkenne verfügbare Versionen (X, X.1, X.2, etc.)
    function detectVersions(covers) {
        const versions = new Set();
        const volumeMap = new Map(); // main volume -> Set of sub versions

        covers.forEach(cover => {
            const vol = parseVolume(cover.attributes.volume);
            
            if (!volumeMap.has(vol.main)) {
                volumeMap.set(vol.main, new Set());
            }
            volumeMap.get(vol.main).add(vol.sub);
        });

        // Prüfe ob es mehrere Versionen gibt
        let hasMultipleVersions = false;
        volumeMap.forEach((subs, main) => {
            if (subs.size > 1) {
                hasMultipleVersions = true;
            }
            subs.forEach(sub => {
                versions.add(sub);
            });
        });

        return {
            hasMultipleVersions,
            versions: Array.from(versions).sort((a, b) => a - b),
            volumeMap
        };
    }

    // Filtere Cover nach ausgewählter Version
    function filterCoversByVersion(covers, version) {
        return covers.filter(cover => {
            const vol = parseVolume(cover.attributes.volume);
            return vol.sub === version;
        }).sort((a, b) => {
            const volA = parseVolume(a.attributes.volume);
            const volB = parseVolume(b.attributes.volume);
            return volA.main - volB.main;
        });
    }

    // Zeige Versions-Auswahl
    function showVersionSelector(versionInfo) {
        versionOptions.innerHTML = '';
        
        versionInfo.versions.forEach(version => {
            const count = allCovers.filter(c => parseVolume(c.attributes.volume).sub === version).length;
            const label = version === 0 ? 'Standard (X)' : `Version X.${version}`;
            
            const optionDiv = document.createElement('div');
            optionDiv.className = 'version-option';
            
            const radioInput = document.createElement('input');
            radioInput.type = 'radio';
            radioInput.name = 'version';
            radioInput.value = version;
            radioInput.id = `version-${version}`;
            
            const labelElement = document.createElement('label');
            labelElement.htmlFor = `version-${version}`;
            labelElement.textContent = `${label} (${count} Cover)`;
            labelElement.style.color = '#333';
            labelElement.style.fontSize = '13px';
            
            optionDiv.appendChild(radioInput);
            optionDiv.appendChild(labelElement);
            
            optionDiv.addEventListener('click', () => {
                radioInput.checked = true;
            });
            
            versionOptions.appendChild(optionDiv);
        });

        // Wähle erste Option als Standard
        if (versionInfo.versions.length > 0) {
            document.getElementById(`version-${versionInfo.versions[0]}`).checked = true;
        }

        versionSelector.classList.add('show-version-selector');
    }

    async function analyzeCovers() {
        if (isAnalyzing) return;

        isAnalyzing = true;
        allCovers = [];
        selectedCovers = [];

        // UI anpassen
        analyzeButton.disabled = true;
        analyzeButton.textContent = '🔍 Analysiere...';
        toggleLogButton.style.display = 'block';
        logDiv.innerHTML = '';

        updateProgress('📡 Lade Manga-Informationen...');

        // Hole Manga-Info
        const mangaInfo = await getMangaInfo();
        if (mangaInfo) {
            seriesTitle = mangaInfo.title;
            log(`Serie gefunden: ${seriesTitle}`);
        }

        updateProgress('🖼️ Lade Cover-Liste...');

        // Hole alle Cover
        allCovers = await getAllCovers();
        
        if (allCovers.length === 0) {
            updateProgress('❌ Keine Cover gefunden');
            analyzeButton.disabled = false;
            analyzeButton.textContent = '🔍 Cover analysieren';
            isAnalyzing = false;
            return;
        }

        log(`${allCovers.length} Cover gefunden`);

        // Erkenne Versionen
        const versionInfo = detectVersions(allCovers);
        log(`Versionen erkannt: ${versionInfo.versions.join(', ')}`);

        if (versionInfo.hasMultipleVersions) {
            updateProgress(`⚠️ Mehrere Versionen gefunden - Bitte auswählen`);
            showVersionSelector(versionInfo);
            analyzeButton.style.display = 'none';
        } else {
            // Nur eine Version, direkt fortfahren
            selectedVersion = versionInfo.versions[0];
            selectedCovers = filterCoversByVersion(allCovers, selectedVersion);
            proceedToDownload();
        }

        isAnalyzing = false;
    }

    function proceedToDownload() {
        // Zeige Range-Selector
        rangeSelector.classList.add('show-version-selector');
        rangeToInput.value = selectedCovers.length;
        rangeToInput.max = selectedCovers.length;
        rangeFromInput.max = selectedCovers.length;
        
        updateProgress(`✅ ${selectedCovers.length} Cover gefunden`);
        
        seriesInfoDiv.innerHTML = `
            <strong>Serie:</strong> ${seriesTitle}<br>
            <strong>Cover:</strong> ${selectedCovers.length} japanische ${selectedVersion > 0 ? `(Version X.${selectedVersion})` : '(Standard)'}
        `;

        versionSelector.classList.remove('show-version-selector');
        startButton.style.display = 'block';
        startButton.disabled = false;
        startButton.textContent = `📁 Cover herunterladen`;

        log(`Bereit zum Download: ${selectedCovers.length} Cover`);
    }

    confirmVersionButton.addEventListener('click', () => {
        const selected = document.querySelector('input[name="version"]:checked');
        if (selected) {
            selectedVersion = parseInt(selected.value);
            selectedCovers = filterCoversByVersion(allCovers, selectedVersion);
            proceedToDownload();
        }
    });

    // Generiere Cover-URL
    function getCoverUrl(mangaId, filename, quality = 'original') {
        return `https://uploads.mangadex.org/covers/${mangaId}/${filename}`;
    }

    function sanitizeFilename(filename) {
        // Entferne Windows-inkompatible Zeichen: < > : " / \ | ? *
        // Sowie problematische Zeichen: ~ und Steuerzeichen
        let sanitized = filename
            .replace(/[<>:"/\\|?*~]/g, '_')  // Ersetze verbotene Zeichen
            .replace(/[\x00-\x1F\x7F]/g, '') // Entferne Steuerzeichen
            .replace(/^\.+/, '')              // Entferne führende Punkte
            .trim()                           // Entferne Leerzeichen an Anfang/Ende
            .replace(/[.\s]+$/, '');          // Entferne Punkte/Leerzeichen am Ende
        
        // Wenn der Name leer ist oder zu lang, verwende einen Standard
        if (!sanitized || sanitized.length === 0) {
            sanitized = 'Manga';
        }
        
        // Windows hat ein Limit von 255 Zeichen für Ordnernamen
        if (sanitized.length > 200) {
            sanitized = sanitized.substring(0, 200);
        }
        
        return sanitized;
    }

    // Download Cover
    async function downloadCover(coverUrl) {
        try {
            const response = await fetch(coverUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.blob();
        } catch (error) {
            log(`✗ Fehler beim Download: ${error.message}`);
            throw error;
        }
    }

    async function downloadToFolder() {
        if (isDownloading || selectedCovers.length === 0) return;

        // Überprüfe ob File System Access API verfügbar ist
        if (!window.showDirectoryPicker) {
            alert('Ihr Browser unterstützt keine direkten Ordner-Downloads. Bitte verwenden Sie Chrome oder Edge.');
            return;
        }

        // Hole Range-Werte
        const rangeFrom = parseInt(rangeFromInput.value) || 1;
        const rangeTo = parseInt(rangeToInput.value) || selectedCovers.length;
        
        // Validiere Range
        if (rangeFrom < 1 || rangeTo < rangeFrom || rangeTo > selectedCovers.length) {
            alert(`Ungültiger Bereich! Bitte wählen Sie zwischen 1 und ${selectedCovers.length}.`);
            return;
        }

        // Filtere Cover nach Range (Array ist 0-basiert, User-Input ist 1-basiert)
        const coversToDownload = selectedCovers.slice(rangeFrom - 1, rangeTo);
        
        log(`Lade Cover ${rangeFrom} bis ${rangeTo} (${coversToDownload.length} Cover)`);

        isDownloading = true;
        const originalText = startButton.textContent;
        startButton.disabled = true;
        startButton.textContent = '📁 Ordner wählen...';

        try {
            // Lasse Nutzer Ordner auswählen
            const directoryHandle = await window.showDirectoryPicker();

            // Erstelle Serienordner mit Windows-kompatiblem Namen
            const sanitizedSeriesName = sanitizeFilename(seriesTitle);
            const seriesFolderHandle = await directoryHandle.getDirectoryHandle(sanitizedSeriesName, { create: true });

            log(`Lade ${coversToDownload.length} Cover in Ordner: ${sanitizedSeriesName}`);

            let successCount = 0;

            // Lade alle Bilder herunter
            for (let i = 0; i < coversToDownload.length; i++) {
                const cover = coversToDownload[i];
                const volumeStr = cover.attributes.volume || 'unknown';
                
                // Debug-Logging
                log(`Cover ${i + 1}: volumeStr="${volumeStr}", type=${typeof volumeStr}`);

                try {
                    updateProgress(`📁 Lade ${i + 1}/${coversToDownload.length}: Band ${volumeStr}`);
                    startButton.textContent = `📁 Lade ${i + 1}/${coversToDownload.length}...`;

                    const coverUrl = getCoverUrl(mangaId, cover.attributes.fileName);
                    const imageBlob = await downloadCover(coverUrl);

                    // Bestimme Dateinamen - verwende die tatsächliche Volume-Nummer
                    const extension = cover.attributes.fileName.split('.').pop() || 'jpg';
                    const vol = parseVolume(volumeStr);
                    
                    log(`Parsed volume: main=${vol.main}, sub=${vol.sub}`);
                    
                    // Verwende die tatsächliche Volume-Nummer aus MangaDex
                    let fileName;
                    if (vol.main === 0 || volumeStr === 'unknown') {
                        // Wenn keine Volume-Nummer, verwende 'unknown' oder Index
                        fileName = `unknown_${i + 1}.${extension}`;
                        log(`⚠️ Keine Volume-Nummer, verwende: ${fileName}`);
                    } else {
                        // Verwende die echte Volume-Nummer
                        fileName = `${vol.main}.${extension}`;
                    }

                    // Schreibe Datei in Serienordner
                    const fileHandle = await seriesFolderHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(imageBlob);
                    await writable.close();

                    successCount++;
                    log(`✓ Gespeichert: ${fileName} (Band ${volumeStr})`);

                } catch (error) {
                    log(`✗ Fehler bei Band ${volumeStr}: ${error.message}`);
                }

                // Kurze Pause zwischen Downloads
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            updateProgress(`✅ Download abgeschlossen! ${successCount}/${coversToDownload.length} Cover gespeichert in "${sanitizedSeriesName}"`);
            startButton.textContent = '✅ Fertig!';

            setTimeout(() => {
                startButton.textContent = originalText;
                startButton.disabled = false;
            }, 3000);

        } catch (error) {
            if (error.name === 'AbortError') {
                updateProgress('❌ Download abgebrochen');
                startButton.textContent = '❌ Abgebrochen';
            } else {
                console.error('Fehler beim Ordner-Download:', error);
                updateProgress('❌ Download-Fehler: ' + error.message);
                startButton.textContent = '❌ Fehler';
            }

            setTimeout(() => {
                startButton.textContent = originalText;
                startButton.disabled = false;
            }, 3000);
        } finally {
            isDownloading = false;
        }
    }

    async function initialize() {
        mangaId = getMangaId();
        
        if (!mangaId) {
            seriesInfoDiv.innerHTML = '❌ Keine Manga-Seite erkannt';
            analyzeButton.disabled = true;
            return;
        }

        // Versuche Titel aus der Seite zu extrahieren
        const titleElement = document.querySelector('.text-xl.font-bold') || 
                            document.querySelector('h1');
        if (titleElement) {
            seriesTitle = titleElement.textContent.trim();
        }

        seriesInfoDiv.innerHTML = `
            <strong>Manga erkannt</strong><br>
            <small>ID: ${mangaId.substring(0, 8)}...</small>
        `;

        log('MangaDex Cover Downloader bereit');
        log(`Manga-ID: ${mangaId}`);
    }

    // Event Listeners
    analyzeButton.addEventListener('click', analyzeCovers);
    startButton.addEventListener('click', downloadToFolder);

    toggleLogButton.addEventListener('click', () => {
        logDiv.classList.toggle('show-log');
        toggleLogButton.textContent = logDiv.classList.contains('show-log') ? 
            '🔍 Details ausblenden' : '🔍 Details anzeigen';
    });

    // Initialisierung - mehrere Methoden für maximale Kompatibilität
    function startInitialization() {
        log('Starte Initialisierung...');
        initialize();
    }

    // Methode 1: Sofort starten wenn DOM bereit ist
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startInitialization);
    } else {
        startInitialization();
    }

    // Methode 2: Zusätzlicher Fallback nach kurzer Verzögerung
    setTimeout(startInitialization, 500);

    // Methode 3: Window load event als weitere Absicherung
    window.addEventListener('load', () => {
        if (!mangaId) {
            log('Window loaded - versuche erneut zu initialisieren');
            startInitialization();
        }
    });

    // Beobachte URL-Änderungen für Single-Page-Application
    let lastUrl = location.href;
    new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            log('URL geändert, re-initialisiere...');
            
            // Reset UI
            allCovers = [];
            selectedCovers = [];
            seriesTitle = '';
            mangaId = '';
            
            versionSelector.classList.remove('show-version-selector');
            rangeSelector.classList.remove('show-range-selector');
            startButton.style.display = 'none';
            startButton.disabled = true;
            analyzeButton.style.display = 'block';
            analyzeButton.disabled = false;
            analyzeButton.textContent = '🔍 Cover analysieren';
            logDiv.innerHTML = '';
            hideProgress();
            
            // Re-initialisiere
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initialize);
            } else {
                setTimeout(initialize, 300);
            }
        }
    }).observe(document, { subtree: true, childList: true });

    log('MangaDex Cover Downloader geladen - beobachtet URL-Änderungen');
})();
