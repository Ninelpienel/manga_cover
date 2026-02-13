// ==UserScript==
// @name         Manga Passion Cover Downloader
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Download high-resolution covers from Manga-Passion.de
// @author       You
// @match        https://www.manga-passion.de/editions/*
// @grant        none
// @downloadURL  https://github.com/Ninelpienel/manga_cover/raw/master/manga_passion_cover_downloader.user.js
// ==/UserScript==

(function() {
    'use strict';

    // CSS für das UI
    const style = document.createElement('style');
    style.textContent = `
        #mp-downloader {
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

        #mp-downloader h3 {
            margin: 0 0 15px 0;
            color: #e94560;
            font-size: 18px;
            font-weight: 600;
            text-shadow: 0 2px 4px rgba(233, 69, 96, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        #mp-downloader button {
            background: linear-gradient(135deg, #e94560 0%, #d63447 100%);
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
            box-shadow: 0 4px 12px rgba(233, 69, 96, 0.3);
        }

        #mp-downloader button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(233, 69, 96, 0.4);
            background: linear-gradient(135deg, #ff4d6d 0%, #e94560 100%);
        }

        #mp-downloader button:active {
            transform: translateY(0);
        }

        #mp-downloader button:disabled {
            background: linear-gradient(135deg, #2d2d44 0%, #1f1f2e 100%);
            cursor: not-allowed;
            box-shadow: none;
            opacity: 0.6;
        }

        #mp-downloader .analyze-button {
            background: linear-gradient(135deg, #00b4d8 0%, #0096c7 100%);
            box-shadow: 0 4px 12px rgba(0, 180, 216, 0.3);
        }

        #mp-downloader .analyze-button:hover {
            background: linear-gradient(135deg, #48cae4 0%, #00b4d8 100%);
            box-shadow: 0 6px 16px rgba(0, 180, 216, 0.4);
        }

        #mp-downloader button[id="search-mangadex"] {
            background: linear-gradient(135deg, #ff6740 0%, #ff8360 100%);
            box-shadow: 0 4px 12px rgba(255, 103, 64, 0.3);
        }

        #mp-downloader button[id="search-mangadex"]:hover {
            background: linear-gradient(135deg, #ff8360 0%, #ff9980 100%);
            box-shadow: 0 6px 16px rgba(255, 103, 64, 0.4);
            transform: translateY(-2px);
        }

        #mp-downloader button[id="search-mangaupdates"] {
            background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%);
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
        }

        #mp-downloader button[id="search-mangaupdates"]:hover {
            background: linear-gradient(135deg, #9333ea 0%, #a855f7 100%);
            box-shadow: 0 6px 16px rgba(124, 58, 237, 0.4);
            transform: translateY(-2px);
        }

        #mp-progress {
            margin-top: 12px;
            font-size: 13px;
            color: #e0e0e0;
            background: rgba(15, 52, 96, 0.4);
            padding: 10px 12px;
            border-radius: 8px;
            display: none;
            border-left: 3px solid #00b4d8;
        }

        #mp-log {
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

        #mp-log::-webkit-scrollbar {
            width: 8px;
        }

        #mp-log::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
        }

        #mp-log::-webkit-scrollbar-thumb {
            background: #0f3460;
            border-radius: 4px;
        }

        #mp-log::-webkit-scrollbar-thumb:hover {
            background: #1a4d7a;
        }

        .mp-series-info {
            background: rgba(15, 52, 96, 0.3);
            padding: 12px;
            border-radius: 8px;
            margin: 12px 0;
            font-size: 13px;
            color: #e0e0e0;
            border-left: 3px solid #e94560;
        }

        .mp-series-info strong {
            color: #48cae4;
        }

        .show-log {
            display: block !important;
        }

        .show-progress {
            display: block !important;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        #mp-downloader {
            animation: fadeIn 0.4s ease-out;
        }
    `;
    document.head.appendChild(style);

    // UI erstellen
    const ui = document.createElement('div');
    ui.id = 'mp-downloader';
    ui.innerHTML = `
        <h3>📚 Manga-Passion Cover Downloader</h3>
        <div class="mp-series-info" id="series-info">Bereit zum Analysieren...</div>
        <button id="copy-all-info" class="analyze-button">📋 Alle Infos kopieren</button>
        <button id="copy-tags" class="analyze-button">🏷️ Tags kopieren</button>
        <button id="search-mangadex" style="background: linear-gradient(135deg, #ff6740 0%, #ff8360 100%); box-shadow: 0 4px 12px rgba(255, 103, 64, 0.3);">🔍 MangaDex suchen</button>
        <button id="search-mangaupdates" style="background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%); box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">📖 MangaUpdates suchen</button>
        <button id="analyze-covers" class="analyze-button">🔍 Cover analysieren</button>
        <button id="start-download" disabled style="display: none;">📁 Ordner wählen & herunterladen</button>
        <button id="toggle-log" style="display: none;">🔍 Details anzeigen</button>
        <div id="mp-progress"></div>
        <div id="mp-log"></div>
    `;
    document.body.appendChild(ui);

    const analyzeButton = document.getElementById('analyze-covers');
    const copyAllInfoButton = document.getElementById('copy-all-info');
    const copyTagsButton = document.getElementById('copy-tags');
    const searchMangaDexButton = document.getElementById('search-mangadex');
    const searchMangaUpdatesButton = document.getElementById('search-mangaupdates');
    const startButton = document.getElementById('start-download');
    const toggleLogButton = document.getElementById('toggle-log');
    const progressDiv = document.getElementById('mp-progress');
    const logDiv = document.getElementById('mp-log');
    const seriesInfoDiv = document.getElementById('series-info');

    let isAnalyzing = false;
    let isDownloading = false;
    let allCovers = [];
    let seriesTitle = '';
    let editionId = '';

    function log(message) {
        console.log('[Manga-Passion Cover Downloader]', message);
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

    // Extrahiere Edition-ID aus URL
    function getEditionId() {
        const match = window.location.pathname.match(/\/editions\/(\d+)/);
        return match ? match[1] : null;
    }

    // Extrahiere Serien-Titel aus der Seite
    function extractSeriesTitle() {
        // Versuche verschiedene Selektoren
        const selectors = [
            'h1.edition-title',
            'h1',
            '.product-title',
            '.title'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                return element.textContent.trim();
            }
        }

        return 'Unknown Series';
    }

    // Extrahiere originale Bild-URL aus Next.js Image URL
    function extractOriginalImageUrl(nextImageUrl) {
        try {
            const url = new URL(nextImageUrl);
            const originalUrl = url.searchParams.get('url');
            if (originalUrl) {
                return decodeURIComponent(originalUrl);
            }
        } catch (e) {
            // Wenn es keine Next.js URL ist, gib die Original-URL zurück
        }
        return nextImageUrl;
    }

    // Finde alle Cover-Bilder auf der Seite
    function findCoverImages() {
        const covers = [];
        const seenUrls = new Set(); // Verhindere Duplikate
        const seenVolumes = new Set(); // Verhindere doppelte Band-Nummern
        
        // Suche spezifisch nach Links zu Volume-Seiten
        const volumeLinks = document.querySelectorAll('a[href*="/volumes/"]');
        
        log(`Gefunden: ${volumeLinks.length} Volume-Links`);

        volumeLinks.forEach((link, index) => {
            const img = link.querySelector('img');
            if (!img) return;

            const src = img.src || img.dataset.src || img.dataset.original;
            if (!src) return;

            // Extrahiere die originale Bild-URL aus Next.js optimierten URLs
            let originalSrc = extractOriginalImageUrl(src);
            
            // Überspringe wenn diese URL schon verarbeitet wurde
            if (seenUrls.has(originalSrc)) {
                log(`Überspringe Duplikat-URL: ${originalSrc.substring(0, 60)}...`);
                return;
            }
            
            // Finde Band-Nummer aus verschiedenen Quellen
            let volumeNumber = null;
            
            // 1. Priorisiere sichtbaren Text im Link oder Parent (z.B. "Band 1")
            const textContent = link.textContent || '';
            volumeNumber = extractVolumeNumber(textContent);
            
            // 2. Versuche aus img alt
            if (!volumeNumber) {
                volumeNumber = extractVolumeNumber(img.alt || '');
            }
            
            if (!volumeNumber) {
                log(`Keine Band-Nummer gefunden für: ${textContent.trim().substring(0, 50)}`);
                return; // Überspringe wenn keine Band-Nummer gefunden
            }
            
            // Überspringe wenn diese Band-Nummer schon existiert
            if (seenVolumes.has(volumeNumber)) {
                log(`Überspringe Duplikat Band ${volumeNumber}`);
                return;
            }
            
            log(`✓ Band ${volumeNumber}: ${textContent.trim().substring(0, 40)}`);
            
            seenUrls.add(originalSrc);
            seenVolumes.add(volumeNumber);

            covers.push({
                src: originalSrc,
                alt: img.alt || `Band ${volumeNumber}`,
                volumeNumber: volumeNumber,
                element: img
            });
        });

        // Fallback: Wenn keine Volumes gefunden wurden
        if (covers.length === 0) {
            log('Keine Volume-Links gefunden, verwende Fallback-Suche');
            
            const images = document.querySelectorAll('img');
            images.forEach((img, index) => {
                const src = img.src || img.dataset.src || img.dataset.original;
                
                if (src && (
                    src.includes('media.manga-passion.de') ||
                    src.includes('cover') ||
                    src.includes('volume')
                )) {
                    let originalSrc = extractOriginalImageUrl(src);
                    
                    if (seenUrls.has(originalSrc)) return;
                    seenUrls.add(originalSrc);
                    
                    const volumeNumber = extractVolumeNumber(img.alt || '') || (index + 1);
                    
                    covers.push({
                        src: originalSrc,
                        alt: img.alt || `Cover ${volumeNumber}`,
                        volumeNumber: volumeNumber,
                        element: img
                    });
                }
            });
        }

        // Sortiere nach Band-Nummer
        covers.sort((a, b) => a.volumeNumber - b.volumeNumber);

        log(`Finale Liste: ${covers.length} einzigartige Cover`);

        return covers;
    }

    // Extrahiere Band-Nummer aus Text
    function extractVolumeNumber(text) {
        if (!text) return null;
        
        const patterns = [
            /band\s*(\d+)/i,
            /volume\s*(\d+)/i,
            /vol\.\s*(\d+)/i,
            /bd\.\s*(\d+)/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const num = parseInt(match[1]);
                // Nur realistische Band-Nummern (1-999)
                if (num > 0 && num < 1000) {
                    return num;
                }
            }
        }

        return null;
    }

    // Suche auf MangaDex mit Original-Titel
    function searchOnMangaDex() {
        // Suche nach dem subHeading Element
        const subHeadingElement = document.querySelector('[class*="subHeading"]');
        
        if (!subHeadingElement) {
            log('Kein SubHeading-Element gefunden');
            updateProgress('❌ Kein Titel gefunden');
            alert('Kein Originaltitel gefunden. Bitte stelle sicher, dass die Seite vollständig geladen ist.');
            return;
        }

        const fullTitle = subHeadingElement.textContent.trim();
        log(`Gefundener Titel: ${fullTitle}`);

        // Teile am | Symbol und nimm den Teil nach dem |
        const parts = fullTitle.split('|');
        if (parts.length < 2) {
            log('Kein | im Titel gefunden');
            updateProgress('❌ Kein | im Titel gefunden');
            return;
        }

        const originalTitle = parts[parts.length - 1].trim();
        log(`Extrahierter Originaltitel: ${originalTitle}`);

        if (!originalTitle) {
            log('Originaltitel-Teil ist leer');
            updateProgress('❌ Originaltitel-Teil ist leer');
            return;
        }

        // Erstelle MangaDex Such-URL
        const encodedTitle = encodeURIComponent(originalTitle);
        const mangaDexUrl = `https://mangadex.org/search?q=${encodedTitle}`;

        log(`Öffne MangaDex: ${mangaDexUrl}`);
        updateProgress(`🔍 Suche auf MangaDex: ${originalTitle}`);

        // Öffne in neuem Tab
        window.open(mangaDexUrl, '_blank');

        setTimeout(() => {
            hideProgress();
        }, 2000);
    }

    // Suche auf MangaUpdates mit Original-Titel
    function searchOnMangaUpdates() {
        // Suche nach dem subHeading Element
        const subHeadingElement = document.querySelector('[class*="subHeading"]');
        
        if (!subHeadingElement) {
            log('Kein SubHeading-Element gefunden');
            updateProgress('❌ Kein Titel gefunden');
            alert('Kein Originaltitel gefunden. Bitte stelle sicher, dass die Seite vollständig geladen ist.');
            return;
        }

        const fullTitle = subHeadingElement.textContent.trim();
        log(`Gefundener Titel: ${fullTitle}`);

        // Teile am | Symbol und nimm den Teil nach dem |
        const parts = fullTitle.split('|');
        if (parts.length < 2) {
            log('Kein | im Titel gefunden');
            updateProgress('❌ Kein | im Titel gefunden');
            return;
        }

        const originalTitle = parts[parts.length - 1].trim();
        log(`Extrahierter Originaltitel: ${originalTitle}`);

        if (!originalTitle) {
            log('Originaltitel-Teil ist leer');
            updateProgress('❌ Originaltitel-Teil ist leer');
            return;
        }

        // Erstelle MangaUpdates Such-URL
        const encodedTitle = encodeURIComponent(originalTitle);
        const mangaUpdatesUrl = `https://www.mangaupdates.com/site/search/result?search=${encodedTitle}`;

        log(`Öffne MangaUpdates: ${mangaUpdatesUrl}`);
        updateProgress(`📖 Suche auf MangaUpdates: ${originalTitle}`);

        // Öffne in neuem Tab
        window.open(mangaUpdatesUrl, '_blank');

        setTimeout(() => {
            hideProgress();
        }, 2000);
    }

    // Extrahiere und kopiere alle Infos im Format: typ|herkunft|status|start|romaji|kanji|verlage|magazine|tags
    function copyAllInfo() {
        const info = [];
        const bodyLines = document.body.innerText.split('\n');
        
        // Hilfsfunktion: Finde die nächste nicht-leere Zeile nach einem Label
        function getNextLine(labelText, maxDistance = 5) {
            for (let i = 0; i < bodyLines.length; i++) {
                if (bodyLines[i].includes(labelText)) {
                    // Nimm die nächste nicht-leere Zeile
                    for (let j = i + 1; j < bodyLines.length && j < i + maxDistance; j++) {
                        const nextLine = bodyLines[j].trim();
                        if (nextLine && nextLine.length > 0) {
                            return nextLine;
                        }
                    }
                }
            }
            return '';
        }
        
        // 1. TYP
        let typ = getNextLine('Typ');
        // Bereinige falls "TypManga" zusammen steht
        if (typ.startsWith('Typ')) {
            typ = typ.replace('Typ', '').trim();
        }
        info.push(typ);
        log(`Typ: ${typ || '(leer)'}`);
        
        // 2. HERKUNFT
        let herkunft = getNextLine('Herkunft');
        // Bereinige falls "HerkunftJapan" zusammen steht
        if (herkunft.startsWith('Herkunft')) {
            herkunft = herkunft.replace('Herkunft', '').replace('-', '').trim();
        }
        info.push(herkunft);
        log(`Herkunft: ${herkunft || '(leer)'}`);
        
        // 3. STATUS (unter Erstveröffentlichung)
        let status = '';
        let foundErstveroeffentlichung = false;
        for (let i = 0; i < bodyLines.length; i++) {
            if (bodyLines[i].includes('Erstveröffentlichung')) {
                foundErstveroeffentlichung = true;
            }
            if (foundErstveroeffentlichung && bodyLines[i].includes('Status')) {
                // Nimm die nächste nicht-leere Zeile nach "Status"
                for (let j = i + 1; j < bodyLines.length && j < i + 5; j++) {
                    const nextLine = bodyLines[j].trim();
                    if (nextLine && nextLine.length > 0 && !nextLine.includes('Herkunft')) {
                        status = nextLine;
                        // Bereinige falls "StatusLaufend" zusammen steht
                        if (status.startsWith('Status')) {
                            status = status.replace('Status', '').trim();
                        }
                        break;
                    }
                }
                break;
            }
        }
        info.push(status);
        log(`Status: ${status || '(leer)'}`);
        
        // 4. STARTJAHR
        let startDate = '';
        for (let i = 0; i < bodyLines.length; i++) {
            if (bodyLines[i].includes('Startjahr')) {
                // Nimm die nächste nicht-leere Zeile
                for (let j = i + 1; j < bodyLines.length && j < i + 3; j++) {
                    const nextLine = bodyLines[j].trim();
                    if (/^\d{4}$/.test(nextLine)) {
                        startDate = nextLine;
                        break;
                    }
                }
                // Fallback: extrahiere aus derselben Zeile
                if (!startDate) {
                    const match = bodyLines[i].match(/(\d{4})/);
                    if (match) {
                        startDate = match[1];
                    }
                }
                break;
            }
        }
        info.push(startDate);
        log(`Startjahr: ${startDate || '(leer)'}`);
        
        // 5. ROMANISIERTER TITEL + 6. ORIGINALTITEL
        let romaji = '';
        let kanji = '';
        
        // Suche nach dem subHeading Element
        const subHeadingElement = document.querySelector('[class*="subHeading"]');
        if (subHeadingElement) {
            const fullText = subHeadingElement.textContent.trim();
            log(`SubHeading gefunden: ${fullText}`);
            
            if (fullText.includes('|')) {
                const parts = fullText.split('|');
                romaji = parts[0].trim();
                kanji = parts.length > 1 ? parts[1].trim() : '';
            } else {
                // Kein | vorhanden - verwende den gleichen Titel für beide
                romaji = fullText;
                kanji = fullText;
            }
        }
        
        info.push(romaji);
        info.push(kanji);
        log(`Romaji: ${romaji || '(leer)'}`);
        log(`Original: ${kanji || '(leer)'}`);
        
        // 7. JP VERLAGE
        const verlage = [];
        const verlagLinks = document.querySelectorAll('a[href*="originalPublisher"]');
        verlagLinks.forEach(link => {
            const verlagName = link.textContent.trim();
            if (verlagName && !verlage.includes(verlagName)) {
                verlage.push(verlagName);
            }
        });
        info.push(verlage.join(','));
        log(`Verlage: ${verlage.join(',') || '(leer)'}`);
        
        // 8. JP MAGAZINE
        const magazine = [];
        const magazinLinks = document.querySelectorAll('a[href*="magazine"]');
        magazinLinks.forEach(link => {
            const magazinName = link.textContent.trim();
            if (magazinName && !magazine.includes(magazinName)) {
                magazine.push(magazinName);
            }
        });
        info.push(magazine.join(','));
        log(`Magazine: ${magazine.join(',') || '(leer)'}`);
        
        // 9. TAGS (Demografie + Genres)
        const tags = [];
        const allLinks = document.querySelectorAll('a[href*="/editions/search?tag="]');
        
        allLinks.forEach(link => {
            const text = link.textContent.trim();
            if (text.length > 30) return;
            if (!tags.includes(text)) {
                tags.push(text);
            }
        });
        
        info.push(tags.join(','));
        log(`Tags: ${tags.join(',') || '(leer)'}`);
        
        // Erstelle finale Pipe-separated Zeile
        const result = info.join('|');
        log(`\nFinales Ergebnis:\n${result}`);
        
        // Kopiere in Zwischenablage
        navigator.clipboard.writeText(result).then(() => {
            updateProgress(`✅ Alle Infos kopiert!`);
            
            const originalText = copyAllInfoButton.textContent;
            copyAllInfoButton.textContent = '✅ Kopiert!';
            setTimeout(() => {
                copyAllInfoButton.textContent = originalText;
                hideProgress();
            }, 2000);
        }).catch(err => {
            log(`Fehler beim Kopieren: ${err}`);
            updateProgress(`❌ Kopieren fehlgeschlagen`);
            alert(`Infos:\n${result}`);
        });
    }

    // Extrahiere und kopiere Demografie + Genres
    function copyTags() {
        const tags = [];
        
        // Suche nach Demografie
        const demografieLinks = document.querySelectorAll('a[href*="/editions/search?tag="]');
        const demografieKeywords = ['shounen', 'shoujo', 'seinen', 'josei', 'kodomo'];
        
        demografieLinks.forEach(link => {
            const href = link.href.toLowerCase();
            const text = link.textContent.trim();
            
            // Prüfe ob es eine Demografie ist
            if (demografieKeywords.some(keyword => href.includes(keyword) || text.toLowerCase().includes(keyword))) {
                if (!tags.includes(text)) {
                    tags.push(text);
                }
            }
        });
        
        // Suche nach Genres (unter "Genres" Überschrift)
        const allLinks = document.querySelectorAll('a[href*="/editions/search?tag="]');
        let foundGenresSection = false;
        
        // Finde den Bereich mit Genres
        allLinks.forEach(link => {
            const text = link.textContent.trim();
            
            // Überspringe Demografie-Tags
            if (demografieKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
                return;
            }
            
            // Überspringe wenn Text zu lang ist (wahrscheinlich kein Genre-Tag)
            if (text.length > 30) {
                return;
            }
            
            // Füge Genre hinzu wenn noch nicht vorhanden
            if (!tags.includes(text) && link.href.includes('/editions/search?tag=')) {
                tags.push(text);
            }
        });
        
        if (tags.length === 0) {
            log('Keine Tags gefunden');
            updateProgress('❌ Keine Tags gefunden');
            return;
        }
        
        const tagsString = tags.join(',');
        
        // Kopiere in Zwischenablage
        navigator.clipboard.writeText(tagsString).then(() => {
            log(`Tags kopiert: ${tagsString}`);
            updateProgress(`✅ Tags kopiert: ${tagsString}`);
            
            const originalText = copyTagsButton.textContent;
            copyTagsButton.textContent = '✅ Kopiert!';
            setTimeout(() => {
                copyTagsButton.textContent = originalText;
                hideProgress();
            }, 2000);
        }).catch(err => {
            log(`Fehler beim Kopieren: ${err}`);
            updateProgress(`❌ Kopieren fehlgeschlagen`);
            alert(`Tags: ${tagsString}`);
        });
    }

    async function analyzeCovers() {
        if (isAnalyzing) return;

        isAnalyzing = true;
        allCovers = [];

        // UI anpassen
        analyzeButton.disabled = true;
        analyzeButton.textContent = '🔍 Analysiere...';
        toggleLogButton.style.display = 'block';
        logDiv.innerHTML = '';

        updateProgress('🔍 Suche nach Cover-Bildern...');

        // Finde alle Cover
        allCovers = findCoverImages();
        
        if (allCovers.length === 0) {
            updateProgress('❌ Keine Cover gefunden');
            log('Keine Cover-Bilder auf der Seite gefunden');
            analyzeButton.disabled = false;
            analyzeButton.textContent = '🔍 Cover analysieren';
            isAnalyzing = false;
            return;
        }

        log(`${allCovers.length} Cover-Bild(er) gefunden`);

        // Logge Details zu jedem Cover
        allCovers.forEach((cover, index) => {
            log(`Cover ${index + 1}: Band ${cover.volumeNumber} - ${cover.src.substring(0, 80)}...`);
        });

        updateProgress(`✅ ${allCovers.length} Cover bereit zum Download`);
        
        seriesInfoDiv.innerHTML = `
            <strong>Serie:</strong> ${seriesTitle}<br>
            <strong>Cover:</strong> ${allCovers.length} gefunden
        `;

        startButton.style.display = 'block';
        startButton.disabled = false;
        startButton.textContent = `📁 ${allCovers.length} Cover herunterladen`;

        analyzeButton.textContent = '🔄 Neu analysieren';
        analyzeButton.disabled = false;
        isAnalyzing = false;
    }

    function sanitizeFilename(filename) {
        return filename.replace(/[<>:"/\\|?*]/g, '_');
    }

    // Download einzelnes Bild
    async function downloadImage(imageUrl) {
        try {
            log(`Versuche Download: ${imageUrl}`);
            
            const response = await fetch(imageUrl, {
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Accept': 'image/*',
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            
            const blob = await response.blob();
            log(`✓ Erfolgreich geladen: ${blob.size} Bytes, Type: ${blob.type}`);
            
            return blob;
        } catch (error) {
            log(`✗ Fehler beim Download: ${error.message}`);
            throw error;
        }
    }

    async function downloadToFolder() {
        if (isDownloading || allCovers.length === 0) return;

        // Überprüfe ob File System Access API verfügbar ist
        if (!window.showDirectoryPicker) {
            alert('Ihr Browser unterstützt keine direkten Ordner-Downloads. Bitte verwenden Sie Chrome oder Edge.');
            return;
        }

        isDownloading = true;
        const originalText = startButton.textContent;
        startButton.disabled = true;
        startButton.textContent = '📁 Ordner wählen...';

        try {
            // Lasse Nutzer Ordner auswählen
            const directoryHandle = await window.showDirectoryPicker();

            // Erstelle Serienordner
            const sanitizedSeriesName = sanitizeFilename(seriesTitle);
            const seriesFolderHandle = await directoryHandle.getDirectoryHandle(sanitizedSeriesName, { create: true });

            log(`Lade ${allCovers.length} Cover in Ordner: ${sanitizedSeriesName}`);

            let successCount = 0;

            // Lade alle Bilder herunter
            for (let i = 0; i < allCovers.length; i++) {
                const cover = allCovers[i];

                try {
                    updateProgress(`📁 Lade ${i + 1}/${allCovers.length}: ${cover.alt}`);
                    startButton.textContent = `📁 Lade ${i + 1}/${allCovers.length}...`;

                    const imageBlob = await downloadImage(cover.src);

                    // Bestimme Dateiendung
                    let extension = 'jpg';
                    const urlExtMatch = cover.src.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i);
                    if (urlExtMatch) {
                        extension = urlExtMatch[1].toLowerCase();
                    } else if (imageBlob.type) {
                        const typeMatch = imageBlob.type.match(/image\/(jpg|jpeg|png|webp|gif)/i);
                        if (typeMatch) {
                            extension = typeMatch[1].toLowerCase();
                        }
                    }

                    // Erstelle einfachen nummerierten Dateinamen
                    const fileName = `${cover.volumeNumber}.${extension}`;

                    // Schreibe Datei in Serienordner
                    const fileHandle = await seriesFolderHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(imageBlob);
                    await writable.close();

                    successCount++;
                    log(`✓ Gespeichert: ${fileName}`);

                } catch (error) {
                    log(`✗ Fehler bei ${cover.alt}: ${error.message}`);
                }

                // Kurze Pause zwischen Downloads
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            updateProgress(`✅ Download abgeschlossen! ${successCount}/${allCovers.length} Cover gespeichert in "${sanitizedSeriesName}"`);
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
        editionId = getEditionId();
        
        if (!editionId) {
            seriesInfoDiv.innerHTML = '❌ Keine Edition-Seite erkannt';
            analyzeButton.disabled = true;
            return;
        }

        // Extrahiere Titel
        seriesTitle = extractSeriesTitle();

        seriesInfoDiv.innerHTML = `
            <strong>Edition erkannt</strong><br>
            <strong>Titel:</strong> ${seriesTitle}<br>
            <small>ID: ${editionId}</small>
        `;

        log('Manga-Passion Cover Downloader bereit');
        log(`Edition-ID: ${editionId}`);
        log(`Titel: ${seriesTitle}`);
    }

    // Event Listeners
    copyAllInfoButton.addEventListener('click', copyAllInfo);
    copyTagsButton.addEventListener('click', copyTags);
    searchMangaDexButton.addEventListener('click', searchOnMangaDex);
    searchMangaUpdatesButton.addEventListener('click', searchOnMangaUpdates);
    analyzeButton.addEventListener('click', analyzeCovers);
    startButton.addEventListener('click', downloadToFolder);

    toggleLogButton.addEventListener('click', () => {
        logDiv.classList.toggle('show-log');
        toggleLogButton.textContent = logDiv.classList.contains('show-log') ? 
            '🔍 Details ausblenden' : '🔍 Details anzeigen';
    });

    // Initialisierung
    setTimeout(initialize, 1000);

    // Beobachte URL-Änderungen für Single-Page-Application
    let lastUrl = location.href;
    new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            log('URL geändert, re-initialisiere...');
            
            // Reset UI
            allCovers = [];
            seriesTitle = '';
            editionId = '';
            
            startButton.style.display = 'none';
            startButton.disabled = true;
            analyzeButton.disabled = false;
            analyzeButton.textContent = '🔍 Cover analysieren';
            logDiv.innerHTML = '';
            hideProgress();
            
            // Re-initialisiere
            setTimeout(initialize, 500);
        }
    }).observe(document, { subtree: true, childList: true });

    log('Manga-Passion Cover Downloader geladen - beobachtet URL-Änderungen');
})();
