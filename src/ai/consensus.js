(function() {
    'use strict';

    window.xdAnswers = window.xdAnswers || {};
    window.xdAnswers._internal = window.xdAnswers._internal || {};

    const I = window.xdAnswers._internal;

    function normalizeAnswer(answer) {
        return String(answer || '')
            .trim()
            .toLowerCase()
            // Convert decimal comma to dot for numeric matching (1,5 → 1.5)
            .replace(/(\d),(\d)/g, '$1.$2')
            // Strip option letter prefixes like "A:", "B:", "C:", "D:" at the start
            .replace(/^[a-g]\s*[:.)]\s*/i, '')
            // Strip Ukrainian option prefixes like "В:", "Г:", "Д:"
            .replace(/^[а-г]\s*[:.)]\s*/i, '')
            .replace(/[\s"'`\)\]\}.,!?;:…]+$/g, '');
    }

    function computeConsensus(runResults) {
        const fulfilled = runResults.filter(r => r.status === 'fulfilled');
        const normalizedCounts = new Map();
        const parsedResults = runResults.map(r => {
            const parsedAnswer = r.status === 'fulfilled' ? I.parseAIResponse(r.value).answer : null;
            const normalized = parsedAnswer ? normalizeAnswer(parsedAnswer) : '';
            if (r.status === 'fulfilled') {
                const entry = normalizedCounts.get(normalized) || { count: 0, answer: parsedAnswer };
                entry.count += 1;
                if (!entry.answer && parsedAnswer) entry.answer = parsedAnswer;
                normalizedCounts.set(normalized, entry);
            }
            return { ...r, parsedAnswer, isMajority: false, _normalizedAnswer: normalized };
        });

        if (fulfilled.length === 0) {
            return {
                state: 'no-consensus',
                majorityAnswer: null,
                agreement: 0,
                runResults: parsedResults.map(({ _normalizedAnswer, ...rest }) => rest)
            };
        }

        let majorityAnswer = '';
        let majorityNormalized = '';
        let majorityCount = 0;
        for (const [answer, entry] of normalizedCounts.entries()) {
            if (entry.count > majorityCount) {
                majorityNormalized = answer;
                majorityAnswer = entry.answer;
                majorityCount = entry.count;
            }
        }

        const agreement = Math.round((majorityCount / fulfilled.length) * 100);
        const allMatch = majorityCount === fulfilled.length;
        const hasMajority = majorityCount > fulfilled.length / 2;
        const state = allMatch ? 'unanimous' : (hasMajority ? 'majority' : 'no-consensus');

        return {
            state,
            majorityAnswer,
            agreement,
            runResults: parsedResults.map(result => ({
                ...(({ _normalizedAnswer, ...rest }) => rest)(result),
                isMajority: result.status === 'fulfilled' && result._normalizedAnswer === majorityNormalized
            }))
        };
    }

    function getMainModelRun(settings) {
        return {
            id: '__main__',
            providerId: settings.activeProviderId || '',
            model: settings.model || '',
            showAnswerOnly: settings.showAnswerOnly || false,
            isMainModel: true
        };
    }

    async function runConsensus(questionData) {
        const settings = window.xdAnswers.settings;
        const consensus = settings && settings.consensus;
        const extraRuns = consensus && consensus.runs;

        if (!consensus || !consensus.enabled || !Array.isArray(extraRuns) || extraRuns.length < 1) {
            return null;
        }

        // Always include main model as first run, then extra runs
        const allRuns = [getMainModelRun(settings), ...extraRuns];

        const settled = await Promise.allSettled(allRuns.map(async run => {
            const effectiveSettingsOverride = I.getEffectiveSettingsForRun(settings, run);
            const showAnswerOnlyOverride = run.showAnswerOnly;
            const value = await window.xdAnswers.getAnswer(questionData, effectiveSettingsOverride, showAnswerOnlyOverride);
            return { run, value };
        }));

        const runResults = settled.map((entry, index) => {
            const run = allRuns[index];
            if (entry.status === 'fulfilled') {
                return { status: 'fulfilled', value: entry.value.value, run };
            }
            return { status: 'rejected', reason: entry.reason, run };
        });

        return computeConsensus(runResults);
    }

    I.computeConsensus = computeConsensus;
    I.runConsensus = runConsensus;
})();
