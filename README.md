# CatalystOS Blog Builder

Writes blog articles for a client from Brand Command, in the client's voice, with every outside claim sourced or flagged. Step 1 of the Blog Builder plan (writing first); publishing comes later.

- **Shared shell:** the four-bar CatalystOS header (catalyst-shell.js) with the client picker, the run-mode switch, Saved Files (`blogbuilder`) and the Campaign picker; Back to Main Dashboard; the leave guard; in-page dialogs (cos-dialog.js); glossary names (Save last and orange, navy Download with a format chooser, Approve All, Let CatalystOS Create This, I'll Make This Myself, Replace Image with Alt Text).
- **Home:** the shared types page (cos-types-window.js), "What Article Are You Writing?": the industry read only from Brand Command, Blank Article first, then the types recommended for the industry; All Types lists the 14 types in 4 categories. The editor's "Article Types ›" button opens the same page as a window.
- **Article types:** `lib/article-types.js`, the one module the brief, the writer and the home read (spec §3): purpose, audience, recommended sections, heading hierarchy, length, evidence, CTA strategy, visuals, SEO and compliance notes. Sections can be added, removed, reordered and made H2 or H3.
- **Ways to start:** from a topic (Mode A) or from the current campaign (Mode E: the campaign and its approved Campaign Strategy set the audience, message and CTA; the article is linked to the campaign). From your materials (Mode C) is shown as coming next.
- **Topic ideas:** under the Topic box on every start page, "Topic ideas for [campaign]": 4–6 ideas (working headline, angle for the article type, why it serves the campaign) from one quick request (Haiku) reading the campaign, its Campaign Strategy and piece plan, verified research, Brand Command pillars and personas, the approved company voice, and the client's saved and approved titles (no repeats). Click one to fill the Topic box (and Audience, when empty, with the idea's persona). More Ideas and Refresh. Cached per client + campaign + type. Figures only from cited verified facts; Company News, Product Announcement and Event Recap only from updates the campaign or Brand Command states, else a plain note. Both ways to start use the same list; no campaign: "Pick a campaign at the top to see topic ideas". `lib/topics.js`.
- **Editorial brief (spec §6):** the Strategist drafts it (working title, audience, objective, search intent, angle, key questions, relevant Brand Command content, verified research from the Campaign Strategy, suggested type, outline, CTA, compliance). The person edits and approves it, then the Senior Writer writes. Hands-off runs (`?cos_auto=1`, Run Campaign kind `blog-article`) approve it and proceed.
- **Writing:** the shared Senior Writer (`Brand.write`, format Blog / article: industry and specialty routing, claim checks, the editorial engine) in the type's shape. Outside facts only from the verified research, with attribution; a claim that needs a source is marked [Source needed] and flagged, never invented. Sources list only verified research links.
- **Editor:** an editable article preview in the client's Brand Command fonts and colors: featured image (Replace Image from Brand Command photos, Alt Text beside it), headline, dek, byline, introduction, sections and subsections, callouts and lists, conclusion, CTA, sources; SEO title, meta description, slug, excerpt and alt text in the right panel. CatalystOS Write / Rewrite on each text box.
- **Review:** Approve per section and Approve All (recorded, and approving teaches the Senior Writer); editing a section sends it back to review. The Review panel lists claims that need a source, the Senior Writer's claim check, and the shared production check (pilot-dash production-review/checks-editorial.js: placeholders, unsupported figures, links, headings, quotes, compliance screening for the client's industry).
- **Save:** the CatalystOS article model (pilot-dash publishing/article-model.js) with `templateId`, `brief` and `sectionMeta`, at `catalystos_clients/{client}/blogArticles/{id}`, and listed in Saved Files with its campaign. `?article=<id>` (the Saved Files link) opens it in the editor; `?type=<id>` opens a type's start page.
- **Download:** Web Page (HTML), Word (.doc), Markdown and Plain Text.
- **Publishing:** coming next (WordPress, HubSpot); the panel says so and nothing pretends to publish.

## Files
- `index.template.html` + `app.logic.js` → `index.html` (run `python3 tools/build.py` after editing either).
- `lib/article-types.js` — the 14 types, categories, recommendations, outlines and the shape text for the Writer.
- `lib/article.js` — the editor article, the article model conversion (both ways), the Writer's markdown parser, source flags, SEO defaults, downloads.
- `lib/topics.js` — topic ideas: the prompt, the checks (no invented figures, real news only, plain words, no repeats), what a click fills, the cache.
- `lib/data.js` — sign-in, Brand Command, campaigns, research (read only), the brief, writing, review checks, saving and Saved Files.
- `support.js` — the shared CatalystOS app runtime.

## Tests
- `node --test tests/*.test.mjs` — the article types, the save/open round trip through the article model, parsing, flags, downloads, and the builder header contract.
- `node tests/render.mjs [outDir]` — every screen with sign-in, Firestore and the AI stubbed (no network), at 1440 and 400 px, with axe WCAG 2.2 AA checks; also the deep links, I'll Make This Myself (no AI), Mode E and a hands-off run. See the file for the env vars.
