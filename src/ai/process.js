// src/ai/process.js
// Main question processing pipeline. Extracted from legacy utils.js (lines 1842-1975).
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    window.xdAnswers.processQuestion = async function(questionData) {
        if (window.xdAnswers.isProcessingAI) {
            window.xdAnswers._oneClickUserTriggered = false;
            return;
        }

        const I = window.xdAnswers._internal;
        const silentMode = window.xdAnswers.settings.silentMode || '';
        const webSearch = window.xdAnswers.settings.webSearchEnabled && I.getActiveSearchProvider(window.xdAnswers.settings);
        console.log('[xdAnswers] processQuestion:', questionData.text?.slice(0, 80) + '...', '| topic=' + (questionData.topic || 'none'), '| webSearch=' + !!webSearch, '| silent=' + silentMode);

        // In oneclick mode, only process when user explicitly clicked (flag set by setupOneClickHandler)
        if (silentMode === 'oneclick' && !window.xdAnswers._oneClickUserTriggered) {
            return;
        }
        window.xdAnswers._oneClickUserTriggered = false;

        const isSilent = silentMode !== '';

        if (!isSilent) {
            window.xdAnswers.createUI();
            window.xdAnswers.attachAndPositionHelper();
        }

        window.xdAnswers.isProcessingAI = true;
        const startTime = Date.now();

        function getElapsed() {
            const ms = Date.now() - startTime;
            const sec = Math.floor(ms / 1000);
            return sec >= 60 ? Math.floor(sec / 60) + 'm ' + (sec % 60) + 's' : sec + 's';
        }

        if (!isSilent && window.xdAnswers.answerContentDiv) {
            window.xdAnswers.answerContentDiv.innerHTML = '<div class="xd-loader"></div>';
            const statusDiv = document.createElement('div');
            statusDiv.className = 'xd-status';
            statusDiv.textContent = '⏳ Connecting...';
            window.xdAnswers.answerContentDiv.appendChild(statusDiv);
            const statusInterval = setInterval(() => {
                // Always update footer elapsed
                const footerElapsed = window.xdAnswers.helperContainer?.querySelector('#xd-footer-elapsed');
                if (footerElapsed) footerElapsed.textContent = '⏱ ' + getElapsed();
                // Update status text if still showing
                const s = window.xdAnswers.answerContentDiv?.querySelector('.xd-status');
                if (s) s.textContent = '⏳ Waiting for response...';
            }, 1000);
            window.xdAnswers._statusInterval = statusInterval;
        }

        try {
            let result;
            const _cs = window.xdAnswers.settings.consensus;
            console.log('[xdAnswers] consensus check:', JSON.stringify(_cs));
            const consensusEnabled = _cs && _cs.runs && _cs.runs.length >= 1;
            if (consensusEnabled) {
                const I = window.xdAnswers._internal;
                const consensusSettings = window.xdAnswers.settings.consensus;
                // Main model always first, then extra runs
                const mainRun = { id: '__main__', providerId: window.xdAnswers.settings.activeProviderId || '', model: window.xdAnswers.settings.model || '', showAnswerOnly: window.xdAnswers.settings.showAnswerOnly || false, isMainModel: true };
                const runs = [mainRun, ...consensusSettings.runs];
                const answerContentDiv = window.xdAnswers.answerContentDiv;
                let consensusFinalized = false;

                if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }

                const updateFooterElapsed = () => {
                    const footerElapsed = window.xdAnswers.helperContainer?.querySelector('#xd-footer-elapsed');
                    if (footerElapsed) footerElapsed.textContent = '⏱ ' + getElapsed();
                };

                const updateFooterModel = (label) => {
                    const footerModel = window.xdAnswers.helperContainer?.querySelector('.xd-footer-model');
                    if (footerModel) footerModel.textContent = label;
                };

                const setActiveTab = (tabIndex, shouldUpdateFooter) => {
                    if (!answerContentDiv) return;
                    const tabButtons = Array.from(answerContentDiv.querySelectorAll('.xd-consensus-tab'));
                    const tabContents = Array.from(answerContentDiv.querySelectorAll('.xd-tab-content'));
                    for (let i = 0; i < tabButtons.length; i++) {
                        tabButtons[i].classList.toggle('active', i === tabIndex);
                    }
                    for (let i = 0; i < tabContents.length; i++) {
                        tabContents[i].classList.toggle('active-tab', i === tabIndex);
                    }
                    if (shouldUpdateFooter && !consensusFinalized) {
                        const modelName = tabButtons[tabIndex]?.dataset.modelName || 'consensus';
                        updateFooterModel(modelName);
                    }
                };

                // Create tab UI
                if (!isSilent && answerContentDiv) {
                    const tabsHtml = '<div class="xd-consensus-tabs">' + runs.map((run, index) => {
                        const modelName = run.model || window.xdAnswers.settings.model || 'model';
                        return '<div class="xd-consensus-tab' + (index === 0 ? ' active' : '') + '" data-tab="' + index + '" data-model-name="' + I.escapeHTML(modelName) + '"><span class="xd-tab-spinner"></span> ' + I.escapeHTML(modelName) + '</div>';
                    }).join('') + '</div>';

                    const contentHtml = runs.map((run, index) => {
                        return '<div class="xd-tab-content' + (index === 0 ? ' active-tab' : '') + '" data-tab="' + index + '"><div class="xd-loader"></div></div>';
                    }).join('');

                    answerContentDiv.innerHTML = tabsHtml + contentHtml;

                    const tabButtons = Array.from(answerContentDiv.querySelectorAll('.xd-consensus-tab'));
                    // Drag-to-scroll state shared with click handler
                    let _tabDragMoved = false;
                    tabButtons.forEach((tabButton, index) => {
                        tabButton.addEventListener('click', function() {
                            if (_tabDragMoved) { _tabDragMoved = false; return; } // was a drag, not a click
                            setActiveTab(index, true);
                        });
                    });

                    // Horizontal scroll: mouse wheel + drag-to-scroll
                    const tabsContainer = answerContentDiv.querySelector('.xd-consensus-tabs');
                    if (tabsContainer) {
                        // Wheel → horizontal scroll
                        tabsContainer.addEventListener('wheel', function(e) {
                            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // already horizontal
                            const hasScroll = this.scrollWidth > this.clientWidth;
                            if (!hasScroll) return;
                            e.preventDefault();
                            this.scrollLeft += e.deltaY;
                        }, { passive: false });

                        // Drag-to-scroll (works on tabs too — distinguishes drag vs click by distance)
                        let dragState = null;
                        tabsContainer.addEventListener('mousedown', function(e) {
                            dragState = { startX: e.pageX, scrollLeft: this.scrollLeft, moved: false };
                            this.style.cursor = 'grabbing';
                        });
                        document.addEventListener('mousemove', function(e) {
                            if (!dragState) return;
                            const dx = e.pageX - dragState.startX;
                            if (Math.abs(dx) > 5) dragState.moved = true;
                            if (dragState.moved) {
                                tabsContainer.scrollLeft = dragState.scrollLeft - dx;
                            }
                        });
                        document.addEventListener('mouseup', function() {
                            if (!dragState) return;
                            _tabDragMoved = dragState.moved;
                            dragState = null;
                            tabsContainer.style.cursor = '';
                        });
                    }

                    setActiveTab(0, true);
                    updateFooterElapsed();
                    window.xdAnswers._statusInterval = setInterval(updateFooterElapsed, 1000);
                }

                // Stream each model into its own tab
                const runPromises = runs.map((run, index) => {
                    const modelName = run.model || window.xdAnswers.settings.model || 'model';
                    const effectiveSettingsOverride = I.getEffectiveSettingsForRun(window.xdAnswers.settings, run);
                    const showAnswerOnlyOverride = run.showAnswerOnly;
                    const tabContentDiv = !isSilent && answerContentDiv ? answerContentDiv.querySelector('.xd-tab-content[data-tab="' + index + '"]') : null;

                    return window.xdAnswers.streamAnswer(questionData, startTime, {
                        contentDiv: tabContentDiv,
                        effectiveSettings: effectiveSettingsOverride,
                        showAnswerOnly: showAnswerOnlyOverride
                    }).then(streamResult => {
                        // Stream completed — update tab button, parse final content
                        const parsed = I.parseAIResponse(streamResult.content);
                        if (!isSilent && answerContentDiv) {
                            const tabButton = answerContentDiv.querySelector('.xd-consensus-tab[data-tab="' + index + '"]');
                            if (tabButton) {
                                const answerLabel = parsed.answer ? I.escapeHTML(String(parsed.answer)) + ' ' : '';
                                tabButton.classList.remove('xd-tab-error');
                                tabButton.innerHTML = answerLabel + I.escapeHTML(modelName);
                            }
                        }
                        return { status: 'fulfilled', value: streamResult.content, run: run };
                    }).catch(error => {
                        const reason = error instanceof Error ? error : new Error(String(error && error.message ? error.message : error || 'Unknown'));
                        if (!isSilent && answerContentDiv) {
                            const tabContent = answerContentDiv.querySelector('.xd-tab-content[data-tab="' + index + '"]');
                            const tabButton = answerContentDiv.querySelector('.xd-consensus-tab[data-tab="' + index + '"]');
                            if (tabContent) tabContent.innerHTML = I.formatError(reason.message || 'Unknown');
                            if (tabButton) {
                                tabButton.classList.add('xd-tab-error');
                                tabButton.innerHTML = '✖ ' + I.escapeHTML(modelName);
                            }
                        }
                        return { status: 'rejected', reason: reason, run: run };
                    });
                });

                const runResults = await Promise.all(runPromises);
                const consensusResult = I.computeConsensus(runResults);

                consensusFinalized = true;

                if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }

                updateFooterElapsed();

                if (!isSilent && answerContentDiv) {
                    const stateEmoji = consensusResult.state === 'unanimous' ? '🟢' : consensusResult.state === 'majority' ? '🟡' : '🔴';
                    const stateText = consensusResult.state === 'unanimous' ? 'Unanimous' : consensusResult.state === 'majority' ? 'Majority' : 'No consensus';
                    const bannerClass = consensusResult.state === 'unanimous' ? 'xd-consensus-unanimous' : consensusResult.state === 'majority' ? 'xd-consensus-majority' : 'xd-consensus-no-consensus';
                    const consensusBanner = '<div class="xd-consensus-banner ' + bannerClass + '">' + stateEmoji + ' ' + stateText + ' <span class="xd-consensus-agreement">' + consensusResult.agreement + '%</span></div>';

                    for (let i = 0; i < consensusResult.runResults.length; i++) {
                        const rr = consensusResult.runResults[i];
                        const tabButton = answerContentDiv.querySelector('.xd-consensus-tab[data-tab="' + i + '"]');
                        if (!tabButton) continue;
                        tabButton.classList.remove('xd-tab-majority', 'xd-tab-minority', 'xd-tab-error');
                        if (rr.status === 'rejected') {
                            tabButton.classList.add('xd-tab-error');
                            tabButton.innerHTML = '🔴 ' + I.escapeHTML(rr.run.model || window.xdAnswers.settings.model || 'model');
                        } else if (rr.isMajority) {
                            tabButton.classList.add('xd-tab-majority');
                            tabButton.innerHTML = '🟢 ' + I.escapeHTML(rr.run.model || window.xdAnswers.settings.model || 'model');
                        } else {
                            tabButton.classList.add('xd-tab-minority');
                            tabButton.innerHTML = '🟡 ' + I.escapeHTML(rr.run.model || window.xdAnswers.settings.model || 'model');
                        }
                    }

                    const majorityIndex = consensusResult.runResults.findIndex(r => r.isMajority && r.status === 'fulfilled');
                    const fallbackIndex = consensusResult.runResults.findIndex(r => r.status === 'fulfilled');
                    const focusIndex = majorityIndex !== -1 ? majorityIndex : (fallbackIndex !== -1 ? fallbackIndex : 0);
                    const focusTabContent = answerContentDiv.querySelector('.xd-tab-content[data-tab="' + focusIndex + '"]');
                    if (focusTabContent) {
                        focusTabContent.innerHTML = consensusBanner + focusTabContent.innerHTML;
                    }

                    setActiveTab(focusIndex, false);
                    updateFooterModel('consensus');
                }

                if (consensusResult.majorityAnswer) {
                    if (!isSilent) {
                        I.highlightCorrectAnswer(consensusResult.majorityAnswer);
                    }
                    I.autoSelectAnswer(consensusResult.majorityAnswer, silentMode === 'oneclick');
                }

                window.xdAnswers.isProcessingAI = false;
                window.xdAnswers._oneClickContainer = null;
                return;
            }
            try {
                result = await window.xdAnswers.streamAnswer(questionData, startTime);
            } catch (streamErr) {
                console.warn('xdAnswers: Streaming failed, falling back:', streamErr.message);
                const answer = await window.xdAnswers.getAnswer(questionData);
                result = { content: answer, thinking: '' };
            }

            if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }

            const elapsed = getElapsed();
            const parsed = I.parseAIResponse(result.content);
            window.xdAnswers.lastParsedResponse = parsed;

            if (isSilent) {
                I.applySilentMode(parsed.answer || parsed.explanation || 'Parse error', parsed);
            } else if (window.xdAnswers.answerContentDiv) {
                let html = '<div class="xd-elapsed">⏱ ' + elapsed + '</div>';
                // Update footer elapsed too
                const footerElapsed = window.xdAnswers.helperContainer?.querySelector('#xd-footer-elapsed');
                if (footerElapsed) footerElapsed.textContent = '⏱ ' + elapsed;
                if (result.thinking) {
                    html += '<div class="xd-thinking">' +
                        '<div class="xd-thinking-header" style="cursor:pointer;">💭 Thinking <span class="xd-thinking-timer">(' + elapsed + ')</span> <span class="xd-thinking-chars">(' + result.thinking.length + ' chars)</span> <span class="xd-thinking-toggle">▼</span></div>' +
                        '<div class="xd-thinking-content" style="display:none !important;">' + window.xdAnswers.renderMarkdown(result.thinking) + '</div></div>';
                }
                if (result.searchCalls && result.searchCalls.length > 0) {
                    const scDone = result.searchCalls.filter(sc => sc.status === 'done').length;
                    html += '<div class="xd-search-block">' +
                        '<div class="xd-search-header" style="cursor:pointer;">🔍 Web Search <span class="xd-search-count">(' + scDone + ')</span> <span class="xd-search-toggle">▼</span></div>' +
                        '<div class="xd-search-content" style="display:none !important;">';
                    for (const sc of result.searchCalls) {
                        html += '<div class="xd-search-entry">✓ <span class="xd-searching-query">' + I.escapeHTML(sc.query) + '</span> <span class="xd-searching-count">(' + (sc.resultCount || 0) + ' results)</span></div>';
                    }
                    html += '</div></div>';
                }
                html += I.renderParsedResponse(parsed);
                window.xdAnswers.answerContentDiv.innerHTML = html;

                const th = window.xdAnswers.answerContentDiv.querySelector('.xd-thinking-header');
                if (th) th.addEventListener('click', function() { I.toggleThinkingContent(this); });
                const sh = window.xdAnswers.answerContentDiv.querySelector('.xd-search-header');
                if (sh) sh.addEventListener('click', function() {
                    const content = this.nextElementSibling;
                    if (!content) return;
                    const toggle = this.querySelector('.xd-search-toggle');
                    const isHidden = content.style.display === 'none' || getComputedStyle(content).display === 'none';
                    content.style.setProperty('display', isHidden ? 'block' : 'none', 'important');
                    if (toggle) toggle.textContent = isHidden ? '▲' : '▼';
                });
            }

            if (parsed.answer) {
                if (!isSilent) {
                    I.highlightCorrectAnswer(parsed.answer);
                }
                // If provider set a custom auto-answer handler, use it instead of default
                if (window.xdAnswers._customAutoAnswer) {
                    const customFn = window.xdAnswers._customAutoAnswer;
                    window.xdAnswers._customAutoAnswer = null;
                    setTimeout(() => {
                        window.xdAnswers._autoSelecting = true;
                        try { customFn(parsed.answer, parsed); } catch (e) { console.error('xdAnswers customAutoAnswer:', e); }
                        window.xdAnswers._oneClickContainer = null;
                        window.xdAnswers._answerContainer = null;
                        window.xdAnswers._autoSelecting = false;
                    }, window.xdAnswers.settings.autoAnswerCooldown);
                } else {
                    // In oneclick mode, always auto-select (bypass autoAnswer setting)
                    I.autoSelectAnswer(parsed.answer, silentMode === 'oneclick');
                }
            }
        } catch (error) {
            if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }
            if (!isSilent && window.xdAnswers.answerContentDiv) {
                const errHtml = I.formatError(error.message);
                window.xdAnswers.answerContentDiv.innerHTML = errHtml;
            }
        } finally {
            window.xdAnswers.isProcessingAI = false;
            window.xdAnswers._oneClickContainer = null;
        }
    };
})();
