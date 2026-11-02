// ==UserScript==
// @name         MangaDex Cover Downloader
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Download high-resolution covers from MangaDex with automatic version detection
// @author       You
// @match        https://mangadex.org/*
// @match        https://www.mangadex.org/*
// @connect      api.mangadex.org
// @connect      uploads.mangadex.org
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    /* ------------------------------------------------------------------
     * 0. CSP-sichere Helfer
     * ------------------------------------------------------------------ */

    // Trusted Types: falls die Seite `require-trusted-types-for 'script'`
    // setzt, wirft ein direktes `el.innerHTML = str` eine TypeError und
    // reisst das ganze Skript mit. Policy + DOMParser-Fallback verhindern das.
    let ttPolicy = null;

    function toHTML(str) {
        if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
            if (!ttPolicy) {
                try {
                    ttPolicy = trustedTypes.createPolicy('mdcd-ui', { createHTML: s => s });
                } catch (e) {
                    ttPolicy = null;
                }
            }
            if (ttPolicy) return ttPolicy.createHTML(str);
        }
        return str;
    }

    function setHTML(el, str) {
        try {
            el.innerHTML = toHTML(str);
        } catch (e) {
            // DOMParser ist kein Trusted-Types-Sink und funktioniert immer
            const doc = new DOMParser().parseFromString(`<body>${str}</body>`, 'text/html');
            const nodes = Array.from(doc.body.childNodes).map(n => document.importNode(n, true));
            el.replaceChildren(...nodes);
        }
    }

    // Requests über Tampermonkey: kein CORS, Browser-Cookies (z. B. bestandene
    // Bot-Challenge auf api.mangadex.org) werden mitgeschickt. Ein normales
    // fetch() von mangadex.org aus schickt diese Cookies nicht mit.
    function gmRequest(url, responseType = 'text') {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType,
                anonymous: false,
                timeout: 30000,
                onload: r => resolve(r),
                onerror: () => reject(new Error('Netzwerkfehler')),
                ontimeout: () => reject(new Error('Timeout'))
            });
        });
    }

    async function apiGet(url) {
        const r = await gmRequest(url);
        if (r.status === 429) return { status: 429, data: null };
        const text = r.responseText || '';
        try {
            return { status: r.status, data: JSON.parse(text) };
        } catch (e) {
            if (/bot challenge/i.test(text)) {
                throw new Error('Bot-Challenge – öffne https://api.mangadex.org/ping einmal im Tab, dann neu analysieren');
            }
            throw new Error(`Keine JSON-Antwort (HTTP ${r.status}): ${text.slice(0, 60)}`);
        }
    }

    /* ------------------------------------------------------------------
     * 1. CSS
     * ------------------------------------------------------------------ */

    const CSS = `
        #mangadex-downloader {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 2147483000;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 1px solid #0f3460;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            min-width: 320px;
            max-width: 420px;
            backdrop-filter: blur(10px);
            animation: mdcdFadeIn 0.4s ease-out;
        }

        #mangadex-downloader.mdcd-collapsed > *:not(h3) { display: none !important; }
        #mangadex-downloader.mdcd-collapsed { min-width: 0; padding: 12px 16px; }

        #mangadex-downloader h3 {
            margin: 0 0 15px 0;
            color: #ff6740;
            font-size: 18px;
            font-weight: 600;
            text-shadow: 0 2px 4px rgba(255, 103, 64, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            user-select: none;
        }

        #mangadex-downloader.mdcd-collapsed h3 { margin: 0; }

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

        #mangadex-downloader button:active { transform: translateY(0); }

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
            white-space: pre-wrap;
            word-break: break-word;
        }

        #mangadex-log::-webkit-scrollbar { width: 8px; }
        #mangadex-log::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
        #mangadex-log::-webkit-scrollbar-thumb { background: #0f3460; border-radius: 4px; }
        #mangadex-log::-webkit-scrollbar-thumb:hover { background: #1a4d7a; }

        .mangadex-series-info {
            background: rgba(15, 52, 96, 0.3);
            padding: 12px;
            border-radius: 8px;
            margin: 12px 0;
            font-size: 13px;
            color: #e0e0e0;
            border-left: 3px solid #ff6740;
        }

        .mangadex-series-info strong { color: #48cae4; }

        .version-selector, .range-selector {
            background: rgba(15, 52, 96, 0.3);
            padding: 12px;
            border-radius: 8px;
            margin: 10px 0;
            display: none;
            border-left: 3px solid #00b4d8;
        }

        .version-selector h4, .range-selector h4 {
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

        .range-inputs label { font-size: 12px; color: #e0e0e0; }
        .range-selector small { color: #b8b8d1; }

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

        .version-option input { margin-right: 8px; }

        .version-option label {
            cursor: pointer;
            flex: 1;
            color: #e0e0e0;
            font-size: 13px;
            font-weight: 500;
        }

        .show-log { display: block !important; }
        .show-progress { display: block !important; }
        .show-version-selector { display: block !important; }
        .show-range-selector { display: block !important; }

        @keyframes mdcdFadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
        }
    `;

    let styleEl = null;

    function injectStyle() {
        if (styleEl && styleEl.isConnected) return;
        if (typeof GM_addStyle === 'function') {
            // Sandbox-Injektion: umgeht die CSP der Seite
            styleEl = GM_addStyle(CSS) || null;
            if (styleEl) return;
        }
        styleEl = document.createElement('style');
        styleEl.textContent = CSS;
        (document.head || document.documentElement).appendChild(styleEl);
    }

    /* ------------------------------------------------------------------
     * 2. UI aufbauen
     * ------------------------------------------------------------------ */

    const ui = document.createElement('div');
    ui.id = 'mangadex-downloader';
    setHTML(ui, `
        <h3 title="Klicken zum Ein-/Ausklappen">📚 MangaDex Cover Downloader</h3>
        <div class="mangadex-series-info" id="series-info">Bereit zum Analysieren...</div>
        <button id="analyze-covers" class="analyze-button">🔍 Cover analysieren</button>
        <div class="version-selector" id="locale-selector">
            <h4>Sprache auswählen:</h4>
            <div id="locale-options"></div>
            <button id="confirm-locale">✓ Sprache auswählen</button>
        </div>
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
            <small>Bereich bezieht sich auf die Position in der Liste, nicht auf die Bandnummer.</small>
        </div>
        <button id="start-download" disabled style="display: none;">📁 Ordner wählen &amp; herunterladen</button>
        <button id="copy-links" disabled style="display: none;">📋 Links kopieren</button>
        <button id="toggle-log" style="display: none;">🔍 Details anzeigen</button>
        <div id="mangadex-progress"></div>
        <div id="mangadex-log"></div>
    `);

    // Referenzen aus dem (noch nicht eingehängten) UI-Baum holen.
    const $ = id => ui.querySelector('#' + id);

    const headerEl = ui.querySelector('h3');
    const analyzeButton = $('analyze-covers');
    const startButton = $('start-download');
    const copyLinksButton = $('copy-links');
    const toggleLogButton = $('toggle-log');
    const versionSelector = $('version-selector');
    const versionOptions = $('version-options');
    const confirmVersionButton = $('confirm-version');
    const localeSelector = $('locale-selector');
    const localeOptions = $('locale-options');
    const confirmLocaleButton = $('confirm-locale');
    const rangeSelector = $('range-selector');
    const rangeFromInput = $('range-from');
    const rangeToInput = $('range-to');
    const progressDiv = $('mangadex-progress');
    const logDiv = $('mangadex-log');
    const seriesInfoDiv = $('series-info');

    /* ------------------------------------------------------------------
     * 3. Selbstheilendes Mounten
     * ------------------------------------------------------------------ */

    function mount() {
        injectStyle();
        if (!ui.isConnected) {
            (document.body || document.documentElement).appendChild(ui);
            return true;
        }
        return false;
    }

    /* ------------------------------------------------------------------
     * 4. State
     * ------------------------------------------------------------------ */

    let isAnalyzing = false;
    let isDownloading = false;
    let allCovers = [];
    let selectedCovers = [];
    let seriesTitle = '';
    let mangaId = '';
    let selectedVersion = null;
    let selectedLocale = null;

    const LOCALE_NAMES = {
        'ja': '🇯🇵 Japanisch',
        'en': '🇬🇧 Englisch',
        'de': '🇩🇪 Deutsch',
        'fr': '🇫🇷 Französisch',
        'es': '🇪🇸 Spanisch',
        'es-la': '🇲🇽 Spanisch (LATAM)',
        'it': '🇮🇹 Italienisch',
        'pt-br': '🇧🇷 Portugiesisch (BR)',
        'zh': '🇨🇳 Chinesisch',
        'zh-hk': '🇭🇰 Chinesisch (HK)',
        'ko': '🇰🇷 Koreanisch',
        'ru': '🇷🇺 Russisch',
        'none': '🌐 Keine Angabe'
    };

    function localeLabel(code) {
        return LOCALE_NAMES[code] || `🌍 ${code}`;
    }

    /* ------------------------------------------------------------------
     * 5. Logging / Progress (ohne innerHTML)
     * ------------------------------------------------------------------ */

    function log(message) {
        console.log('[MangaDex Cover Downloader]', message);
        const line = document.createElement('div');
        line.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
        logDiv.appendChild(line);
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    function updateProgress(message) {
        progressDiv.textContent = message;
        progressDiv.classList.add('show-progress');
    }

    function hideProgress() {
        progressDiv.classList.remove('show-progress');
    }

    function setSeriesInfo(lines) {
        seriesInfoDiv.replaceChildren();
        lines.forEach((parts, i) => {
            if (i > 0) seriesInfoDiv.appendChild(document.createElement('br'));
            const strong = document.createElement('strong');
            strong.textContent = parts[0];
            seriesInfoDiv.appendChild(strong);
            seriesInfoDiv.appendChild(document.createTextNode(' ' + parts[1]));
        });
    }

    /* ------------------------------------------------------------------
     * 6. MangaDex API
     * ------------------------------------------------------------------ */

    function getMangaId() {
        const match = location.pathname.match(/\/title\/([0-9a-f]{8}-[0-9a-f-]+)/i);
        return match ? match[1] : null;
    }

    async function getMangaInfo() {
        try {
            const { data } = await apiGet(`https://api.mangadex.org/manga/${mangaId}`);
            if (data && data.result === 'ok') {
                const t = data.data.attributes.title;
                const title = t.en || t['ja-ro'] || Object.values(t)[0] || 'Unknown';
                return { title };
            }
        } catch (error) {
            log(`✗ Fehler beim Laden der Manga-Info: ${error.message}`);
        }
        return null;
    }

    async function getAllCovers() {
        const covers = [];
        try {
            let offset = 0;
            const limit = 100;

            while (true) {
                const res = await apiGet(
                    `https://api.mangadex.org/cover?manga[]=${mangaId}&limit=${limit}&offset=${offset}&order[volume]=asc`
                );

                if (res.status === 429) {
                    log('⏳ Rate-Limit erreicht, warte 5 Sekunden...');
                    await new Promise(r => setTimeout(r, 5000));
                    continue;
                }

                const data = res.data;
                if (!data || data.result !== 'ok') break;

                log(`API lieferte ${data.data.length} Cover (offset ${offset})`);

                const withVolume = data.data.filter(cover => {
                    const volume = cover.attributes.volume;
                    if (!volume || volume === 'null') return false;
                    return true;
                });

                log(`Davon ${withVolume.length} mit Bandnummer`);
                covers.push(...withVolume);

                if (data.data.length < limit) break;
                offset += limit;
                await new Promise(r => setTimeout(r, 250));
            }
        } catch (error) {
            log(`✗ Fehler beim Laden der Cover: ${error.message}`);
            return [];
        }

        // Duplikate pro Band+Sprache entfernen
        const map = new Map();
        covers.forEach(cover => {
            const key = `${cover.attributes.volume}_${cover.attributes.locale || 'none'}`;
            if (!map.has(key)) map.set(key, cover);
        });

        const unique = Array.from(map.values());
        log(`Nach Duplikat-Entfernung: ${unique.length} einzigartige Cover`);
        return unique;
    }

    /* ------------------------------------------------------------------
     * 7. Versions-/Sprachlogik
     * ------------------------------------------------------------------ */

    function parseVolume(volumeStr) {
        if (!volumeStr || volumeStr === 'null' || volumeStr === 'undefined') {
            return { main: 0, sub: 0 };
        }
        const volString = String(volumeStr).trim();
        if (!volString) return { main: 0, sub: 0 };

        const parts = volString.split('.');
        const main = parseInt(parts[0], 10) || 0;
        const sub = parts.length > 1 ? (parseInt(parts[1], 10) || 0) : 0;
        return { main, sub };
    }

    // Versionen werden pro Sprache ermittelt – sonst zeigt der Dialog
    // Versionen an, die es in der gewählten Sprache gar nicht gibt.
    function detectVersions(covers, locale) {
        const pool = locale
            ? covers.filter(c => (c.attributes.locale || 'none') === locale)
            : covers;

        const versions = new Set();
        const volumeMap = new Map();

        pool.forEach(cover => {
            const vol = parseVolume(cover.attributes.volume);
            if (!volumeMap.has(vol.main)) volumeMap.set(vol.main, new Set());
            volumeMap.get(vol.main).add(vol.sub);
            versions.add(vol.sub);
        });

        let hasMultipleVersions = false;
        volumeMap.forEach(subs => {
            if (subs.size > 1) hasMultipleVersions = true;
        });

        return {
            hasMultipleVersions,
            versions: Array.from(versions).sort((a, b) => a - b)
        };
    }

    function detectLocales(covers) {
        const locales = new Set();
        covers.forEach(c => locales.add(c.attributes.locale || 'none'));
        return Array.from(locales).sort();
    }

    function filterCovers(covers, version, locale) {
        return covers
            .filter(cover => {
                const vol = parseVolume(cover.attributes.volume);
                const coverLocale = cover.attributes.locale || 'none';
                return vol.sub === version && coverLocale === locale;
            })
            .sort((a, b) => parseVolume(a.attributes.volume).main - parseVolume(b.attributes.volume).main);
    }

    function buildOption(groupName, value, id, text) {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'version-option';

        const radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.name = groupName;
        radioInput.value = value;
        radioInput.id = id;

        const labelElement = document.createElement('label');
        labelElement.htmlFor = id;
        labelElement.textContent = text;

        optionDiv.appendChild(radioInput);
        optionDiv.appendChild(labelElement);
        optionDiv.addEventListener('click', () => { radioInput.checked = true; });

        return { optionDiv, radioInput };
    }

    function showLocaleSelector(locales) {
        localeOptions.replaceChildren();

        locales.forEach(locale => {
            const count = allCovers.filter(c => (c.attributes.locale || 'none') === locale).length;
            const { optionDiv } = buildOption(
                'locale', locale, `mdcd-locale-${locale}`,
                `${localeLabel(locale)} (${count} Cover)`
            );
            localeOptions.appendChild(optionDiv);
        });

        const defaultLocale = locales.includes('ja') ? 'ja' : locales[0];
        const defaultInput = localeOptions.querySelector(`#mdcd-locale-${CSS_escape(defaultLocale)}`);
        if (defaultInput) defaultInput.checked = true;

        localeSelector.classList.add('show-version-selector');
    }

    // CSS.escape ist nicht überall verfügbar bzw. im Sandbox-Scope verschattet
    function CSS_escape(str) {
        return String(str).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }

    function showVersionSelector(versionInfo) {
        versionOptions.replaceChildren();

        versionInfo.versions.forEach(version => {
            const count = allCovers.filter(c =>
                parseVolume(c.attributes.volume).sub === version &&
                (c.attributes.locale || 'none') === selectedLocale
            ).length;
            const label = version === 0 ? 'Standard (X)' : `Version X.${version}`;
            const { optionDiv } = buildOption(
                'version', version, `mdcd-version-${version}`,
                `${label} (${count} Cover)`
            );
            versionOptions.appendChild(optionDiv);
        });

        const first = versionOptions.querySelector('input[name="version"]');
        if (first) first.checked = true;

        versionSelector.classList.add('show-version-selector');
    }

    /* ------------------------------------------------------------------
     * 8. Ablauf
     * ------------------------------------------------------------------ */

    async function analyzeCovers() {
        if (isAnalyzing) return;

        isAnalyzing = true;
        allCovers = [];
        selectedCovers = [];

        analyzeButton.disabled = true;
        analyzeButton.textContent = '🔍 Analysiere...';
        toggleLogButton.style.display = 'block';
        logDiv.replaceChildren();

        try {
            updateProgress('📡 Lade Manga-Informationen...');
            const mangaInfo = await getMangaInfo();
            if (mangaInfo) {
                seriesTitle = mangaInfo.title;
                log(`Serie gefunden: ${seriesTitle}`);
            }

            updateProgress('🖼️ Lade Cover-Liste...');
            allCovers = await getAllCovers();

            if (allCovers.length === 0) {
                updateProgress('❌ Keine Cover gefunden');
                logDiv.classList.add('show-log');
                resetAnalyzeButton();
                return;
            }

            log(`${allCovers.length} Cover gesamt`);

            const locales = detectLocales(allCovers);
            log(`Sprachen erkannt: ${locales.join(', ')}`);

            if (locales.length > 1) {
                updateProgress('⚠️ Mehrere Sprachen gefunden – bitte auswählen');
                showLocaleSelector(locales);
                analyzeButton.style.display = 'none';
                return;
            }

            selectedLocale = locales[0];
            continueAfterLocale();
        } catch (error) {
            log(`✗ Unerwarteter Fehler: ${error.message}`);
            updateProgress('❌ Fehler bei der Analyse');
            resetAnalyzeButton();
        } finally {
            isAnalyzing = false;
        }
    }

    function resetAnalyzeButton() {
        analyzeButton.disabled = false;
        analyzeButton.style.display = 'block';
        analyzeButton.textContent = '🔍 Cover analysieren';
    }

    function continueAfterLocale() {
        const versionInfo = detectVersions(allCovers, selectedLocale);
        log(`Versionen in "${selectedLocale}": ${versionInfo.versions.join(', ')}`);

        localeSelector.classList.remove('show-version-selector');

        if (versionInfo.hasMultipleVersions) {
            updateProgress('⚠️ Mehrere Versionen gefunden – bitte auswählen');
            showVersionSelector(versionInfo);
            analyzeButton.style.display = 'none';
            return;
        }

        selectedVersion = versionInfo.versions[0] || 0;
        selectedCovers = filterCovers(allCovers, selectedVersion, selectedLocale);
        proceedToDownload();
    }

    function proceedToDownload() {
        versionSelector.classList.remove('show-version-selector');
        localeSelector.classList.remove('show-version-selector');
        analyzeButton.style.display = 'none';

        rangeSelector.classList.add('show-range-selector');
        rangeToInput.value = selectedCovers.length;
        rangeToInput.max = selectedCovers.length;
        rangeFromInput.max = selectedCovers.length;
        rangeFromInput.value = 1;

        updateProgress(`✅ ${selectedCovers.length} Cover gefunden`);

        const versionText = selectedVersion > 0 ? `(Version X.${selectedVersion})` : '(Standard)';
        setSeriesInfo([
            ['Serie:', seriesTitle || '–'],
            ['Cover:', `${selectedCovers.length} · ${localeLabel(selectedLocale)} ${versionText}`]
        ]);

        startButton.style.display = 'block';
        startButton.disabled = false;
        startButton.textContent = '📁 Cover herunterladen';

        copyLinksButton.style.display = 'block';
        copyLinksButton.disabled = false;
        copyLinksButton.textContent = `📋 ${selectedCovers.length} Links kopieren`;

        log(`Bereit zum Download: ${selectedCovers.length} Cover`);
    }

    /* ------------------------------------------------------------------
     * 9. Download / Clipboard
     * ------------------------------------------------------------------ */

    function getCoverUrl(id, filename) {
        return `https://uploads.mangadex.org/covers/${id}/${filename}`;
    }

    function sanitizeFilename(filename) {
        let sanitized = String(filename || '')
            .replace(/[<>:"/\\|?*~]/g, '_')
            .replace(/[\x00-\x1F\x7F]/g, '')
            .replace(/^\.+/, '')
            .trim()
            .replace(/[.\s]+$/, '');

        if (!sanitized) sanitized = 'Manga';
        if (sanitized.length > 200) sanitized = sanitized.substring(0, 200);
        return sanitized;
    }

    function getRange() {
        const from = parseInt(rangeFromInput.value, 10) || 1;
        const to = parseInt(rangeToInput.value, 10) || selectedCovers.length;
        return { from, to };
    }

    async function downloadCover(coverUrl) {
        const r = await gmRequest(coverUrl, 'blob');
        if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}`);
        const blob = r.response;
        if (!blob || !blob.size) throw new Error('Leere Antwort');
        if (blob.type && !blob.type.startsWith('image/')) {
            throw new Error(`Kein Bild (${blob.type}) – evtl. Bot-Challenge, https://uploads.mangadex.org einmal im Tab öffnen`);
        }
        return blob;
    }

    async function copyLinksToClipboard() {
        if (selectedCovers.length === 0) return;

        const { from, to } = getRange();
        const coversToProcess = selectedCovers.slice(from - 1, to);

        const lines = coversToProcess.map(cover => {
            const vol = parseVolume(cover.attributes.volume);
            const coverUrl = getCoverUrl(mangaId, cover.attributes.fileName);
            const volumeNumber = vol.main > 0 ? vol.main : 'unknown';
            return `${volumeNumber}|oc||${coverUrl}`;
        });

        const textToCopy = lines.join('\n');
        const originalText = copyLinksButton.textContent;

        try {
            await navigator.clipboard.writeText(textToCopy);
            log(`✓ ${lines.length} Links kopiert`);
            updateProgress(`✅ ${lines.length} Links in Zwischenablage kopiert!`);
            copyLinksButton.textContent = '✅ Kopiert!';
            setTimeout(() => {
                copyLinksButton.textContent = originalText;
                hideProgress();
            }, 2000);
        } catch (error) {
            log(`✗ Fehler beim Kopieren: ${error.message}`);
            updateProgress('❌ Kopieren fehlgeschlagen – Links stehen im Log');
            lines.forEach(l => log(l));
            logDiv.classList.add('show-log');
        }
    }

    function getDirectoryPicker() {
        const w = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
        return typeof w.showDirectoryPicker === 'function'
            ? w.showDirectoryPicker.bind(w)
            : null;
    }

    async function downloadToFolder() {
        if (isDownloading || selectedCovers.length === 0) return;

        const showDirectoryPicker = getDirectoryPicker();
        if (!showDirectoryPicker) {
            alert('Ihr Browser unterstützt keine direkten Ordner-Downloads. Bitte Chrome oder Edge verwenden.');
            return;
        }

        const { from, to } = getRange();
        if (from < 1 || to < from || to > selectedCovers.length) {
            alert(`Ungültiger Bereich! Bitte zwischen 1 und ${selectedCovers.length} wählen.`);
            return;
        }

        const coversToDownload = selectedCovers.slice(from - 1, to);
        log(`Lade Cover ${from} bis ${to} (${coversToDownload.length} Stück)`);

        isDownloading = true;
        const originalText = startButton.textContent;
        startButton.disabled = true;
        startButton.textContent = '📁 Ordner wählen...';

        try {
            // Direkt im Klick-Handler aufrufen – braucht eine User-Geste
            const directoryHandle = await showDirectoryPicker();

            const sanitizedSeriesName = sanitizeFilename(seriesTitle);
            const seriesFolderHandle = await directoryHandle.getDirectoryHandle(sanitizedSeriesName, { create: true });
            log(`Zielordner: ${sanitizedSeriesName}`);

            let successCount = 0;

            for (let i = 0; i < coversToDownload.length; i++) {
                const cover = coversToDownload[i];
                const volumeStr = cover.attributes.volume || 'unknown';

                try {
                    updateProgress(`📁 Lade ${i + 1}/${coversToDownload.length}: Band ${volumeStr}`);
                    startButton.textContent = `📁 Lade ${i + 1}/${coversToDownload.length}...`;

                    const coverUrl = getCoverUrl(mangaId, cover.attributes.fileName);
                    const imageBlob = await downloadCover(coverUrl);

                    const extension = (cover.attributes.fileName.split('.').pop() || 'jpg').toLowerCase();
                    const vol = parseVolume(volumeStr);

                    const fileName = vol.main === 0
                        ? `unknown_${i + 1}.${extension}`
                        : `${vol.main}.${extension}`;

                    const fileHandle = await seriesFolderHandle.getFileHandle(fileName, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(imageBlob);
                    await writable.close();

                    successCount++;
                    log(`✓ Gespeichert: ${fileName} (Band ${volumeStr})`);
                } catch (error) {
                    log(`✗ Fehler bei Band ${volumeStr}: ${error.message}`);
                }

                await new Promise(r => setTimeout(r, 400));
            }

            updateProgress(`✅ Fertig! ${successCount}/${coversToDownload.length} Cover in "${sanitizedSeriesName}"`);
            startButton.textContent = '✅ Fertig!';
        } catch (error) {
            if (error.name === 'AbortError') {
                updateProgress('❌ Download abgebrochen');
                startButton.textContent = '❌ Abgebrochen';
            } else {
                console.error('[MangaDex Cover Downloader] Ordner-Download:', error);
                updateProgress('❌ Download-Fehler: ' + error.message);
                startButton.textContent = '❌ Fehler';
            }
        } finally {
            isDownloading = false;
            setTimeout(() => {
                startButton.textContent = originalText;
                startButton.disabled = false;
            }, 3000);
        }
    }

    /* ------------------------------------------------------------------
     * 10. Initialisierung & SPA-Handling
     * ------------------------------------------------------------------ */

    function resetUI() {
        allCovers = [];
        selectedCovers = [];
        seriesTitle = '';
        mangaId = '';
        selectedVersion = null;
        selectedLocale = null;

        versionSelector.classList.remove('show-version-selector');
        localeSelector.classList.remove('show-version-selector');
        rangeSelector.classList.remove('show-range-selector');

        startButton.style.display = 'none';
        startButton.disabled = true;
        copyLinksButton.style.display = 'none';
        copyLinksButton.disabled = true;
        toggleLogButton.style.display = 'none';
        logDiv.classList.remove('show-log');
        logDiv.replaceChildren();

        resetAnalyzeButton();
        hideProgress();
    }

    function initialize() {
        mangaId = getMangaId();

        if (!mangaId) {
            seriesInfoDiv.textContent = 'ℹ️ Keine Titel-Seite – öffne einen Manga.';
            analyzeButton.disabled = true;
            return;
        }

        analyzeButton.disabled = false;

        const titleElement = document.querySelector('.text-xl.font-bold') || document.querySelector('h1');
        if (titleElement) seriesTitle = titleElement.textContent.trim();

        setSeriesInfo([
            ['Manga erkannt', ''],
            ['ID:', mangaId.substring(0, 8) + '…']
        ]);

        log('Bereit – Manga-ID: ' + mangaId);
    }

    // Event Listener
    analyzeButton.addEventListener('click', analyzeCovers);
    startButton.addEventListener('click', downloadToFolder);
    copyLinksButton.addEventListener('click', copyLinksToClipboard);

    confirmLocaleButton.addEventListener('click', () => {
        const selected = localeOptions.querySelector('input[name="locale"]:checked');
        if (!selected) return;
        selectedLocale = selected.value;
        log(`Sprache ausgewählt: ${selectedLocale}`);
        continueAfterLocale();
    });

    confirmVersionButton.addEventListener('click', () => {
        const selected = versionOptions.querySelector('input[name="version"]:checked');
        if (!selected) return;
        selectedVersion = parseInt(selected.value, 10);
        selectedCovers = filterCovers(allCovers, selectedVersion, selectedLocale);
        proceedToDownload();
    });

    toggleLogButton.addEventListener('click', () => {
        logDiv.classList.toggle('show-log');
        toggleLogButton.textContent = logDiv.classList.contains('show-log')
            ? '🔍 Details ausblenden'
            : '🔍 Details anzeigen';
    });

    headerEl.addEventListener('click', () => {
        ui.classList.toggle('mdcd-collapsed');
    });

    // Erstes Einhängen
    mount();
    initialize();
    log('MangaDex Cover Downloader geladen');

    // Wächter: hängt das Panel neu ein, falls die SPA es entfernt,
    // und erkennt Navigationswechsel ohne teuren MutationObserver.
    let lastUrl = location.href;
    setInterval(() => {
        if (mount()) {
            log('UI wurde entfernt – neu eingehängt');
        }

        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (isAnalyzing || isDownloading) return;
            resetUI();
            setTimeout(initialize, 300);
        }
    }, 750);
})();
