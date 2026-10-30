/** One plugin-owned stylesheet, injected under a stable tag by the panel. */
export const STYLE_ID = 'dsh-relax-reader/panel'

export const styles = String.raw`
.nr-root {
  --nr-paper: var(--dsw-alias-bg-base, transparent);
  --nr-ink: var(--dsw-alias-label-primary, #232320);
  --nr-soft: var(--dsw-alias-label-tertiary, #74716a);
  --nr-faint: var(--dsw-alias-label-quaternary, #76736b);
  --nr-line: var(--dsw-alias-border-l3, rgba(35, 35, 32, 0.14));
  --nr-line-strong: var(--dsw-alias-border-l2, rgba(35, 35, 32, 0.22));
  --nr-surface: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.08));
  --nr-raised: var(--dsw-alias-bg-layer-1, #fff);
  --nr-accent: #3f6860;
  --nr-accent-ink: #ffffff;
  --nr-accent-wash: color-mix(in srgb, var(--nr-accent) 11%, transparent);
  --nr-danger: var(--dsw-alias-state-error-primary, #b42318);
  --nr-danger-wash: color-mix(in srgb, var(--nr-danger) 9%, transparent);
  --nr-success: var(--dsw-alias-state-success-primary, #2e7d5b);
  --nr-serif: "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", "STSong", "SimSun", serif;
  --nr-sans: "Avenir Next", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --nr-leading: 1.9;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  container-type: inline-size;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--nr-paper);
  color: var(--nr-ink);
  font-family: var(--nr-sans);
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}

.nr-root *,
.nr-root *::before,
.nr-root *::after {
  box-sizing: border-box;
}

.nr-root button,
.nr-root input {
  font: inherit;
}

.nr-root button:focus-visible,
.nr-root input:focus-visible {
  outline: 2px solid var(--nr-accent);
  outline-offset: 1px;
}

.nr-theme-light {
  --nr-paper: #fbfaf6;
  --nr-ink: #252521;
  --nr-soft: #6d6a62;
  --nr-faint: #76736b;
  --nr-line: rgba(37, 37, 33, 0.13);
  --nr-line-strong: rgba(37, 37, 33, 0.22);
  --nr-surface: #f0eee7;
  --nr-raised: #fffefb;
  --nr-accent: #38635b;
}

.nr-theme-sepia {
  --nr-paper: #f2e9d7;
  --nr-ink: #3a3025;
  --nr-soft: #7a6a58;
  --nr-faint: #6f6050;
  --nr-line: rgba(58, 48, 37, 0.16);
  --nr-line-strong: rgba(58, 48, 37, 0.28);
  --nr-surface: #e9ddc7;
  --nr-raised: #f7efdf;
  --nr-accent: #76543b;
}

.nr-theme-dark {
  --nr-paper: #191b1b;
  --nr-ink: #e3e0d9;
  --nr-soft: #9c9991;
  --nr-faint: #8b8982;
  --nr-line: rgba(227, 224, 217, 0.13);
  --nr-line-strong: rgba(227, 224, 217, 0.24);
  --nr-surface: #232626;
  --nr-raised: #242727;
  --nr-accent: #9db8ad;
  --nr-accent-ink: #18201d;
  --nr-success: #83b79f;
}

.nr-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--nr-line-strong) transparent;
}

.nr-scroll::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.nr-scroll::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 8px;
  background-clip: padding-box;
  background-color: var(--nr-line-strong);
}

.nr-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.nr-topbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 12px 14px 11px 16px;
  border-bottom: 1px solid var(--nr-line);
}

.nr-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.nr-shelf-head {
  justify-content: flex-end;
  align-items: center;
  min-height: 48px;
  padding: 8px 18px;
}

.nr-heading {
  min-width: 0;
  flex: 1;
}

.nr-display {
  margin: 0;
  font-family: var(--nr-serif);
  font-size: 22px;
  line-height: 1.16;
  font-weight: 600;
  letter-spacing: 0.015em;
}

.nr-title {
  margin: 0;
  font-family: var(--nr-serif);
  font-size: 16px;
  line-height: 1.35;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nr-subtitle {
  margin: 2px 0 0;
  color: var(--nr-soft);
  font-size: 11px;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nr-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
}

.nr-icon-button {
  appearance: none;
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--nr-soft);
  cursor: pointer;
  transition: color 120ms ease, background-color 120ms ease;
}

.nr-icon-button:hover:not(:disabled) {
  color: var(--nr-ink);
  background: var(--nr-surface);
}

.nr-icon-button:disabled {
  opacity: 0.36;
  cursor: default;
}

.nr-icon-button[aria-pressed="true"] {
  color: var(--nr-ink);
  background: var(--nr-surface);
}

.nr-icon {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.55;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.nr-add {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  margin-top: 2px;
  padding: 0 12px 0 9px;
  border: 1px solid var(--nr-line-strong);
  border-radius: 18px;
  background: transparent;
  color: var(--nr-ink);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: border-color 120ms ease, background-color 120ms ease;
}

.nr-add:hover {
  border-color: var(--nr-accent);
  background: var(--nr-accent-wash);
}

.nr-add .nr-icon {
  width: 14px;
  height: 14px;
}

.nr-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.nr-error {
  flex: none;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 10px 14px 0;
  padding: 9px 10px;
  border-left: 2px solid var(--nr-danger);
  background: var(--nr-danger-wash);
  color: var(--nr-danger);
  font-size: 11.5px;
  line-height: 1.55;
}

.nr-error-text {
  flex: 1;
  min-width: 0;
}

.nr-error-close {
  appearance: none;
  flex: none;
  width: 20px;
  height: 20px;
  margin: -2px -2px 0 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
}

.nr-empty {
  position: relative;
  height: 100%;
  min-height: 260px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: 28px 30px 60px;
  overflow: hidden;
}

.nr-empty::after {
  content: "阅";
  position: absolute;
  right: -18px;
  bottom: -42px;
  color: var(--nr-ink);
  font-family: var(--nr-serif);
  font-size: 150px;
  line-height: 1;
  opacity: 0.045;
  pointer-events: none;
}

.nr-empty-title {
  margin: 0;
  font-family: var(--nr-serif);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.nr-empty-copy {
  max-width: 230px;
  margin: 9px 0 18px;
  color: var(--nr-soft);
  font-size: 12px;
  line-height: 1.65;
}

.nr-empty-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;
}

.nr-secondary {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--nr-line-strong);
  border-radius: 8px;
  background: transparent;
  color: var(--nr-soft);
  cursor: pointer;
  font-size: 12px;
}

.nr-secondary:hover {
  color: var(--nr-ink);
  background: var(--nr-surface);
}

.nr-primary {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--nr-accent);
  color: var(--nr-accent-ink);
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
  transition: opacity 120ms ease, transform 120ms ease;
}

.nr-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.nr-primary:active:not(:disabled) {
  transform: translateY(1px);
}

.nr-primary:disabled {
  opacity: 0.45;
  cursor: default;
}

.nr-shelf-stage {
  display: flex;
  flex-direction: column;
  gap: 27px;
  width: 100%;
}

.nr-featured {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--nr-line);
  border-radius: 15px;
  background: var(--nr-surface);
  transition: border-color 160ms ease, background-color 160ms ease;
}

.nr-featured:hover,
.nr-featured:focus-within {
  border-color: var(--nr-line-strong);
}

.nr-featured-open {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 17px;
  width: 100%;
  padding: 18px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.nr-featured-open:disabled {
  opacity: 0.65;
  cursor: default;
}

.nr-featured .nr-cover-featured {
  width: 92px;
  height: 130px;
  border-left-width: 4px;
  border-radius: 3px 6px 6px 3px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18), 0 2px 5px rgba(0, 0, 0, 0.1);
  transition: transform 180ms ease;
}

.nr-featured-open:hover .nr-cover-featured {
  transform: translateY(-2px);
}

.nr-featured .nr-cover-featured .nr-cover-glyph {
  font-size: 32px;
}

.nr-featured-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
  padding: 2px 26px 2px 0;
}

.nr-featured-kicker {
  color: var(--nr-accent);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.nr-featured-title {
  margin-top: 2px;
  color: var(--nr-ink);
  font-family: var(--nr-serif);
  font-size: 26px;
  font-weight: 600;
  line-height: 1.28;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nr-featured-author {
  color: var(--nr-soft);
  font-size: 11.5px;
}

.nr-featured-desc {
  display: -webkit-box;
  max-width: 620px;
  margin-top: 6px;
  color: var(--nr-soft);
  font-size: 11px;
  line-height: 1.7;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.nr-featured-footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 13px;
  margin-top: 12px;
}

.nr-featured-cta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 11px;
  border-radius: 7px;
  background: var(--nr-accent);
  color: var(--nr-accent-ink);
  font-size: 11px;
  font-weight: 600;
}

.nr-featured-cta .nr-icon {
  width: 13px;
  height: 13px;
}

.nr-featured-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--nr-faint);
  font-size: 10px;
}

.nr-featured-aside {
  display: none;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  min-width: 148px;
  padding-left: 28px;
  border-left: 1px solid var(--nr-line);
}

.nr-featured-stat {
  display: flex;
  align-items: baseline;
  gap: 5px;
  color: var(--nr-ink);
}

.nr-featured-stat strong {
  font-family: var(--nr-serif);
  font-size: 34px;
  line-height: 1;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.nr-featured-stat small {
  color: var(--nr-soft);
  font-size: 10px;
}

.nr-featured-aside-note {
  color: var(--nr-faint);
  font-size: 9px;
}

.nr-featured-delete {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  opacity: 0;
  background: var(--nr-raised);
}

.nr-featured:hover .nr-featured-delete,
.nr-featured:focus-within .nr-featured-delete {
  opacity: 1;
}

.nr-featured-confirm {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-top: 1px solid var(--nr-line);
  background: var(--nr-danger-wash);
  color: var(--nr-soft);
  font-size: 11px;
}

.nr-featured-confirm span {
  flex: 1;
  min-width: 0;
}

.nr-featured.just-added {
  animation: nr-feature-arrive 520ms ease-out;
}

@keyframes nr-feature-arrive {
  from { border-color: var(--nr-accent); }
  to { border-color: var(--nr-line); }
}

.nr-other-books {
  width: 100%;
}

.nr-shelf-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 0 0 8px;
  border-bottom: 1px solid var(--nr-line);
}

.nr-shelf-section-head h2 {
  margin: 0;
  font-family: var(--nr-serif);
  font-size: 15px;
  font-weight: 600;
}

.nr-shelf-section-head span {
  color: var(--nr-faint);
  font-size: 10px;
}

.nr-shelf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
  align-items: start;
  gap: 24px 16px;
  width: 100%;
  padding: 0;
  margin: 0;
  list-style: none;
}

.nr-shelf-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  aspect-ratio: 1 / 1.618;
  padding: 8px;
  overflow: hidden;
  border: 1px solid var(--nr-line);
  border-radius: 10px;
  background: var(--nr-surface);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.025);
  transition: border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease;
}

.nr-shelf-card:hover,
.nr-shelf-card:focus-within {
  border-color: var(--nr-line-strong);
  background: color-mix(in srgb, var(--nr-surface) 82%, var(--nr-accent) 5%);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.07);
}

.nr-shelf-card-open {
  appearance: none;
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.nr-shelf-card-open:disabled {
  opacity: 0.6;
  cursor: default;
}

.nr-shelf-cover {
  position: relative;
  display: block;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.nr-shelf-card .nr-cover-card {
  width: 100%;
  height: 100%;
  border-left-width: 3px;
  border-radius: 3px 6px 6px 3px;
  box-shadow: 0 7px 18px rgba(0, 0, 0, 0.13), 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.nr-shelf-card .nr-cover-card img {
  object-position: top center;
}

.nr-shelf-card-open:hover .nr-cover-card,
.nr-shelf-card-open:focus-visible .nr-cover-card {
  transform: translateY(-3px);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.2), 0 3px 8px rgba(0, 0, 0, 0.08);
}

.nr-shelf-card .nr-cover-card .nr-cover-glyph {
  font-size: 34px;
}

.nr-card-badge {
  position: absolute;
  left: 7px;
  bottom: 7px;
  z-index: 2;
  padding: 2px 5px;
  border-radius: 999px;
  background: rgba(18, 20, 20, 0.72);
  color: #fff;
  font-size: 7.5px;
  line-height: 1.2;
  letter-spacing: 0.03em;
  pointer-events: none;
  backdrop-filter: blur(5px);
}

.nr-shelf-card-copy {
  display: block;
  flex: none;
  padding: 7px 2px 0;
}

.nr-shelf-card-title {
  display: block;
  min-height: 1.35em;
  color: var(--nr-ink);
  font-family: var(--nr-serif);
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 120ms ease;
}

.nr-shelf-card-open:hover .nr-shelf-card-title {
  color: var(--nr-accent);
}

.nr-shelf-card-author {
  display: block;
  margin-top: 2px;
  color: var(--nr-soft);
  font-size: 9.5px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nr-shelf-card-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
  color: var(--nr-faint);
  font-size: 8.5px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
}

.nr-shelf-card-meta > span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nr-card-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 3;
  width: 22px;
  height: 22px;
  background: var(--nr-raised);
  box-shadow: 0 2px 7px rgba(0, 0, 0, 0.15);
}

.nr-shelf-card:hover .nr-card-delete,
.nr-shelf-card:focus-within .nr-card-delete {
  opacity: 1;
}

.nr-card-confirm {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--nr-line);
  border-radius: 10px;
  background: var(--nr-raised);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.16);
  color: var(--nr-soft);
  font-size: 10.5px;
  line-height: 1.5;
  text-align: center;
}

.nr-card-confirm > div {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nr-shelf-card.just-added {
  animation: nr-card-arrive 460ms ease-out;
}

@keyframes nr-card-arrive {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.nr-book-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.nr-book-item {
  position: relative;
  border-bottom: 1px solid var(--nr-line);
}

.nr-book-item:last-child {
  border-bottom: 0;
}

.nr-book-row {
  display: flex;
  align-items: stretch;
  min-height: 88px;
  background: transparent;
  transition: background-color 120ms ease;
}

.nr-book-row:hover,
.nr-book-row:focus-within {
  background: var(--nr-accent-wash);
}

.nr-book-open {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  padding: 13px 6px 13px 16px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.nr-book-open:disabled {
  cursor: default;
}

.nr-cover {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
  width: 48px;
  height: 68px;
  overflow: hidden;
  border-radius: 2px 4px 4px 2px;
  border-left: 3px solid var(--nr-spine, var(--nr-accent));
  background: var(--nr-surface);
  color: var(--nr-soft);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.nr-cover::after {
  content: "";
  position: absolute;
  inset: 0;
  box-shadow: inset 3px 0 0 rgba(255, 255, 255, 0.16), inset -1px 0 0 rgba(0, 0, 0, 0.08);
  pointer-events: none;
}

.nr-cover img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.nr-cover-glyph {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--nr-serif);
  font-size: 21px;
  font-weight: 600;
  opacity: 0.72;
  pointer-events: none;
}

.nr-book-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.nr-book-title {
  font-family: var(--nr-serif);
  font-size: 15px;
  line-height: 1.4;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nr-book-author {
  color: var(--nr-soft);
  font-size: 11.5px;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nr-book-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  color: var(--nr-faint);
  font-size: 10.5px;
  line-height: 1.4;
}

.nr-resume {
  color: var(--nr-accent);
  font-weight: 600;
}

.nr-status-sep {
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: currentColor;
}

.nr-book-tail {
  display: flex;
  align-items: center;
  padding-right: 8px;
}

.nr-row-action {
  appearance: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--nr-faint);
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms ease, color 120ms ease, background-color 120ms ease;
}

.nr-book-row:hover .nr-row-action,
.nr-book-row:focus-within .nr-row-action {
  opacity: 1;
}

.nr-row-action:hover {
  color: var(--nr-danger);
  background: var(--nr-danger-wash);
}

.nr-delete-confirm {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px 10px 16px;
  background: var(--nr-danger-wash);
  color: var(--nr-soft);
  font-size: 11px;
}

.nr-delete-confirm span {
  flex: 1;
}

.nr-mini-button {
  appearance: none;
  height: 25px;
  padding: 0 9px;
  border: 1px solid var(--nr-line-strong);
  border-radius: 5px;
  background: transparent;
  color: var(--nr-ink);
  cursor: pointer;
  font-size: 11px;
}

.nr-mini-button.danger {
  border-color: transparent;
  background: var(--nr-danger);
  color: #fff;
}

.nr-book-item.just-added {
  animation: nr-arrive 420ms ease-out;
}

@keyframes nr-arrive {
  from { background: var(--nr-accent-wash); }
  to { background: transparent; }
}

.nr-searchbar {
  min-height: 64px;
  padding: 10px 14px;
  gap: 14px;
}

.nr-searchbar-heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.nr-searchbar-title {
  margin: 0;
  font-family: var(--nr-serif);
  font-size: 18px;
  line-height: 1.3;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nr-searchbar-sub {
  color: var(--nr-faint);
  font-size: 10.5px;
  line-height: 1.4;
  white-space: nowrap;
}

.nr-topbar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 320px;
  max-width: 560px;
  height: 40px;
  min-width: 0;
  margin-left: auto;
  padding: 3px 4px 3px 12px;
  border: 1px solid var(--nr-line-strong);
  border-radius: 9px;
  background: var(--nr-paper);
  transition: border-color 140ms ease, box-shadow 140ms ease;
}

.nr-topbar-search:focus-within {
  border-color: var(--nr-accent);
  box-shadow: 0 0 0 3px var(--nr-accent-wash);
}

.nr-topbar-search > .nr-icon {
  flex: none;
  width: 16px;
  height: 16px;
  color: var(--nr-faint);
}

.nr-field-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 38px;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--nr-ink);
  font-size: 13.5px;
}

.nr-field-input::placeholder {
  color: var(--nr-faint);
}

.nr-root .nr-field-input:focus-visible {
  outline: none;
}

.nr-topbar-search .nr-field-input {
  height: 32px;
  font-size: 12.5px;
}

.nr-topbar-search .nr-primary {
  flex: none;
  height: 32px;
  padding: 0 14px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
}

.nr-page {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 24px 16px 56px;
}

.nr-page-inner {
  width: 100%;
  max-width: 1640px;
  margin: 0 auto;
}

.nr-page-add .nr-page-inner {
  max-width: 1120px;
}

.nr-page-idle .nr-page-inner {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100%;
}

.nr-page-idle .nr-search-landing,
.nr-page-idle .nr-add-landing {
  width: 100%;
}

.nr-add-landing {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 36px 40px;
  border: 1px solid var(--nr-line);
  border-radius: 16px;
  background: var(--nr-raised);
}

.nr-search-landing {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  align-items: start;
  gap: 56px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 36px 40px;
  border: 1px solid var(--nr-line);
  border-radius: 16px;
  background: var(--nr-raised);
}

.nr-search-main {
  min-width: 0;
}

.nr-search-main-top {
  max-width: 640px;
}

.nr-suggestions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px 15px;
  margin: 16px 0 0;
  color: var(--nr-faint);
  font-size: 11px;
  line-height: 1.6;
}

.nr-suggestion {
  appearance: none;
  margin: 0;
  padding: 0 0 2px;
  border: 0;
  border-bottom: 1px solid var(--nr-line-strong);
  border-radius: 0;
  background: transparent;
  color: var(--nr-soft);
  cursor: pointer;
  font-size: 12px;
  line-height: 1.5;
}

.nr-suggestion:hover:not(:disabled),
.nr-suggestion:focus-visible {
  border-color: var(--nr-accent);
  color: var(--nr-accent);
}

.nr-suggestion:disabled {
  opacity: 0.5;
  cursor: default;
}

.nr-search-recent {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--nr-line);
}

.nr-recent-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.nr-recent-head h2 {
  margin: 0;
  font-family: var(--nr-serif);
  font-size: 19px;
  font-weight: 600;
  line-height: 1.3;
}

.nr-recent-all {
  appearance: none;
  padding: 0 0 2px;
  border: 0;
  border-bottom: 1px solid var(--nr-line-strong);
  background: transparent;
  color: var(--nr-soft);
  cursor: pointer;
  font-size: 11.5px;
}

.nr-recent-all:hover {
  border-color: var(--nr-accent);
  color: var(--nr-accent);
}

.nr-recent-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.nr-recent-book {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--nr-line);
  border-radius: 11px;
  background: var(--nr-paper);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 140ms ease, background-color 140ms ease;
}

.nr-recent-book:hover:not(:disabled) {
  border-color: var(--nr-accent);
  background: color-mix(in srgb, var(--nr-accent) 5%, var(--nr-paper));
}

.nr-recent-book:disabled {
  opacity: 0.55;
  cursor: default;
}

.nr-recent-book .nr-cover {
  flex: none;
  width: 44px;
  height: 62px;
  border-radius: 3px;
}

.nr-recent-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.nr-recent-title {
  color: var(--nr-ink);
  font-family: var(--nr-serif);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nr-recent-author {
  color: var(--nr-soft);
  font-size: 10.5px;
}

.nr-recent-progress {
  margin-top: 2px;
  color: var(--nr-accent);
  font-size: 9.5px;
  letter-spacing: 0.03em;
}

.nr-catalog {
  min-width: 0;
  padding-left: 30px;
  border-left: 1px solid var(--nr-line);
}

.nr-catalog-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--nr-line);
  color: var(--nr-faint);
  font-size: 10.5px;
  letter-spacing: 0.06em;
}

.nr-source-list {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.nr-source-list li {
  padding: 10px 0;
  border-bottom: 1px solid var(--nr-line);
  color: var(--nr-soft);
  font-size: 12px;
  line-height: 1.45;
}

.nr-source-list li:last-child {
  border-bottom: 0;
}

.nr-catalog-note {
  margin: 16px 0 0;
  padding-top: 16px;
  border-top: 1px solid var(--nr-line);
  color: var(--nr-faint);
  font-size: 10.5px;
  line-height: 1.65;
}

.nr-add-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
  margin: 26px 0 0;
  padding: 24px 0 0;
  border-top: 1px solid var(--nr-line);
  list-style: none;
}

.nr-add-step {
  display: flex;
  gap: 12px;
  min-width: 0;
}

.nr-add-step-index {
  flex: none;
  padding-top: 1px;
  color: var(--nr-accent);
  font-family: var(--nr-serif);
  font-size: 13px;
  line-height: 1.4;
}

.nr-add-step strong {
  display: block;
  color: var(--nr-ink);
  font-size: 12.5px;
  font-weight: 600;
}

.nr-add-step span {
  display: block;
  margin-top: 4px;
  color: var(--nr-faint);
  font-size: 11.5px;
  line-height: 1.65;
}

.nr-parse-status {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 24px;
  padding: 0 2px;
  color: var(--nr-soft);
  font-size: 12px;
}

.nr-input {
  width: 100%;
  height: 38px;
  min-width: 0;
  padding: 0 11px;
  border: 1px solid var(--nr-line-strong);
  border-radius: 7px;
  outline: none;
  background: transparent;
  color: var(--nr-ink);
  font-size: 12px;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.nr-input::placeholder {
  color: var(--nr-faint);
}

.nr-input:focus {
  border-color: var(--nr-accent);
  box-shadow: 0 0 0 3px var(--nr-accent-wash);
}

.nr-editions {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid var(--nr-line);
}

.nr-editions-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.nr-editions-head h2 {
  margin: 0;
  font-family: var(--nr-serif);
  font-size: 16px;
  font-weight: 600;
}

.nr-editions-head span {
  color: var(--nr-faint);
  font-size: 10.5px;
}

.nr-editions-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: var(--nr-faint);
  font-size: 11px;
}

.nr-edition-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}

.nr-edition {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--nr-line);
  border-radius: 8px;
  background: var(--nr-raised);
}

.nr-edition + .nr-edition {
  margin-top: 6px;
}

.nr-edition.active {
  border-color: var(--nr-accent);
  background: var(--nr-accent-wash);
}

.nr-edition-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.nr-edition-source {
  color: var(--nr-ink);
  font-size: 11.5px;
  font-weight: 600;
}

.nr-edition-update {
  color: var(--nr-soft);
  font-size: 10.5px;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nr-edition-update.error {
  color: var(--nr-danger);
}

.nr-edition-side {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.nr-edition-count {
  color: var(--nr-faint);
  font-size: 10px;
  white-space: nowrap;
}

.nr-edition-use {
  appearance: none;
  height: 26px;
  padding: 0 9px;
  border: 1px solid var(--nr-line-strong);
  border-radius: 5px;
  background: transparent;
  color: var(--nr-soft);
  cursor: pointer;
  font-size: 10px;
}

.nr-edition-use:hover {
  border-color: var(--nr-accent);
  color: var(--nr-accent);
}

.nr-edition-current {
  color: var(--nr-accent);
  font-size: 9.5px;
  white-space: nowrap;
}

.nr-search-status {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 26px;
  padding: 0 2px;
  color: var(--nr-soft);
  font-size: 12px;
}

.nr-search-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-top: 28px;
  padding: 28px 22px;
  border: 1px dashed var(--nr-line-strong);
  border-radius: 14px;
  background: var(--nr-raised);
  color: var(--nr-faint);
  font-size: 12px;
  line-height: 1.65;
}

.nr-search-empty strong {
  color: var(--nr-ink);
  font-family: var(--nr-serif);
  font-size: 19px;
  font-weight: 600;
  line-height: 1.35;
}

.nr-search-empty .nr-secondary {
  height: 32px;
  margin-top: 4px;
  padding: 0 12px;
  font-size: 11.5px;
}

.nr-search-section {
  margin-top: 34px;
}

.nr-search-count {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0;
  color: var(--nr-ink);
  font-family: var(--nr-serif);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
}

.nr-search-count::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--nr-line);
}

.nr-search-results {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 16px;
}

.nr-search-card {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 13px;
  width: 100%;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--nr-line);
  border-radius: 11px;
  background: var(--nr-raised);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 140ms ease, background-color 140ms ease;
}

.nr-search-card:hover:not(:disabled) {
  border-color: var(--nr-accent);
  background: color-mix(in srgb, var(--nr-accent) 5%, var(--nr-raised));
}

.nr-search-card:disabled {
  opacity: 0.55;
  cursor: default;
}

.nr-search-card .nr-cover {
  flex: none;
  width: 50px;
  height: 70px;
  border-radius: 3px;
}

.nr-search-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.nr-search-title {
  color: var(--nr-ink);
  font-family: var(--nr-serif);
  font-size: 16px;
  line-height: 1.35;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nr-search-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.nr-search-author {
  color: var(--nr-soft);
  font-size: 11px;
}

.nr-search-source {
  flex: none;
  color: var(--nr-accent);
  font-size: 9.5px;
  line-height: 16px;
  letter-spacing: 0.04em;
}

.nr-search-intro {
  display: -webkit-box;
  margin-top: 2px;
  color: var(--nr-faint);
  font-size: 11px;
  line-height: 1.55;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.nr-search-go {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 28px;
  height: 28px;
  border: 1px solid var(--nr-line);
  border-radius: 50%;
  color: var(--nr-faint);
  transition: border-color 140ms ease, color 140ms ease, background-color 140ms ease;
}

.nr-search-card:hover:not(:disabled) .nr-search-go {
  border-color: var(--nr-accent);
  background: var(--nr-accent-wash);
  color: var(--nr-accent);
}

.nr-search-go .nr-icon {
  width: 13px;
  height: 13px;
}

.nr-preview {
  margin-top: 30px;
  padding: 20px;
  border: 1px solid var(--nr-line);
  border-radius: 14px;
  background: var(--nr-raised);
}

.nr-preview-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.nr-preview .nr-cover {
  flex: none;
  width: 70px;
  height: 98px;
  border-radius: 3px;
}

.nr-preview-meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  flex: 1;
}

.nr-preview-title {
  font-family: var(--nr-serif);
  font-size: 23px;
  line-height: 1.25;
  font-weight: 600;
}

.nr-preview-author {
  color: var(--nr-soft);
  font-size: 11.5px;
}

.nr-confidence {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
  color: var(--nr-faint);
  font-size: 10.5px;
}

.nr-confidence::before {
  content: "";
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--nr-success);
}

.nr-confidence.low::before {
  background: var(--dsw-alias-state-warn-primary, #b7791f);
}

.nr-description {
  margin: 16px 0 0;
  color: var(--nr-soft);
  font-size: 12.5px;
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.nr-sample {
  position: relative;
  max-height: 300px;
  margin: 18px 0 0;
  padding: 14px 16px;
  overflow: auto;
  border-left: 2px solid var(--nr-accent);
  border-radius: 0 8px 8px 0;
  background: var(--nr-surface);
  color: var(--nr-ink);
  font-family: var(--nr-serif);
  font-size: 13px;
  line-height: 1.85;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  scrollbar-width: thin;
  scrollbar-color: var(--nr-line-strong) transparent;
}

.nr-preview-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
}

.nr-preview-actions .nr-primary {
  flex: 0 0 auto;
  min-width: 160px;
  height: 40px;
  padding: 0 18px;
}

.nr-note {
  margin: 12px 0 0;
  color: var(--nr-faint);
  font-size: 10.5px;
  line-height: 1.55;
}

.nr-page-settings .nr-page-inner {
  max-width: 880px;
}

.nr-settings-page {
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
}

.nr-settings-intro {
  padding: 8px 0 22px;
}

.nr-settings-title {
  margin: 0;
  font-family: var(--nr-serif);
  font-size: 30px;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.nr-settings-deck {
  max-width: 620px;
  margin: 9px 0 0;
  color: var(--nr-soft);
  font-size: 12.5px;
  line-height: 1.75;
}

.nr-settings-card {
  margin-top: 20px;
  padding: 0 20px 6px;
  border: 1px solid var(--nr-line);
  border-radius: 14px;
  background: var(--nr-raised);
}

.nr-settings-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 15px 0 12px;
  border-bottom: 1px solid var(--nr-line);
}

.nr-settings-card-head h2 {
  margin: 0;
  font-family: var(--nr-serif);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
}

.nr-settings-card-head span {
  color: var(--nr-faint);
  font-size: 10.5px;
  white-space: nowrap;
}

.nr-settings-source-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.nr-settings-source {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 0;
  border-bottom: 1px solid var(--nr-line);
}

.nr-settings-source:last-child {
  border-bottom: 0;
}

.nr-settings-source-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.nr-settings-source-copy strong {
  color: var(--nr-ink);
  font-size: 13px;
  font-weight: 600;
}

.nr-settings-source-copy span {
  color: var(--nr-faint);
  font-size: 11px;
  line-height: 1.5;
}

.nr-switch {
  appearance: none;
  flex: none;
  width: 42px;
  height: 24px;
  padding: 2px;
  border: 1px solid var(--nr-line-strong);
  border-radius: 12px;
  background: var(--nr-surface);
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease;
}

.nr-switch-thumb {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--nr-faint);
  transition: transform 140ms ease, background-color 140ms ease;
}

.nr-switch.on {
  border-color: var(--nr-accent);
  background: var(--nr-accent);
}

.nr-switch.on .nr-switch-thumb {
  background: var(--nr-accent-ink);
  transform: translateX(18px);
}

.nr-switch:disabled {
  opacity: 0.45;
  cursor: default;
}

.nr-settings-note {
  margin: 14px 0 8px;
  color: var(--nr-faint);
  font-size: 11.5px;
  line-height: 1.65;
}

.nr-settings-error {
  margin: 14px 0 8px;
  color: var(--nr-danger);
  font-size: 11.5px;
  line-height: 1.6;
}

.nr-source-empty {
  color: var(--nr-faint);
  font-size: 12px;
}

.nr-reader {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  background: var(--nr-paper);
}

.nr-reader-topbar {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  padding: 9px 10px 8px 8px;
  border-bottom: 1px solid var(--nr-line);
}

.nr-reader-heading {
  min-width: 0;
  flex: 1;
}

.nr-reader-book {
  font-family: var(--nr-serif);
  font-size: 13.5px;
  line-height: 1.35;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nr-reader-progress-label {
  margin-top: 2px;
  color: var(--nr-faint);
  font-size: 9.5px;
  line-height: 1.3;
  letter-spacing: 0.02em;
}

.nr-progress-track {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
  background: transparent;
}

.nr-progress-fill {
  display: block;
  height: 100%;
  background: var(--nr-accent);
  transition: width 200ms ease;
}

.nr-reader-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 27px 18px 26px;
  color: var(--nr-ink);
  font-family: var(--nr-serif);
  font-size: 17px;
  line-height: var(--nr-leading);
  overscroll-behavior: contain;
}

.nr-article {
  max-width: 680px;
  margin: 0 auto;
}

.nr-chapter-position {
  margin: 0 0 8px;
  color: var(--nr-faint);
  font-family: var(--nr-sans);
  font-size: 10px;
  line-height: 1.4;
  letter-spacing: 0.02em;
}

.nr-chapter-title {
  margin: 0 0 22px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--nr-line);
  font-size: 1.2em;
  line-height: 1.55;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.nr-prose p {
  margin: 0 0 0.62em;
  text-align: justify;
  text-indent: 2em;
  overflow-wrap: break-word;
  hanging-punctuation: allow-end;
}

.nr-prose p:last-child {
  margin-bottom: 0;
}

.nr-loading {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 11px;
  color: var(--nr-soft);
  font-family: var(--nr-sans);
  font-size: 11.5px;
}

.nr-spinner {
  width: 15px;
  height: 15px;
  border: 1.5px solid var(--nr-line-strong);
  border-top-color: var(--nr-accent);
  border-radius: 50%;
  animation: nr-spin 720ms linear infinite;
}

@keyframes nr-spin {
  to { transform: rotate(360deg); }
}

.nr-reader-error {
  max-width: 420px;
  margin: 40px auto;
  padding: 18px;
  border: 1px solid var(--nr-line);
  background: var(--nr-surface);
  color: var(--nr-soft);
  font-family: var(--nr-sans);
  font-size: 12px;
  line-height: 1.65;
  text-align: center;
}

.nr-reader-error p {
  margin: 0 0 12px;
}

.nr-reader-error .nr-primary {
  height: 32px;
}

.nr-reader-nav {
  flex: none;
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 7px 8px 8px;
  border-top: 1px solid var(--nr-line);
}

.nr-nav-button {
  appearance: none;
  min-width: 0;
  flex: 1;
  height: 33px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--nr-soft);
  cursor: pointer;
  font-size: 11px;
}

.nr-nav-button:hover:not(:disabled) {
  color: var(--nr-ink);
  background: var(--nr-surface);
}

.nr-nav-button:disabled {
  opacity: 0.3;
  cursor: default;
}

.nr-nav-button .nr-icon {
  width: 14px;
  height: 14px;
}

.nr-settings {
  position: absolute;
  z-index: 6;
  top: 52px;
  right: 9px;
  width: min(338px, calc(100% - 18px));
  border: 1px solid var(--nr-line);
  border-radius: 14px;
  background: var(--nr-raised);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2), 0 4px 14px rgba(0, 0, 0, 0.07);
  color: var(--nr-ink);
  font-family: var(--nr-sans);
  overflow: hidden;
  animation: nr-settings-in 160ms ease-out;
}

@keyframes nr-settings-in {
  from { opacity: 0; transform: translateY(-4px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.nr-settings-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 15px 13px 12px 17px;
  border-bottom: 1px solid var(--nr-line);
}

.nr-settings-head strong {
  display: block;
  font-family: var(--nr-serif);
  font-size: 16px;
  line-height: 1.35;
  font-weight: 600;
}

.nr-settings-head span {
  display: block;
  margin-top: 2px;
  color: var(--nr-faint);
  font-size: 9.5px;
}

.nr-settings-head .nr-icon-button {
  width: 26px;
  height: 26px;
  margin-top: -2px;
}

.nr-settings-preview {
  display: flex;
  align-items: center;
  min-height: 62px;
  margin: 13px 16px 0;
  padding: 12px 15px;
  border-left: 2px solid var(--nr-accent);
  background: var(--nr-surface);
  color: var(--nr-ink);
  font-family: var(--nr-serif);
  line-height: var(--nr-leading);
  letter-spacing: 0.01em;
}

.nr-settings-section {
  padding: 14px 16px 0;
}

.nr-settings-section + .nr-settings-section {
  margin-top: 14px;
  padding-top: 13px;
  border-top: 1px solid var(--nr-line);
}

.nr-settings-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
  color: var(--nr-soft);
  font-size: 11.5px;
  font-weight: 600;
}

.nr-settings-value {
  color: var(--nr-accent);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.nr-font-control {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 28px;
}

.nr-font-a {
  color: var(--nr-faint);
  font-family: var(--nr-serif);
  font-size: 12px;
  line-height: 1;
}

.nr-font-a.large {
  font-size: 18px;
}

.nr-range {
  flex: 1;
  min-width: 0;
  height: 18px;
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
}

.nr-range::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 999px;
  background: var(--nr-line-strong);
}

.nr-range::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
  margin-top: -5.5px;
  border: 2px solid var(--nr-raised);
  border-radius: 50%;
  background: var(--nr-accent);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22);
  -webkit-appearance: none;
}

.nr-range:focus-visible {
  outline: 2px solid var(--nr-accent);
  outline-offset: 2px;
  border-radius: 4px;
}

.nr-line-options {
  display: flex;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--nr-line);
  border-radius: 8px;
  background: var(--nr-surface);
}

.nr-line-option {
  appearance: none;
  flex: 1;
  height: 27px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--nr-faint);
  cursor: pointer;
  font-size: 10.5px;
}

.nr-line-option:hover {
  color: var(--nr-ink);
}

.nr-line-option[aria-pressed="true"] {
  background: var(--nr-raised);
  color: var(--nr-ink);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.nr-theme-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 7px;
}

.nr-theme-choice {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--nr-line);
  border-radius: 8px;
  background: transparent;
  color: var(--nr-soft);
  cursor: pointer;
  text-align: left;
}

.nr-theme-choice:hover {
  border-color: var(--nr-line-strong);
  background: var(--nr-surface);
}

.nr-theme-choice[aria-pressed="true"] {
  border-color: var(--nr-accent);
  background: var(--nr-accent-wash);
  color: var(--nr-ink);
}

.nr-swatch {
  position: relative;
  flex: none;
  width: 28px;
  height: 34px;
  border: 1px solid var(--nr-line-strong);
  border-radius: 3px;
}

.nr-swatch::after {
  content: "";
  position: absolute;
  top: 11px;
  right: 6px;
  left: 6px;
  height: 1px;
  background: currentColor;
  opacity: 0.28;
  box-shadow: 0 5px 0 currentColor, 0 10px 0 currentColor;
}

.nr-swatch-auto { background: linear-gradient(135deg, #ffffff 0 50%, #202222 50% 100%); color: #ffffff; }
.nr-swatch-light { background: #fbfaf6; color: #252521; }
.nr-swatch-sepia { background: #f2e9d7; color: #3a3025; }
.nr-swatch-dark { background: #191b1b; color: #e3e0d9; }

.nr-theme-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  font-size: 11px;
  line-height: 1.35;
}

.nr-theme-copy small {
  color: var(--nr-faint);
  font-size: 9.5px;
}

.nr-settings-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 15px;
  padding: 11px 16px 12px;
  border-top: 1px solid var(--nr-line);
}

.nr-reset {
  appearance: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--nr-accent);
  cursor: pointer;
  font-size: 10px;
}

.nr-reset:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.nr-settings-foot span {
  color: var(--nr-faint);
  font-size: 9px;
}

.nr-toc {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: flex;
  flex-direction: column;
  background: var(--nr-raised);
  animation: nr-reveal 150ms ease-out;
}

@keyframes nr-reveal {
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: translateY(0); }
}

.nr-toc-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 52px;
  padding: 9px 10px 8px 14px;
  border-bottom: 1px solid var(--nr-line);
}

.nr-toc-heading {
  flex: 1;
  min-width: 0;
}

.nr-toc-heading strong {
  display: block;
  font-family: var(--nr-serif);
  font-size: 15px;
  font-weight: 600;
}

.nr-toc-heading span {
  display: block;
  margin-top: 1px;
  color: var(--nr-faint);
  font-size: 9.5px;
}

.nr-toc-search {
  flex: none;
  padding: 9px 12px;
  border-bottom: 1px solid var(--nr-line);
}

.nr-toc-search .nr-input {
  height: 31px;
  padding-left: 29px;
  font-size: 11px;
}

.nr-search-wrap {
  position: relative;
}

.nr-search-wrap .nr-icon {
  position: absolute;
  top: 8px;
  left: 9px;
  width: 14px;
  height: 14px;
  color: var(--nr-faint);
  pointer-events: none;
}

.nr-toc-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 4px 0 18px;
}

.nr-toc-row {
  appearance: none;
  display: flex;
  align-items: baseline;
  gap: 9px;
  width: 100%;
  padding: 8px 14px 8px 12px;
  border: 0;
  border-left: 2px solid transparent;
  background: transparent;
  color: var(--nr-soft);
  cursor: pointer;
  text-align: left;
  font-size: 11.5px;
  line-height: 1.5;
}

.nr-toc-row:hover {
  color: var(--nr-ink);
  background: var(--nr-surface);
}

.nr-toc-row.active {
  border-left-color: var(--nr-accent);
  background: var(--nr-accent-wash);
  color: var(--nr-ink);
  font-weight: 600;
}

.nr-toc-index {
  flex: none;
  width: 23px;
  color: var(--nr-faint);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.nr-toc-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nr-toc-empty {
  padding: 30px 20px;
  color: var(--nr-faint);
  font-size: 11px;
  text-align: center;
}

@container (min-width: 680px) {
  .nr-shelf-head {
    min-height: 48px;
    padding: 8px 44px;
    align-items: center;
  }

  .nr-display {
    font-size: 27px;
  }

  .nr-subtitle {
    margin-top: 3px;
    font-size: 11px;
  }

  .nr-add {
    height: 32px;
    margin-top: 0;
    padding: 0 14px 0 11px;
  }

  .nr-body {
    padding: 20px 44px 64px;
  }

  .nr-shelf-grid {
    grid-template-columns: repeat(auto-fill, minmax(144px, 1fr));
    gap: 28px 18px;
  }

  .nr-shelf-stage {
    width: 100%;
    max-width: 1220px;
    margin: 0 auto;
    gap: 34px;
  }

  .nr-featured-aside {
    display: flex;
  }

  .nr-featured {
    width: 100%;
    max-width: 1000px;
    margin: 0 auto;
    border-radius: 18px;
  }

  .nr-featured-open {
    gap: 32px;
    padding: 30px 34px;
  }

  .nr-featured .nr-cover-featured {
    width: 148px;
    height: 206px;
    border-left-width: 5px;
    border-radius: 4px 9px 9px 4px;
    box-shadow: 0 20px 44px rgba(0, 0, 0, 0.19), 0 3px 8px rgba(0, 0, 0, 0.08);
  }

  .nr-featured .nr-cover-featured .nr-cover-glyph {
    font-size: 44px;
  }

  .nr-featured-body {
    gap: 5px;
    padding: 3px 46px 3px 0;
  }

  .nr-featured-kicker {
    font-size: 10.5px;
    letter-spacing: 0.08em;
  }

  .nr-featured-title {
    margin-top: 3px;
    font-size: 36px;
    line-height: 1.18;
    letter-spacing: 0.015em;
  }

  .nr-featured-author {
    font-size: 12.5px;
  }

  .nr-featured-desc {
    max-width: 660px;
    margin-top: 10px;
    font-size: 12px;
    line-height: 1.75;
    -webkit-line-clamp: 3;
  }

  .nr-featured-footer {
    margin-top: 20px;
    gap: 16px;
  }

  .nr-featured-cta {
    height: 36px;
    padding: 0 14px;
    border-radius: 8px;
    font-size: 12px;
  }

  .nr-featured-meta {
    font-size: 10.5px;
  }

  .nr-featured-delete {
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
  }

  .nr-shelf-section-head {
    padding-bottom: 10px;
  }

  .nr-shelf-section-head h2 {
    font-size: 16px;
  }

  .nr-book-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    column-gap: 30px;
  }

  .nr-book-item {
    border-bottom: 1px solid var(--nr-line);
  }

  .nr-book-row {
    min-height: 100px;
  }

  .nr-book-open {
    gap: 14px;
    padding: 16px 6px 16px 0;
  }

  .nr-cover {
    width: 56px;
    height: 80px;
  }

  .nr-book-title {
    font-size: 17px;
  }

  .nr-book-author {
    font-size: 12px;
  }

  .nr-book-status {
    font-size: 10.5px;
  }

  .nr-empty {
    min-height: calc(100vh - 210px);
    align-items: center;
    padding: 70px 60px 130px;
    text-align: center;
  }

  .nr-empty-copy {
    max-width: 410px;
    margin-left: auto;
    margin-right: auto;
  }

  .nr-searchbar {
    padding: 10px 44px;
  }

  .nr-searchbar-title {
    font-size: 20px;
  }

  .nr-searchbar-sub {
    font-size: 11px;
  }

  .nr-topbar-search {
    height: 42px;
  }

  .nr-topbar-search .nr-field-input {
    height: 34px;
    font-size: 13px;
  }

  .nr-topbar-search .nr-primary {
    height: 34px;
    padding: 0 16px;
    font-size: 12.5px;
  }

  .nr-page {
    padding: 34px 44px 90px;
  }

  .nr-add-landing {
    padding: 40px 44px;
  }

  .nr-search-landing {
    gap: 56px;
    padding: 40px 44px;
  }

  .nr-landing-title {
    font-size: 36px;
  }

  .nr-settings-title {
    font-size: 34px;
  }

  .nr-landing-deck {
    font-size: 13.5px;
  }

  .nr-add-steps {
    gap: 34px;
  }

  .nr-suggestions {
    margin-top: 18px;
    font-size: 11.5px;
  }

  .nr-search-results {
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 14px;
  }

  .nr-search-section {
    margin-top: 26px;
  }

  .nr-search-card {
    gap: 15px;
    padding: 14px;
  }

  .nr-preview {
    margin-top: 34px;
    padding: 24px;
  }

  .nr-preview .nr-cover {
    width: 112px;
    height: 158px;
  }

  .nr-preview-title {
    font-size: 26px;
  }

  .nr-preview-author {
    font-size: 12px;
  }

  .nr-description {
    margin-top: 18px;
    font-size: 13px;
  }

  .nr-sample {
    margin-top: 20px;
    padding: 16px 20px;
    font-size: 14px;
    line-height: 1.9;
  }

  .nr-preview-actions .nr-primary {
    min-width: 190px;
  }

  .nr-empty::after {
    right: 5%;
    bottom: -80px;
    font-size: 270px;
    opacity: 0.032;
  }

  .nr-error {
    width: calc(100% - 88px);
    max-width: 840px;
    margin: 14px auto 0;
  }

  .nr-reader-topbar {
    min-height: 56px;
    padding: 8px 24px 7px 18px;
  }

  .nr-reader-book {
    font-size: 14px;
  }

  .nr-reader-progress-label {
    font-size: 9.5px;
  }

  .nr-reader-scroll {
    padding: 48px 36px 64px;
  }

  .nr-article {
    max-width: 760px;
  }

  .nr-chapter-position {
    margin-bottom: 10px;
    font-size: 10.5px;
  }

  .nr-chapter-title {
    margin-bottom: 26px;
    padding-bottom: 18px;
    font-size: 1.35em;
  }

  .nr-reader-nav {
    padding: 10px max(26px, calc((100% - 760px) / 2)) 12px;
  }

  .nr-nav-button {
    height: 36px;
    font-size: 12px;
  }

  .nr-settings {
    top: 54px;
    right: 22px;
    width: 348px;
  }

  .nr-toc-head {
    min-height: 66px;
    padding: 12px 24px;
  }

  .nr-toc-search {
    padding: 12px max(26px, calc((100% - 760px) / 2));
  }

  .nr-toc-list {
    padding: 8px max(24px, calc((100% - 760px) / 2)) 40px;
  }

  .nr-toc-row {
    padding: 10px 16px;
    font-size: 13px;
  }

  .nr-toc-index {
    width: 28px;
    font-size: 9.5px;
  }
}

@container (min-width: 900px) {
  .nr-preview {
    display: grid;
    grid-template-columns: 236px minmax(0, 1fr);
    grid-template-areas:
      "head sample"
      "desc sample"
      "actions sample"
      "note sample";
    align-items: start;
    column-gap: 32px;
    row-gap: 16px;
  }

  .nr-preview-head {
    grid-area: head;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .nr-preview-meta {
    gap: 4px;
  }

  .nr-description {
    grid-area: desc;
    margin: 0;
  }

  .nr-sample {
    grid-area: sample;
    max-height: 380px;
    margin: 0;
    overflow: auto;
  }

  .nr-preview-actions {
    grid-area: actions;
    margin: 0;
  }

  .nr-note {
    grid-area: note;
    margin: 0;
  }
}

@container (max-width: 1099px) {
  .nr-featured-aside {
    display: none;
  }
}

@container (max-width: 679px) {
  .nr-featured-open {
    align-items: flex-start;
    gap: 14px;
    padding: 16px;
  }

  .nr-featured .nr-cover-featured {
    width: 78px;
    height: 106px;
  }

  .nr-featured-body {
    padding: 0 25px 0 0;
  }

  .nr-featured-title {
    font-size: 24px;
  }

  .nr-featured-desc {
    -webkit-line-clamp: 2;
  }

  .nr-featured-footer {
    margin-top: 11px;
  }
}

@container (max-width: 680px) {
  .nr-settings-title {
    font-size: 26px;
  }

  .nr-settings-card {
    padding: 0 16px 4px;
  }

  .nr-page-idle .nr-page-inner {
    display: block;
    min-height: 0;
  }

  .nr-search-landing,
  .nr-add-landing {
    min-height: 0;
    padding: 22px 18px;
  }

  .nr-searchbar {
    flex-wrap: wrap;
    gap: 9px;
    padding: 10px 14px 12px;
  }

  .nr-searchbar-heading {
    flex: 1;
  }

  .nr-topbar-search {
    flex: 1 1 100%;
    max-width: none;
    margin-left: 0;
  }

  .nr-search-landing {
    grid-template-columns: minmax(0, 1fr);
    gap: 22px;
  }

  .nr-catalog {
    padding: 20px 0 0;
    border-top: 1px solid var(--nr-line);
    border-left: 0;
  }

  .nr-add-steps {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}

@container (max-width: 310px) {
  .nr-shelf-grid {
    grid-template-columns: repeat(auto-fill, minmax(124px, 1fr));
    gap: 20px 12px;
  }

  .nr-topbar {
    padding-left: 12px;
    padding-right: 10px;
  }

  .nr-cover {
    width: 43px;
    height: 61px;
  }

  .nr-book-open {
    gap: 9px;
    padding-left: 12px;
  }

  .nr-book-title {
    font-size: 14px;
  }

  .nr-book-status {
    font-size: 9.5px;
  }

  .nr-reader-scroll {
    padding-left: 14px;
    padding-right: 14px;
  }

  .nr-reader-book {
    font-size: 12.5px;
  }

  .nr-theme-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (hover: none) {
  .nr-row-action {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nr-root *,
  .nr-root *::before,
  .nr-root *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`
