/**
 * OmniPrompt Pro - Deep Injector
 * Hardened for 2026 AI DOM Structures
 */

// 1. More exhaustive list of possible input selectors
const INPUT_SELECTORS = [
    "#prompt-textarea",             // ChatGPT 
    "rich-textarea p",              // Gemini
    ".ProseMirror",                 // Perplexity / Claude
    "div[contenteditable='true']",  // Generic Modern
    "textarea",                     // Classic Fallback
    "p[data-placeholder]",          // New Ghost-text fields
    "[role='textbox']"              // Accessibility standard
];

// Helper: Find the element even if it's hidden or nested
function getInputElement() {
    for (const selector of INPUT_SELECTORS) {
        const el = document.querySelector(selector);
        if (el) return el;
    }
    return null;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("OmniPrompt Injector received:", msg.action);
    const inputEl = getInputElement();

    if (msg.action === "GET_CHATBOX_TEXT") {
        if (!inputEl) {
            console.error("OmniPrompt: Could not find chatbox to read.");
            sendResponse({ text: "" });
            return;
        }
        // Grab value from textarea or textContent from Divs
        const text = (inputEl.value || inputEl.innerText || inputEl.textContent || "").trim();
        sendResponse({ text: text });
    }

    if (msg.action === "INJECT_TEXT") {
        if (!inputEl) {
            sendResponse({ success: false, error: "No chatbox found" });
            return;
        }

        inputEl.focus();

        if (inputEl.isContentEditable || inputEl.tagName === 'DIV' || inputEl.tagName === 'P') {
            // Force clean and insert for modern frameworks (React/Next.js)
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            document.execCommand('insertText', false, msg.payload);
        } else {
            // Standard Textarea logic
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
            setter.call(inputEl, msg.payload);
        }

        // Trigger events to let the site know text has arrived
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));

        if (msg.autoSend) {
            setTimeout(() => {
                const btn = document.querySelector("button[data-testid='send-button'], button[aria-label='Send message'], button[aria-label='Submit']");
                if (btn) btn.click();
                else inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, code: 'Enter' }));
            }, 500);
        }
        sendResponse({ success: true });
    }
    return true; 
});