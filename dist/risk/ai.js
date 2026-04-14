"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.askAI = askAI;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");
const SYSTEM_PROMPT = 'You are KABAYAN BOT, an autonomous Solana meme coin trading agent (v2.0). ' +
    'Output strict JSON only: {"aksi":"BELI"|"JUAL"|"TAHAN","persentase":0.9,"alasan":"reason","sl_current":0.0,"trailing_active":false,"daily_pnl_pct":0.0,"fee_mode":"SAFE"|"NORMAL"|"AGGRESSIVE","position_size_sol":0.1}';
function getProviderChain() {
    const providers = [];
    if (env_1.ENV.GROQ_API_KEY)
        providers.push('groq');
    if (env_1.ENV.ANTHROPIC_API_KEY)
        providers.push('claude');
    if (env_1.ENV.OPENAI_API_KEY)
        providers.push('gpt');
    providers.push('fallback');
    return providers;
}
async function callGroq(prompt, system, start) {
    const res = await axios_1.default.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.3-70b-versatile',
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
        ],
        temperature: 0,
        max_tokens: 500,
    }, {
        headers: {
            Authorization: 'Bearer ' + env_1.ENV.GROQ_API_KEY,
            'Content-Type': 'application/json',
        },
        timeout: 5000,
    });
    return {
        provider: 'groq',
        content: res.data.choices[0].message.content,
        latencyMs: Date.now() - start,
    };
}
async function callClaude(prompt, system, start) {
    const res = await axios_1.default.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 500,
        system: system,
        messages: [{ role: 'user', content: prompt }],
    }, {
        headers: {
            'x-api-key': env_1.ENV.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        },
        timeout: 10000,
    });
    return {
        provider: 'claude',
        content: res.data.content[0].text,
        latencyMs: Date.now() - start,
    };
}
async function callGPT(prompt, system, start) {
    const res = await axios_1.default.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
        ],
        temperature: 0,
        max_tokens: 500,
    }, {
        headers: {
            Authorization: 'Bearer ' + env_1.ENV.OPENAI_API_KEY,
            'Content-Type': 'application/json',
        },
        timeout: 10000,
    });
    return {
        provider: 'gpt',
        content: res.data.choices[0].message.content,
        latencyMs: Date.now() - start,
    };
}
async function askAI(prompt, systemOverride) {
    const system = systemOverride || SYSTEM_PROMPT;
    const chain = getProviderChain();
    for (const provider of chain) {
        try {
            const start = Date.now();
            if (provider === 'groq')
                return await callGroq(prompt, system, start);
            if (provider === 'claude')
                return await callClaude(prompt, system, start);
            if (provider === 'gpt')
                return await callGPT(prompt, system, start);
            if (provider === 'fallback') {
                return {
                    provider: 'fallback',
                    content: '{"aksi":"TAHAN","alasan":"NO_AI_PROVIDER"}',
                    latencyMs: 0,
                };
            }
        }
        catch (error) {
            logger_1.logger.warn('[AI] ' + provider + ' failed: ' + error.message);
            continue;
        }
    }
    return {
        provider: 'fallback',
        content: '{"aksi":"TAHAN","alasan":"ALL_AI_FAILED"}',
        latencyMs: 0,
    };
}
//# sourceMappingURL=ai.js.map