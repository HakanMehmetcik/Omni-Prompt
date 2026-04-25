let controller = null;

const SYSTEM_PROMPTS = {
    technical: "Expert Software Engineer. Build a structured prompt with architecture focus.",
    academic: "Research Professor. Build a formal, methodological prompt for deep analysis.",
    creative: "Creative Strategist. Build a narrative-driven, engaging prompt."
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // 1. Handle Stop Action
    if (msg.action === "STOP") {
        if (controller) {
            controller.abort();
            controller = null;
        }
        sendResponse({ success: true });
        return false; // Synchronous response
    }

    // 2. Handle Compilation
    if (msg.action === "COMPILE_AND_INJECT") {
        controller = new AbortController();
        
        // Execute the async workflow
        handleInference(msg, sendResponse);
        
        return true; // CRITICAL: Keeps the message channel open for async sendResponse
    }
});

/**
 * Optimized Inference Handler
 */
async function handleInference(msg, sendResponse) {
    try {
        // Fetch fresh settings
        const s = await chrome.storage.local.get({
            apiUrl: 'http://127.0.0.1:11434/api/generate',
            modelName: 'gpt-oss:latest'
        });

        const selectedModel = msg.modelOverride || s.modelName;
        const sys = `${SYSTEM_PROMPTS[msg.flavor] || ""} Transform: ${msg.basicText}. Output ONLY the final engineered prompt.`;

        console.log(`OmniPrompt: Requesting ${selectedModel}...`);

        const response = await fetch(s.apiUrl, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: selectedModel,
                prompt: sys,
                stream: false,
                options: {
                    num_predict: 1024, // Ensure enough tokens for complex prompts
                    temperature: 0.7
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama Error: ${response.status}`);
        }

        const data = await response.json();
        let engineeredText = data.response ? data.response.trim() : "";

        // Strip accidental Markdown wrapping from local models
        engineeredText = engineeredText.replace(/^```[a-z]*\n/i, "").replace(/\n```$/i, "");

        if (!engineeredText) throw new Error("AI returned empty response.");

        // Hand off to the content script (injector.js)
        chrome.tabs.sendMessage(msg.tabId, {
            action: "INJECT_TEXT",
            payload: engineeredText,
            autoSend: msg.autoSend
        }, (resp) => {
            // Check for bridge errors
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: "Content script unreachable. Refresh the chat page." });
            } else {
                sendResponse({ success: true });
            }
        });

    } catch (e) {
        console.error("OmniPrompt Background Error:", e);
        
        // Don't send error if we intentionally aborted
        if (e.name === 'AbortError') {
            sendResponse({ success: false, error: "Generation stopped." });
        } else {
            sendResponse({ success: false, error: e.message });
        }
    } finally {
        controller = null;
    }
}