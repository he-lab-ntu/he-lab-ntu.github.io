// =====================================================
//  main.js — shared across all pages
// =====================================================

// --- Current year in footer ---
document.querySelectorAll('#year').forEach(el => {
  el.textContent = new Date().getFullYear();
});

// --- Mobile nav toggle ---
const toggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');
if (toggle && navLinks) {
  toggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    toggle.setAttribute('aria-expanded', navLinks.classList.contains('open'));
  });
  // Close nav on link click (mobile)
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

// --- Scroll-triggered fade-up animations ---
const fadeEls = document.querySelectorAll('.fade-up');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // Stagger within a parent grid
          const siblings = entry.target.parentElement.querySelectorAll('.fade-up');
          let delay = 0;
          siblings.forEach((sib, idx) => {
            if (sib === entry.target) delay = idx * 80;
          });
          setTimeout(() => entry.target.classList.add('visible'), delay);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );
  fadeEls.forEach(el => observer.observe(el));
} else {
  // Fallback: show all immediately
  fadeEls.forEach(el => el.classList.add('visible'));
}
