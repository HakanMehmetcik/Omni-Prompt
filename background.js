let controller = null;

const SYSTEM_PROMPTS = {
    technical: "Expert Software Engineer. Build a structured prompt with architecture focus.",
    academic: "Research Professor. Build a formal, methodological prompt for deep analysis.",
    creative: "Creative Strategist. Build a narrative-driven, engaging prompt."
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "STOP") {
        controller?.abort();
        return true;
    }

    if (msg.action === "COMPILE_AND_INJECT") {
        controller = new AbortController();
        (async () => {
            try {
                // Get fresh settings
                const s = await chrome.storage.local.get({
                    apiUrl: 'http://127.0.0.1:11434/api/generate',
                    modelName: 'gpt-oss:latest'
                });

                const sys = `${SYSTEM_PROMPTS[msg.flavor] || ""} Transform: ${msg.basicText}. Output ONLY engineered prompt.`;
                
                console.log("OmniPrompt: Contacting Ollama with model:", msg.modelOverride || s.modelName);

                const response = await fetch(s.apiUrl, {
                    method: 'POST',
                    signal: controller.signal,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: msg.modelOverride || s.modelName,
                        prompt: sys,
                        stream: false
                    })
                });

                if (!response.ok) throw new Error(`Ollama Error: ${response.status}`);

                const data = await response.json();
                const engineeredText = data.response.trim();

                // Send to content script
                chrome.tabs.sendMessage(msg.tabId, {
                    action: "INJECT_TEXT",
                    payload: engineeredText,
                    autoSend: msg.autoSend
                }, (resp) => {
                    if (chrome.runtime.lastError) {
                        sendResponse({ success: false, error: "Content Script not ready. Refresh page." });
                    } else {
                        sendResponse({ success: true });
                    }
                });

            } catch (e) {
                console.error("OmniPrompt Background Error:", e);
                sendResponse({ success: false, error: e.name === 'AbortError' ? "Stopped" : e.message });
            }
        })();
        return true;
    }
});