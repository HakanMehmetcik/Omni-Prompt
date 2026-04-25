document.addEventListener('DOMContentLoaded', async () => {
    const ui = {
        input: document.getElementById('basicInput'),
        model: document.getElementById('modelSelect'),
        flavor: document.getElementById('flavorSelect'),
        auto: document.getElementById('autoSend'),
        inject: document.getElementById('injectBtn'),
        revise: document.getElementById('reviseBtn'),
        stop: document.getElementById('stopBtn'),
        status: document.getElementById('status')
    };

    // Load dynamic models from Ollama
    try {
        const response = await fetch('http://127.0.0.1:11434/api/tags');
        const data = await response.json();
        ui.model.innerHTML = '';
        data.models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name; opt.textContent = m.name;
            ui.model.appendChild(opt);
        });
        const s = await chrome.storage.local.get(['modelName', 'flavor', 'autoSend']);
        if (s.modelName) ui.model.value = s.modelName;
        if (s.flavor) ui.flavor.value = s.flavor;
        ui.auto.checked = !!s.autoSend;
    } catch (e) {
        ui.status.textContent = "Ollama connection error.";
    }

    const runEngine = async (text) => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        ui.status.textContent = "AI is thinking...";
        ui.inject.disabled = true;

        // Modern Promise-based message sending to avoid "Port Closed" warnings
        try {
            const response = await chrome.runtime.sendMessage({
                action: "COMPILE_AND_INJECT",
                basicText: text,
                flavor: ui.flavor.value,
                autoSend: ui.auto.checked,
                tabId: tab.id,
                modelOverride: ui.model.value
            });

            ui.inject.disabled = false;
            if (response && response.success) {
                window.close();
            } else {
                ui.status.textContent = response?.error || "Failed";
            }
        } catch (err) {
            ui.inject.disabled = false;
            ui.status.textContent = "Engine error.";
            console.error("Inference Error:", err);
        }
    };

    ui.inject.addEventListener('click', () => {
        if (ui.input.value.trim()) runEngine(ui.input.value.trim());
    });

    ui.revise.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;
        
        ui.status.textContent = "Reading chatbox...";

        chrome.tabs.sendMessage(tab.id, { action: "GET_CHATBOX_TEXT" }, (response) => {
            if (chrome.runtime.lastError) {
                ui.status.textContent = "Error: Refresh the chat page!";
                return;
            }

            if (response && response.text) {
                runEngine("Polish and improve this prompt: " + response.text);
            } else {
                ui.status.textContent = "Chatbox is empty!";
            }
        });
    });

    ui.stop.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "STOP" });
        ui.status.textContent = "Stopped.";
        ui.inject.disabled = false;
    });
});