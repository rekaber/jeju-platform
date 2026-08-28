/* js/intro.js - 제주 부동산 플랫폼
   인트로 오버레이
═══════════════════════════════════════════════ */
(function initIntro() {
  const overlay = document.getElementById('intro-overlay');
  if (!overlay) return;

  // 배경 파티클 생성
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'intro-particle';
    const size = 6 + Math.random() * 40;
    p.style.cssText = [
      `width:${size}px`, `height:${size}px`,
      `left:${Math.random() * 100}%`,
      `bottom:${-size}px`,
      `animation-duration:${8 + Math.random() * 14}s`,
      `animation-delay:${Math.random() * 8}s`,
      `opacity:${0.03 + Math.random() * 0.07}`
    ].join(';');
    overlay.appendChild(p);
  }
})();

function dismissIntro() {
  const overlay = document.getElementById('intro-overlay');
  if (!overlay) return;
  overlay.classList.add('fade-out');
  setTimeout(() => { overlay.style.display = 'none'; }, 800);
}
