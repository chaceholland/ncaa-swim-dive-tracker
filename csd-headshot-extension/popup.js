document.getElementById('scrapeBtn').addEventListener('click', () => {
  const status = document.getElementById('status');
  status.textContent = 'Scraping started... Check console for progress.';
  status.className = 'show success';
  
  chrome.runtime.sendMessage({action: 'scrapeAllTeams'}, (response) => {
    console.log('Scrape initiated:', response);
  });
  
  // Close popup after starting
  setTimeout(() => {
    window.close();
  }, 1500);
});
