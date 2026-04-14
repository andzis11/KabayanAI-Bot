type AIProvider = 'groq' | 'claude' | 'gpt' | 'fallback';
interface AIResponse {
    provider: AIProvider;
    content: string;
    latencyMs: number;
}
export declare function askAI(prompt: string, systemOverride?: string): Promise<AIResponse>;
export {};
