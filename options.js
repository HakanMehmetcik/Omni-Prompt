document.addEventListener('DOMContentLoaded', async () => {
    // Load existing settings
    const settings = await chrome.storage.local.get({
        apiUrl: 'http://127.0.0.1:11434/api/generate',
        modelName: 'gpt-oss:20b' // Matches your 'ollama list'
    });

    document.getElementById('apiUrl').value = settings.apiUrl;
    document.getElementById('modelName').value = settings.modelName;

    // Save logic
    document.getElementById('save').addEventListener('click', () => {
        const apiUrl = document.getElementById('apiUrl').value;
        const modelName = document.getElementById('modelName').value;

        chrome.storage.local.set({ apiUrl, modelName }, () => {
            alert('Settings saved! Refresh your chat page.');
        });
    });
});