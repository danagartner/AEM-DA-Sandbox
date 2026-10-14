import { getMetadata, toClassName } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { matchBreakpoint } from '../../scripts/breakpoints.js';
import pathsMatch from '../../scripts/paths.js';
import wireDisclosureToggle from '../../scripts/disclosure-toggle.js';

/**
 * Templates whose `side-menu: toc` gets the blog-article "Jump to section" treatment (hardcoded
 * heading, side-menu.css's plain underlined-link rows) instead of the generic accordion look.
 * Mirrors scripts.js's own SIDE_MENU_TOC_TEMPLATES (which decides which templates get
 * `side-menu: toc` for free) — kept as a separate copy rather than an import, since scripts.js
 * runs loadPage() at module top level and pulling it into a block's module graph breaks under
 * test (blocks are imported directly there, not loaded via aem.js's usual runtime path). Keep
 * the two lists in sync if either changes.
 */
const BLOG_ARTICLE_TOC_TEMPLATES = ['blog-article'];

/**
 * The direct-child link for an <li> — its own <a>, or one wrapped in a direct-child <p> (e.g.
 * a lone link in a loose Markdown list). Written as manual child traversal rather than
 * `li.querySelector(':scope > a, :scope > p > a')`: in this project's jsdom test environment,
 * `:scope > a` unreliably matches descendant <a>s anywhere in the subtree, not just direct
 * children, which silently mislabeled category toggles with a leaf link's text several levels
 * down. Manual traversal has no such ambiguity.
 * @param {Element} li
 * @returns {Element|null}
 */
function directLink(li) {
  const children = [...li.children];
  const a = children.find((child) => child.tagName === 'A');
  if (a) return a;
  const p = children.find((child) => child.tagName === 'P');
  return p ? ([...p.children].find((child) => child.tagName === 'A') ?? null) : null;
}

/**
 * Marks `target` (a toggle button or leaf <li>) as the one selected item across the whole
 * side-menu block — removing `.selected` from whatever else had it first, so at most one item
 * carries it at a time. A single `click` listener on the caller's side is enough to cover mouse
 * clicks, touch taps, and keyboard Enter alike: browsers dispatch a native click event for all
 * three on both `<button>` and `<a>` elements.
 * @param {Element} target
 */
function selectItem(target) {
  const scope = target.closest('.side-menu.block') ?? target.getRootNode();
  scope.querySelector('.selected')?.classList.remove('selected');
  target.classList.add('selected');
}

/**
 * Creates a `.side-menu-toggle` button that shows/hides `panel` — sets its initial
 * `aria-expanded` state and `panel.hidden` to match `expanded`, and wires up a click listener
 * that keeps the two in sync from then on. Shared by enhanceList()'s per-category toggles and
 * addMainToggle()'s outer toggle, which otherwise differ only in the button's extra class and
 * label.
 * @param {Element} panel The element this button shows/hides
 * @param {boolean} expanded Initial state
 * @returns {HTMLButtonElement}
 */
function createToggle(panel, expanded) {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'side-menu-toggle';
  toggle.addEventListener('click', () => selectItem(toggle));
  wireDisclosureToggle(toggle, panel, expanded);
  return toggle;
}

/**
 * Turns an authored nested <ul>/<li> list into an accordion. An <li> that contains its own
 * nested <ul> becomes a parent: its label is replaced with a toggle button (collapsed by
 * default), and its link, if any, is discarded — the design uses these as category headings,
 * not pages of their own. An <li> with a link and no nested list is a leaf: it's marked active
 * when its href matches the current page.
 *
 * Ancestors of the active leaf are expanded automatically so the current page is always
 * visible without user interaction. Only the *immediate* parent of the active leaf — not every
 * ancestor — gets the distinct "current section" highlight; shallower ancestors are expanded
 * but otherwise styled like any other collapsed-or-expanded toggle.
 *
 * At desktop (see `expandByDefault`), every parent toggle starts expanded instead of just the
 * active branch — matching side-menu.css's desktop rules, which keep these toggles fully
 * interactive there (unlike the main toggle) so a visitor can still re-collapse categories they
 * don't need after that initial expanded state.
 * @param {Element} ul
 * @param {string} currentPath
 * @param {boolean} expandByDefault Initial expanded state for toggles not on the active branch
 * @returns {{hasActive: boolean, direct: boolean}} hasActive: an active leaf exists anywhere
 *   under this list. direct: that active leaf is a direct child of this list (as opposed to
 *   nested further down) — used by the caller to decide whether *it* is the immediate parent.
 */
function enhanceList(ul, currentPath, expandByDefault) {
  ul.classList.add('side-menu-list');
  let hasActive = false;
  let direct = false;

  [...ul.children].forEach((li) => {
    if (li.tagName !== 'LI') return;
    li.classList.add('side-menu-item');
    const nestedUl = [...li.children].find((child) => child.tagName === 'UL') ?? null;
    const link = directLink(li);

    if (nestedUl) {
      li.classList.add('side-menu-item-parent');
      // The label is whatever's in this <li> besides the nested list itself — its own link
      // text if it has one, otherwise the text of its other direct child nodes. Not
      // `li.textContent`: that would also pull in every descendant link's text from nestedUl.
      const label = link
        ? link.textContent.trim()
        : [...li.childNodes]
            .filter((node) => node !== nestedUl)
            .map((node) => node.textContent)
            .join(' ')
            .trim();
      [...li.childNodes].forEach((node) => {
        if (node !== nestedUl) node.remove();
      });
      const toggle = createToggle(nestedUl, expandByDefault);
      toggle.textContent = label;
      li.prepend(toggle);

      const child = enhanceList(nestedUl, currentPath, expandByDefault);
      if (child.hasActive) {
        hasActive = true;
        toggle.setAttribute('aria-expanded', 'true');
        nestedUl.hidden = false;
        if (child.direct) li.classList.add('side-menu-item-current-section');
      }
    } else if (link) {
      li.classList.add('side-menu-item-leaf');
      // Markdown can wrap a lone link in its own <p> (e.g. in a loose list) — unwrap it so the
      // link is always a direct child of the <li>, matching the `.side-menu-item-leaf > a`
      // selector side-menu.css styles it with.
      const wrapper = link.parentElement;
      if (wrapper !== li && wrapper.tagName === 'P') wrapper.replaceWith(link);
      if (pathsMatch(link.getAttribute('href'), currentPath)) {
        link.classList.add('side-menu-active');
        link.setAttribute('aria-current', 'page');
        hasActive = true;
        direct = true;
      }
      // Makes the whole row clickable, not just the link text (side-menu.css gives the <li>
      // itself a pointer cursor to match). Ignores clicks on the link itself for navigation —
      // those already navigate natively, and re-triggering here would bypass ctrl/cmd/middle-
      // click's open-in-new-tab behavior — but selectItem() still runs either way.
      li.addEventListener('click', (event) => {
        selectItem(li);
        if (event.target.closest('a')) return;
        window.location.href = link.href;
      });
    }
  });

  return { hasActive, direct };
}

/**
 * Returns `heading` as-is if it's already an `<h5>`, otherwise a new `<h5>` with the same content,
 * replacing `heading` in place. Tag-only conversion — attributes besides the moved child nodes
 * aren't preserved, matching how this element only ever gets used for its text label.
 * @param {Element} heading
 * @returns {Element}
 */
function asH5(heading) {
  if (heading.tagName === 'H5') return heading;
  const h5 = document.createElement('h5');
  h5.append(...heading.childNodes);
  heading.replaceWith(h5);
  return h5;
}

/**
 * Wraps everything currently in the block into a single panel behind one toggle button — mobile
 * only (see side-menu.css: the button is hidden and the panel forced visible at desktop, where
 * the sidebar is always shown in full). This is a separate, outer toggle from the per-category
 * ones enhanceList() builds: it hides/shows the whole menu at once, independent of whichever
 * categories happen to be expanded inside it.
 *
 * Collapsed by default on mobile, so a visitor has to deliberately open it — the same rationale
 * as the per-category toggles' collapsed default. On desktop, it starts (and stays — see
 * side-menu.css) expanded, since the panel is always shown there regardless of this button's
 * state; starting it collapsed there would just leave `aria-expanded` inaccurate. It's also
 * pulled out of the keyboard tab order there — side-menu.css already makes it inert to mouse
 * clicks (pointer-events: none) at desktop, but that alone doesn't stop it from being tabbed to,
 * so this is the one part of that desktop-inert behavior CSS can't handle on its own.
 *
 * The toggle's label is the fragment's own authored heading, moved into the button rather than
 * duplicated — so whatever title content authors give the menu is what mobile visitors tap.
 * Accepts any heading level (h1–h6) or a plain paragraph, normalized to an `<h5>` — matching
 * side-menu.css's `.side-menu-main-toggle > h5` styling regardless of what authors actually used.
 * @param {Element} block
 * @param {boolean} isDesktop
 */
function addMainToggle(block, isDesktop) {
  const panel = document.createElement('div');
  panel.className = 'side-menu-panel';
  panel.append(...block.childNodes);

  const toggle = createToggle(panel, isDesktop);
  toggle.classList.add('side-menu-main-toggle');
  if (isDesktop) toggle.tabIndex = -1;
  const heading = panel.querySelector('h1, h2, h3, h4, h5, h6, p');
  if (heading) toggle.append(asH5(heading));

  block.append(toggle, panel);
}

/**
 * Builds a table-of-contents fragment straight from the page's own content, for use when the
 * `side-menu` metadata value is the literal string `toc` rather than a separate fragment page's
 * path (see decorate()). Mirrors the shape loadFragment() would return for an authored fragment —
 * a heading followed by a flat <ul> of links — so it flows through the same
 * enhanceList()/addMainToggle() pipeline either way.
 *
 * `fixedTitle`, when given, is used as the heading verbatim — this is how decorate() forces the
 * literal "Jump to section" (per the blog-article Figma reference, node 1702:9731) on templates
 * in SIDE_MENU_TOC_TEMPLATES. Without it, the heading falls back to the page's own title (the
 * first heading of the first wrapper) — the original behavior, still used for any other page
 * that authors `side-menu: toc` outside those templates, which has no "Jump to section" design
 * to match and no other authored title to derive one from.
 *
 * Reads every `.side-menu-content > .section > .default-content-wrapper` (see scripts.js's
 * loadSideMenu(), which builds that container around every other section already on the page
 * before this block decorates), then filters each wrapper down to just its heading (h1–h6)
 * children — a wrapper with no heading among its children isn't addressable as a section, so
 * it's dropped entirely rather than picking some other, non-heading element as its "header". Only
 * H2 headings become side-menu items (other levels, e.g. subheadings within a section, are left
 * out of the jump list), linking to it via an anchor id — assigned here if the heading doesn't
 * already have one, since sections aren't otherwise addressable. Exception: the first wrapper's
 * first heading is treated as the page's own title — e.g. the H1 — and is never itself listed as a
 * jump target regardless of its level.
 * @param {Element} block
 * @param {string} [fixedTitle] Heading text to use verbatim instead of the page's own title
 * @returns {Element|null} A fragment-shaped element, or null if the page has no headings to list
 */
function buildTocFragment(block, fixedTitle) {
  const wrapperHeadings = [
    ...(block
      .closest('.side-menu-layout')
      ?.querySelectorAll('.side-menu-content > .section > .default-content-wrapper') ?? []),
  ]
    .map((wrapper) => [...wrapper.children].filter((child) => /^H[1-6]$/.test(child.tagName)))
    .filter((headings) => headings.length > 0);
  if (!wrapperHeadings.length) return null;

  const fragment = document.createElement('main');

  const titleElement = wrapperHeadings[0][0];
  const heading = document.createElement('h5');
  heading.textContent = fixedTitle ?? titleElement.textContent.trim();
  fragment.append(heading);

  const list = document.createElement('ul');
  let itemCount = 0;
  wrapperHeadings.forEach((headings) => {
    headings.forEach((header) => {
      if (header.tagName !== 'H2') return;
      itemCount += 1;
      if (!header.id) header.id = `side-menu-toc-${itemCount}`;
      const link = document.createElement('a');
      link.href = `#${header.id}`;
      link.textContent = header.textContent.trim();
      const li = document.createElement('li');
      li.append(link);
      list.append(li);
    });
  });
  fragment.append(list);

  return fragment;
}

/**
 * Undoes scripts.js's loadSideMenu() wrapping when this block ends up with nothing to show —
 * restores `.side-menu-content`'s sections as main's direct children again, in their original
 * order, in place of the now-pointless `.side-menu-wrapper`. Without this, simply removing the
 * block would leave that wrapper (and side-menu.css's desktop-only flex-basis rules, which give
 * `.side-menu-content` a fixed two-thirds width to sit beside the sidebar) behind — permanently
 * reserving a blank column where the sidebar would have been instead of letting the page render
 * full-width, as the authoring guide promises. Falls back to plain `block.remove()` when there's
 * no such wrapper to unwrap (e.g. a block used standalone, outside scripts.js's loadSideMenu()).
 * @param {Element} block
 */
function removeSideMenu(block) {
  const wrapper = block.closest('.side-menu-wrapper');
  const sideMenuContent = wrapper?.querySelector('.side-menu-content');
  if (!sideMenuContent) {
    block.remove();
    return;
  }
  wrapper.replaceWith(...sideMenuContent.childNodes);
}

/**
 * Populates the side-menu block from the `side-menu` page-metadata path — the same path
 * scripts.js's loadSideMenu() read to decide whether to build this block in the first place.
 * Re-reading it here keeps this block self-contained, consistent with how fragment.js's own
 * decorate() resolves its path. A value of literally `toc` is a special case handled entirely on
 * this page — see buildTocFragment() — rather than a path to fetch.
 *
 * The blog-article-specific "Jump to section" look (hardcoded heading, side-menu.css's plain
 * underlined-link rows via the `side-menu-blog-toc` class) only applies when the page's own
 * template is one of BLOG_ARTICLE_TOC_TEMPLATES. A page outside that list that authors
 * `side-menu: toc` explicitly still gets a working table of contents, just with the original
 * page-title heading and the generic accordion styling — there's no "Jump to section" design
 * for it to match.
 *
 * Once loaded, turns the fragment's nested list into an accordion (see enhanceList) — any
 * content authored above that list (e.g. a standalone "Home" link) is left as-is — then adds the
 * mobile-only main toggle around all of it.
 * @param {Element} block
 */
export default async function decorate(block) {
  const path = getMetadata('side-menu');
  const isToc = path === 'toc';
  const isBlogArticleToc =
    isToc && BLOG_ARTICLE_TOC_TEMPLATES.includes(toClassName(getMetadata('template')));
  const fragment = isToc
    ? buildTocFragment(block, isBlogArticleToc ? 'Jump to section' : undefined)
    : await loadFragment(path);
  if (!fragment) {
    removeSideMenu(block);
    return;
  }
  // Flags the blog-article TOC's plain, underlined-text-link styling (side-menu.css) — visually
  // distinct from the bordered/accordion look manual fragments (and non-blog-article toc pages)
  // get.
  block.classList.toggle('side-menu-blog-toc', isBlogArticleToc);
  block.replaceChildren(...fragment.childNodes);

  // Checked once, at decoration time — reflects the viewport on page load/refresh, not live
  // resizes, matching how the rest of the accordion's initial state (e.g. the active branch) is
  // also only ever computed once here.
  const isDesktop = matchBreakpoint('--bp-desktop').matches;

  const rootList = block.querySelector('ul');
  if (rootList) enhanceList(rootList, window.location.pathname, isDesktop);

  addMainToggle(block, isDesktop);
}
