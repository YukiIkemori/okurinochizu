const header = document.querySelector<HTMLElement>('.site-header');
const menu = header?.querySelector<HTMLDetailsElement>('.mobile-menu');

if (header && menu) {
  const mobile = window.matchMedia('(max-width: 760px)');
  const scrollPosition = () => Math.min(
    Math.max(0, window.scrollY),
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
  );
  let previousPosition = scrollPosition();
  let travel = 0;
  let frame = 0;

  const reveal = () => {
    header.classList.remove('site-header--hidden');
    previousPosition = scrollPosition();
    travel = 0;
  };
  const update = () => {
    frame = 0;
    const position = scrollPosition();
    const keyboardFocus = header.querySelector(':focus-visible');
    if (!mobile.matches || position <= header.offsetHeight || menu.open || keyboardFocus) {
      reveal();
      return;
    }
    const delta = position - previousPosition;
    previousPosition = position;
    if (!delta) return;
    if (Math.sign(delta) !== Math.sign(travel)) travel = 0;
    travel += delta;
    // A small threshold prevents toggles from finger jitter or trackpad noise.
    if (Math.abs(travel) >= 10) {
      header.classList.toggle('site-header--hidden', travel > 0);
      travel = 0;
    }
  };
  window.addEventListener('scroll', () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  }, { passive: true });
  mobile.addEventListener('change', reveal);
  window.addEventListener('pageshow', reveal);
  header.addEventListener('focusin', reveal);
  menu.addEventListener('toggle', () => {
    menu.querySelector('summary')?.setAttribute('aria-label', menu.open ? 'メニューを閉じる' : 'メニューを開く');
    // A delayed close event must not override scrolling that already hid the header.
    if (menu.open) reveal();
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
  });
}
