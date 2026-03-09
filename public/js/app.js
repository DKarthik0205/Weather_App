const fileInput = document.getElementById('fileInput');
const submitBtn = document.getElementById('submitBtn');
const statusEl = document.getElementById('status');

if (fileInput && submitBtn) {
  submitBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
      statusEl.textContent = 'Please select a CSV file.';
      statusEl.style.color = '#b42318';
      return;
    }

    const content = await file.text();
    const response = await fetch('/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, content }),
    });

    const data = await response.json();
    statusEl.textContent = data.message;
    statusEl.style.color = response.ok ? '#027a48' : '#b42318';
  });
}
