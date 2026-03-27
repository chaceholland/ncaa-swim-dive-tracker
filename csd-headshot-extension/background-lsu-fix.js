  // LSU: Special handler - uses similar structure to UK
  if (window.location.hostname === 'lsusports.net') {
    // Try roster player links (found 82 in debug)
    let lsuCards = document.querySelectorAll('a[href*="/roster/player/"]');
    
    // Fallback to other selectors if needed
    if (lsuCards.length === 0) {
      lsuCards = document.querySelectorAll('.sqs-row, .roster-player, .athlete-card');
    }
    
    lsuCards.forEach((card) => {
      const nameEl = card.querySelector('h3, h4, h2, p strong, .name, [class*="name"]');
      let imgEl = card.querySelector('img');
      
      // If no img inside card, check parent or siblings
      if (!imgEl && card.parentElement) {
        imgEl = card.parentElement.querySelector('img');
      }
      
      if (nameEl) {
        const name = nameEl.textContent.trim();
        let headshot = null;
        
        if (imgEl) {
          headshot = imgEl.src || imgEl.dataset.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-image');
          const bad = ['placeholder', 'default', 'silhouette', 'avatar', 'blank'];
          if (headshot && bad.some(b => headshot.toLowerCase().includes(b))) {
            headshot = null;
          }
        }
        
        // Accept with or without headshot (like Kentucky handler)
        if (name) {
          athletes.push({ name, headshot });
        }
      }
    });
    return { athletes, debug };
  }