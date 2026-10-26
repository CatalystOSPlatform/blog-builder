// Blog Builder — the article types (Blog Builder spec §3). ONE module the writer, the brief and the home page read:
// there is no second template system. Each type follows the document library's flexible-composition pattern: a
// recommended list of sections (key, heading, level, required, what goes in it). The person or CatalystOS may add,
// remove and reorder sections; required ones are what the type needs to do its job (the production check flags them).
//
// Fields per type: purpose, audience, sections (recommended, in order), hierarchy (heading rules), words [min, max],
// evidence (what must be sourced), cta (strategy), visuals, seo, compliance, articleType (the article model's type),
// intent (default search intent), category (home page group), recommendedFor (taxonomy industry ids; '*' = everyone).
// Plain data and pure functions: works in the browser and in Node tests.

export const TYPES_VERSION = '1.0.0';

const S = (key, heading, what, o = {}) => ({ key, heading, what, level: o.level || 2, required: o.required !== false, ...(o.kind ? { kind: o.kind } : {}) });

export const CATEGORIES = [
  { id: 'expertise', label: 'Expertise and Point of View', about: 'Show what the firm knows and what it believes.', ink: '#4B12B8', tint: '#F1EAFE' },
  { id: 'teach', label: 'Teach and Answer', about: 'Help readers understand, decide or do something.', ink: '#1D4ED8', tint: '#E7EEFF' },
  { id: 'proof', label: 'Proof and News', about: 'Results, launches and what happened.', ink: '#B54708', tint: '#FEF0E1' },
  { id: 'series', label: 'Series', about: 'A planned run of connected articles.', ink: '#0F6E6E', tint: '#E3F4F2' },
];

export const ARTICLE_TYPES = [
  { id: 'thought-leadership', label: 'Thought Leadership', category: 'expertise', articleType: 'thought-leadership', intent: 'informational',
    purpose: 'Argue a clear, defensible point of view that shows how the firm thinks and why it matters now.',
    audience: 'Decision makers and peers who already know the basics and want a perspective worth sharing.',
    sections: [S('hook', 'The Situation', 'The tension or shift the reader recognizes, stated plainly.'), S('pov', 'Our Point of View', 'The claim, in one or two sentences, and why it is not the obvious view.'), S('why-now', 'Why It Matters Now', 'What changed and what it costs to ignore it.'), S('evidence', 'What Supports It', 'Reasons and evidence, each with its source; experience from Brand Command.'), S('objections', 'What Others Say', 'The strongest counter-argument, answered fairly.', { required: false }), S('implications', 'What to Do About It', 'Practical implications for the reader.'), S('close', 'The Bottom Line', 'Restate the view in a memorable line.')],
    hierarchy: 'One H1 (the headline); H2 for each step of the argument; H3 only inside long evidence sections.', words: [900, 1600],
    evidence: 'Every statistic, study or market claim needs a named source with a link; opinions are clearly the firm’s own. No invented quotes.',
    cta: 'Soft: invite a conversation or point to a deeper resource.', visuals: 'Featured image; one pull quote of the core claim; optional statistic callout with its source.',
    seo: 'Target a problem-level query; the point of view goes in the meta description; avoid clickbait.', compliance: 'Opinions labeled as opinions; forward-looking statements hedged; regulated firms add their required disclosures.',
    recommendedFor: ['*'] },
  { id: 'educational', label: 'Educational Article', category: 'teach', articleType: 'blog', intent: 'informational',
    purpose: 'Explain a topic the audience needs to understand, in plain language, so they can make better decisions.',
    audience: 'Readers new to the topic or looking for a clear refresher.',
    sections: [S('intro', 'Why This Matters', 'Who this is for and what they will understand by the end.'), S('basics', 'The Basics', 'Define the topic and the key terms.'), S('how', 'How It Works', 'The mechanism or process, step by step.'), S('mistakes', 'Common Misunderstandings', 'What people often get wrong and why.'), S('apply', 'What It Means for You', 'How the reader can use this.'), S('summary', 'Key Takeaways', 'Three to five short points.', { kind: 'list' })],
    hierarchy: 'One H1; H2 per concept; H3 for sub-points; key terms defined at first use.', words: [800, 1500],
    evidence: 'Rules, definitions and figures cite official or primary sources; the firm’s own explanations need no citation.',
    cta: 'Offer a related guide, checklist or conversation.', visuals: 'Featured image; a definition callout; optional simple diagram.',
    seo: 'Target “what is” and “how does” questions; answer the main question in the first 100 words.', compliance: 'Education, not individual advice: regulated firms say so.',
    recommendedFor: ['finance', 'healthcare', 'education', 'professional-services', 'nonprofit', 'government', 'energy'] },
  { id: 'how-to', label: 'How-To Guide', category: 'teach', articleType: 'how-to', intent: 'informational',
    purpose: 'Walk the reader through a task, step by step, so they can do it themselves.',
    audience: 'Practitioners who want to get something done.',
    sections: [S('intro', 'What You Will Do', 'The result and who this is for.'), S('before', 'Before You Start', 'What the reader needs: tools, time, prerequisites.', { kind: 'list' }), S('steps', 'Step by Step', 'Numbered steps, one action each, in order.', { kind: 'steps' }), S('tips', 'Tips and Common Mistakes', 'What to watch for.', { required: false }), S('next', 'What to Do Next', 'How to check it worked and where to go from here.')],
    hierarchy: 'One H1; H2 for each phase; numbered steps as an ordered list or H3 per step.', words: [700, 1500],
    evidence: 'Product or rule specifics cite the official documentation; never invent settings or results.',
    cta: 'Offer help, a template or a related tool.', visuals: 'Featured image; numbered steps; optional screenshots with alt text.',
    seo: 'Target “how to …” queries; use the exact task in the headline; HowTo structured data later.', compliance: 'Safety, legal or financial steps note when to ask a professional.',
    recommendedFor: ['technology', 'manufacturing', 'retail-consumer', 'construction', 'agriculture', 'real-estate'] },
  { id: 'industry-analysis', label: 'Industry Analysis', category: 'expertise', articleType: 'blog', intent: 'informational',
    purpose: 'Interpret a trend, change or event in the industry and what it means for the audience.',
    audience: 'Executives and specialists who track the market.',
    sections: [S('summary', 'In Brief', 'The development and the firm’s read of it in two or three sentences.'), S('what', 'What Happened', 'The facts, each sourced and dated.'), S('why', 'Why It Matters', 'The drivers and the significance.'), S('impact', 'Who Is Affected and How', 'Implications by audience or segment.'), S('outlook', 'What to Watch', 'Signals and scenarios; no predictions stated as fact.'), S('take', 'Our Take', 'The firm’s recommendation.')],
    hierarchy: 'One H1; H2 per analytical step; data in callouts or tables with sources.', words: [1000, 1800],
    evidence: 'Every figure and event needs a named, dated source (the Strategist’s verified research first).',
    cta: 'Invite a briefing or a subscription to updates.', visuals: 'Featured image; statistic callouts with sources; optional chart.',
    seo: 'Target the trend name plus “impact” or “what it means”; refresh when the data changes.', compliance: 'Forward-looking views hedged and labeled; no market predictions as fact.',
    recommendedFor: ['finance', 'energy', 'technology', 'healthcare', 'real-estate', 'transportation', 'telecommunications'] },
  { id: 'case-study', label: 'Case Study Article', category: 'proof', articleType: 'case-study', intent: 'commercial',
    purpose: 'Show how the firm solved a real client problem and what changed, with the client’s permission.',
    audience: 'Prospects with a similar problem who want proof.',
    sections: [S('glance', 'At a Glance', 'Client, challenge, approach and result in four short lines.', { kind: 'list' }), S('client', 'The Client', 'Who they are (only what is approved to share).'), S('challenge', 'The Challenge', 'The problem in the client’s terms.'), S('approach', 'Our Approach', 'What the firm did and why.'), S('results', 'The Results', 'Outcomes with how they were measured.'), S('quote', 'In Their Words', 'An approved client quote only.', { required: false, kind: 'quote' }), S('next', 'Could This Work for You?', 'The bridge to the reader’s situation.')],
    hierarchy: 'One H1 with the result; H2 per story step.', words: [700, 1300],
    evidence: 'Results only from the client’s own measurement or Brand Command; client named only with permission; quotes only approved testimonials.',
    cta: 'Invite a similar conversation.', visuals: 'Featured image; result statistic callouts (sourced); approved quote as pull quote.',
    seo: 'Target the problem plus the industry; name the outcome in the title.', compliance: 'Testimonials need approval in regulated industries; results are not typical guarantees.',
    recommendedFor: ['professional-services', 'technology', 'manufacturing', 'construction', 'finance', 'healthcare'] },
  { id: 'research-article', label: 'Research Article', category: 'expertise', articleType: 'blog', intent: 'informational',
    purpose: 'Present original or curated research findings and what they mean.',
    audience: 'Analysts, journalists and decision makers who value data.',
    sections: [S('findings', 'Key Findings', 'The three to five headline findings.', { kind: 'list' }), S('method', 'How the Research Was Done', 'Method, sample, period and limitations.'), S('detail', 'What We Found', 'Each finding with its data and source.'), S('meaning', 'What It Means', 'Interpretation for the audience.'), S('limits', 'Limitations', 'What the data cannot tell us.'), S('more', 'Read the Full Research', 'Where to get the full report or data.', { required: false })],
    hierarchy: 'One H1; H2 per finding group; tables and charts captioned with sources.', words: [1000, 2000],
    evidence: 'Every number cites its dataset or study with date; methodology stated; no rounding that changes meaning.',
    cta: 'Download the full report or subscribe for the next edition.', visuals: 'Statistic callouts; tables; charts with sources; featured image.',
    seo: 'Target “<topic> statistics/research <year>”; unique data earns links.', compliance: 'Methodology and limitations visible; no cherry-picked figures.',
    recommendedFor: ['healthcare', 'education', 'nonprofit', 'conservation-sustainability', 'finance', 'government'] },
  { id: 'product-announcement', label: 'Product Announcement', category: 'proof', articleType: 'announcement', intent: 'commercial',
    purpose: 'Announce a new product, service or feature and why it matters to customers.',
    audience: 'Customers and prospects; press may read it too.',
    sections: [S('news', 'The News', 'What is new, for whom, available when.'), S('problem', 'The Problem It Solves', 'The customer need behind it.'), S('what', 'What It Does', 'Key capabilities, as benefits.', { kind: 'list' }), S('how', 'How It Works', 'How customers get it or use it.'), S('availability', 'Availability and Pricing', 'Only confirmed facts.', { required: false }), S('start', 'Get Started', 'The next step.')],
    hierarchy: 'One H1 with the news; short H2s; skimmable.', words: [500, 900],
    evidence: 'Dates, prices and specifications only from Brand Command or the campaign; performance claims need their test or source.',
    cta: 'Try it, request a demo or learn more.', visuals: 'Featured product image; feature list; optional short demo video later.',
    seo: 'Product name plus category in the title and slug.', compliance: 'No unsupported superlatives; pricing and availability exact.',
    recommendedFor: ['technology', 'retail-consumer', 'manufacturing', 'telecommunications'] },
  { id: 'company-news', label: 'Company News', category: 'proof', articleType: 'news', intent: 'navigational',
    purpose: 'Share a company update: a hire, milestone, partnership, award or move.',
    audience: 'Clients, partners, staff and local press.',
    sections: [S('news', 'The News', 'Who, what, when and where in the opening paragraph.'), S('detail', 'The Details', 'Background and context.'), S('why', 'What It Means for Clients', 'Why readers should care.'), S('quote', 'A Word From Us', 'An approved quote from a named person.', { required: false, kind: 'quote' }), S('about', 'About the Company', 'The approved boilerplate.', { required: false })],
    hierarchy: 'One H1; few H2s; press-release clarity.', words: [350, 700],
    evidence: 'Awards and rankings named exactly with the granting body and year; quotes only approved ones.',
    cta: 'Light: contact, follow or read more.', visuals: 'Featured image (people or event photo from Brand Command).',
    seo: 'Company name plus the news; low search priority.', compliance: 'Award and ranking rules (for example the SEC Marketing Rule) for regulated firms.',
    recommendedFor: ['*'] },
  { id: 'comparison', label: 'Comparison Article', category: 'teach', articleType: 'blog', intent: 'commercial',
    purpose: 'Compare options fairly so the reader can choose what fits them.',
    audience: 'Readers evaluating alternatives.',
    sections: [S('intro', 'The Choice', 'What is being compared and who it is for.'), S('criteria', 'How to Compare', 'The criteria that matter.', { kind: 'list' }), S('side', 'Side by Side', 'Each option on each criterion.', { kind: 'table' }), S('fit', 'Which Fits Whom', 'When each option is the better choice.'), S('verdict', 'Our Recommendation', 'A fair conclusion, with the firm’s interest disclosed.')],
    hierarchy: 'One H1; H2 per criterion or option; a comparison table.', words: [900, 1600],
    evidence: 'Competitor facts only from public, dated sources; no disparagement; the firm’s own interest disclosed.',
    cta: 'Help choosing: a consultation, assessment or tool.', visuals: 'Comparison table; featured image.',
    seo: 'Target “A vs B” and “best … for …” queries.', compliance: 'Fair comparisons only; comparative claims substantiated.',
    recommendedFor: ['technology', 'finance', 'retail-consumer', 'telecommunications', 'energy'] },
  { id: 'expert-interview', label: 'Expert Interview', category: 'expertise', articleType: 'interview', intent: 'informational',
    purpose: 'Share an expert’s insight in their own words through questions and answers.',
    audience: 'Readers who follow the expert or the topic.',
    sections: [S('intro', 'Meet the Expert', 'Who they are and why they are worth hearing (approved bio).'), S('qa', 'The Conversation', 'Questions as H3, answers in the expert’s words.'), S('takeaways', 'Takeaways', 'Three to five lessons.', { kind: 'list' })],
    hierarchy: 'One H1; H2 for parts; each question an H3.', words: [900, 1800],
    evidence: 'Answers only from a real transcript or notes the person supplied; never invented quotes; edits approved by the expert.',
    cta: 'Follow the expert, attend their event or book a conversation.', visuals: 'Headshot from Brand Command; pull quote.',
    seo: 'Expert name plus topic.', compliance: 'The expert approves their quotes before publication.',
    recommendedFor: ['professional-services', 'healthcare', 'education', 'nonprofit'] },
  { id: 'list-article', label: 'List Article', category: 'teach', articleType: 'listicle', intent: 'informational',
    purpose: 'Give the reader a scannable set of ideas, tips or examples.',
    audience: 'Busy readers who skim.',
    sections: [S('intro', 'Why This List', 'What the reader gets and how the items were chosen.'), S('items', 'The List', 'Each item as an H3 with a short explanation.'), S('wrap', 'Putting It Together', 'Which items matter most for whom.')],
    hierarchy: 'One H1 with the number; each item an H3 under one H2 (or H2 items for long lists).', words: [700, 1400],
    evidence: 'Item facts sourced; no padding to reach a number.',
    cta: 'A checklist or related resource.', visuals: 'Numbered items; featured image.',
    seo: 'Number plus topic in the headline; target “tips”, “ways”, “examples”.', compliance: 'No “best” claims without basis.',
    recommendedFor: ['retail-consumer', 'travel-hospitality', 'real-estate', 'technology', 'agriculture'] },
  { id: 'event-recap', label: 'Event Recap', category: 'proof', articleType: 'news', intent: 'informational',
    purpose: 'Summarize an event, webinar or conference and its key lessons.',
    audience: 'Attendees and people who missed it.',
    sections: [S('intro', 'The Event', 'What, when, who spoke (confirmed only).'), S('highlights', 'Highlights', 'The key moments and ideas.', { kind: 'list' }), S('lessons', 'What We Learned', 'Insights with attribution to the speaker.'), S('next', 'Watch or Join Next Time', 'Replay link or the next event.')],
    hierarchy: 'One H1; H2 per theme or session.', words: [500, 1100],
    evidence: 'Speaker statements only from the recording or notes; attendance figures only if confirmed.',
    cta: 'Watch the replay or register for the next one.', visuals: 'Event photos from Brand Command; speaker quote.',
    seo: 'Event name plus year.', compliance: 'Speakers approve quotes; photo permissions.',
    recommendedFor: ['education', 'nonprofit', 'travel-hospitality', 'professional-services', 'government'] },
  { id: 'faq', label: 'FAQ Article', category: 'teach', articleType: 'blog', intent: 'informational',
    purpose: 'Answer the questions the audience actually asks, one by one.',
    audience: 'Prospects and clients with specific questions.',
    sections: [S('intro', 'About These Questions', 'Who asks these and what the answers cover.'), S('questions', 'Questions and Answers', 'Each question an H3; direct answer first, then detail.'), S('more', 'Still Have Questions?', 'Where to get a personal answer.')],
    hierarchy: 'One H1; questions as H3 under one H2 (or grouped H2s).', words: [700, 1500],
    evidence: 'Rules and figures cite official sources; answers stay general.',
    cta: 'Ask us directly: contact or book a call.', visuals: 'Featured image; optional definition callouts.',
    seo: 'Each question phrased as people search it; FAQ structured data later.', compliance: 'General information, not personal advice.',
    recommendedFor: ['finance', 'healthcare', 'real-estate', 'government', 'professional-services', 'travel-hospitality'] },
  { id: 'content-series', label: 'Content Series Article', category: 'series', articleType: 'blog', intent: 'informational',
    purpose: 'One part of a planned series: stands alone but links to the parts before and after.',
    audience: 'Returning readers following the series.',
    sections: [S('series', 'About This Series', 'Series name, this part’s number and what the series covers.'), S('recap', 'Previously', 'A short recap of the last part.', { required: false }), S('body', 'This Part', 'The part’s own content, in its own sections.'), S('next', 'Coming Next', 'What the next part covers.')],
    hierarchy: 'One H1 with series name and part; H2s for this part’s content.', words: [700, 1400],
    evidence: 'As the underlying type: every fact sourced.',
    cta: 'Subscribe to the series.', visuals: 'Consistent series featured image style; series label.',
    seo: 'Consistent naming across parts; link the parts to each other.', compliance: 'As the underlying type.',
    recommendedFor: ['education', 'nonprofit', 'technology', 'finance'] },
];

export const BLANK = { id: 'blank', label: 'Blank Article', category: '', articleType: 'blog', intent: 'informational',
  purpose: 'Start from a headline and an empty body; add the sections you need.', audience: '',
  sections: [S('body', 'First Section', 'Write your first section.')], hierarchy: 'One H1 (the headline); H2 for sections; H3 for sub-points.',
  words: [600, 1500], evidence: 'Every statistic, study or outside claim needs a named source.', cta: 'One relevant next step.', visuals: 'Featured image.', seo: 'One clear topic per article.', compliance: 'Follow the client’s Brand Command compliance rules.', recommendedFor: [] };

export function typeById(id) { return id === 'blank' ? BLANK : ARTICLE_TYPES.find((t) => t.id === id) || null; }
export function typesIn(categoryId) { return ARTICLE_TYPES.filter((t) => t.category === categoryId); }
export function categoryById(id) { return CATEGORIES.find((c) => c.id === id) || null; }

// Recommended types for a taxonomy industry (industry-taxonomy.js ids): the types written for that industry, then the
// types for everyone. No industry → the types for everyone only.
export function recommendFor(industryId) {
  const mine = industryId ? ARTICLE_TYPES.filter((t) => t.recommendedFor.includes(industryId)) : [];
  const all = ARTICLE_TYPES.filter((t) => t.recommendedFor.includes('*'));
  return [...new Set([...mine.slice(0, 4), ...all, ...mine.slice(4)])].slice(0, 6);
}

// The type's outline as article sections (headings with an empty body; nothing is written).
let seq = 0;
export const newId = (p = 's') => p + Date.now().toString(36) + (++seq).toString(36);
export function outlineFor(typeId) {
  const T = typeById(typeId) || BLANK;
  return T.sections.map((s) => ({ id: newId(), key: s.key, heading: s.heading, level: s.level, body: '', what: s.what, required: s.required, kind: s.kind || '', approved: false }));
}

// The type's shape as text for the Senior Writer's task (structure, hierarchy, length, evidence, CTA, compliance).
export function shapeText(typeId, sections) {
  const T = typeById(typeId) || BLANK; const secs = sections && sections.length ? sections : T.sections;
  return ['ARTICLE TYPE: ' + T.label + ' — ' + T.purpose,
    'Audience for this type: ' + (T.audience || 'as in the brief'),
    'Sections, in this order (H2 headings exactly as given; you may refine the wording of a heading, never drop a required one):\n' + secs.map((s, i) => (i + 1) + '. ' + s.heading + (s.what ? ' — ' + s.what : '') + (s.required === false ? ' (optional: leave out if there is nothing real to say)' : '')).join('\n'),
    'Heading hierarchy: ' + T.hierarchy, 'Length: ' + T.words[0] + '–' + T.words[1] + ' words.', 'Evidence: ' + T.evidence, 'Call to action: ' + T.cta, 'Compliance: ' + T.compliance].join('\n');
}
