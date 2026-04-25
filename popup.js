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
        ui.status.textContent = "AI is thinking...";
        ui.inject.disabled = true;

        chrome.runtime.sendMessage({
            action: "COMPILE_AND_INJECT",
            basicText: text,
            flavor: ui.flavor.value,
            autoSend: ui.auto.checked,
            tabId: tab.id,
            modelOverride: ui.model.value
        }, (res) => {
            ui.inject.disabled = false;
            if (res?.success) window.close();
            else ui.status.textContent = res?.error || "Failed";
        });
    };

    ui.inject.addEventListener('click', () => {
        if (ui.input.value.trim()) runEngine(ui.input.value.trim());
    });

    ui.revise.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        ui.status.textContent = "Reading chatbox...";

        // Send message with error handling to catch uninitialized content scripts
        chrome.tabs.sendMessage(tab.id, { action: "GET_CHATBOX_TEXT" }, (response) => {
            if (chrome.runtime.lastError) {
                ui.status.textContent = "Error: Refresh the chat page!";
                console.error("Bridge Error:", chrome.runtime.lastError.message);
                return;
            }

            if (response && response.text) {
                runEngine("Polish and improve this: " + response.text);
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