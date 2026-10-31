// src/ai/process/consensus.ts
// Consensus run: streams every configured model, computes agreement, and updates the tab UI.
(function() {
    'use strict';
    window.xdAnswers = window.xdAnswers || ({} as XdAnswers);
    window.xdAnswers._internal = window.xdAnswers._internal || ({} as XdAnswersInternal);

    const I = window.xdAnswers._internal;

    I.runConsensusProcess = async function(questionData: XdQuestionData, startTime: number, isSilent: boolean, silentMode: string, generation?: number): Promise<void> {
        const consensusSettings = window.xdAnswers.settings.consensus;
        const isCurrent = () => generation === undefined || window.xdAnswers._processGeneration === generation;
        // Main model always first, then extra runs
        const mainRun: XdConsensusRun = { id: '__main__', providerId: window.xdAnswers.settings.activeProviderId || '', model: window.xdAnswers.settings.model || '', showAnswerOnly: window.xdAnswers.settings.showAnswerOnly || false, isMainModel: true };
        const runs: XdConsensusRun[] = [mainRun, ...consensusSettings.runs];
        const answerContentDiv = window.xdAnswers.answerContentDiv;
        let consensusFinalized = false;

        if (window.xdAnswers._statusInterval) { clearInterval(window.xdAnswers._statusInterval); window.xdAnswers._statusInterval = null; }

        const updateFooterElapsed = () => {
            const footerElapsed = window.xdAnswers.helperContainer?.querySelector('#lbl-elapsed, #xd-footer-elapsed');
            if (footerElapsed) footerElapsed.innerHTML = '<span class="xd-icon" style="font-size:13px !important;vertical-align:middle;margin-right:2px;">schedule</span> ' + I.getProcessElapsed(startTime);
        };

        const updateFooterModel = (label: string) => {
            const footerModel = window.xdAnswers.helperContainer?.querySelector('#lbl-model, .app-model, .xd-footer-model');
            if (footerModel) footerModel.textContent = label;
        };

        const setActiveTab = (tabIndex: number, shouldUpdateFooter: boolean) => {
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
                const modelName = (tabButtons[tabIndex] as HTMLElement | undefined)?.dataset.modelName || 'consensus';
                updateFooterModel(modelName);
            }
        };

        // Create tab UI
        if (!isSilent && answerContentDiv) {
            I.buildConsensusTabs(answerContentDiv, runs, setActiveTab);
            setActiveTab(0, true);
            updateFooterElapsed();
            window.xdAnswers._statusInterval = setInterval(updateFooterElapsed, 1000);
        }

        // Stream each model into its own tab
        const runPromises = runs.map((run, index): Promise<XdConsensusRunResult> => {
            const modelName = run.model || window.xdAnswers.settings.model || 'model';
            const effectiveSettingsOverride = I.getEffectiveSettingsForRun(window.xdAnswers.settings, run);
            const showAnswerOnlyOverride = run.showAnswerOnly === undefined ? undefined : !!run.showAnswerOnly;
            const tabContentDiv = !isSilent && answerContentDiv ? answerContentDiv.querySelector<HTMLElement>('.xd-tab-content[data-tab="' + index + '"]') : null;

            return window.xdAnswers.streamAnswer(questionData, startTime, {
                contentDiv: tabContentDiv,
                effectiveSettings: effectiveSettingsOverride,
                showAnswerOnly: showAnswerOnlyOverride
            }).then(streamResult => {
                // Stream completed — update tab button, parse final content
                const parsed = I.parseAIResponse(streamResult.content);
                if (isCurrent() && !isSilent && answerContentDiv) {
                    const tabButton = answerContentDiv.querySelector('.xd-consensus-tab[data-tab="' + index + '"]');
                    if (tabButton) {
                        const answerLabel = parsed.answer ? I.escapeHTML(String(parsed.answer)) + ' ' : '';
                        tabButton.classList.remove('xd-tab-error');
                        tabButton.innerHTML = answerLabel + I.escapeHTML(modelName);
                    }
                }
                return { status: 'fulfilled' as const, value: streamResult.content, run: run };
            }).catch(error => {
                const reason = error instanceof Error ? error : new Error(String((error as any) && (error as any).message ? (error as any).message : error || 'Unknown'));
                if (isCurrent() && !isSilent && answerContentDiv) {
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
        if (!isCurrent()) return;
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
            if (!isCurrent()) return;
            if (!isSilent) {
                I.highlightCorrectAnswer(consensusResult.majorityAnswer);
            }
            I.autoSelectAnswer(consensusResult.majorityAnswer, silentMode === 'oneclick');
        }

        if (isCurrent()) {
            window.xdAnswers.isProcessingAI = false;
            window.xdAnswers._oneClickContainer = null;
        }
    };
})();
