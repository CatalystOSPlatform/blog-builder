// A stand-in for the dashboard's /api/claude in tests: answers each Blog Builder prompt with fixed, fact-free words, so the
// flow can be rendered with no network. Never used by the app itself.
export function stubAnswer(body) {
  const msgs = (body && body.messages) || []; const text = msgs.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
  if (/blog topic ideas/.test(text)) return JSON.stringify(stubIdeas(text));
  if (/Write the editorial brief/.test(text)) {
    return JSON.stringify({ workingTitle: 'Why a Written Income Plan Calms Retirement Decisions', audience: 'People within ten years of retirement', objective: 'Help readers see why a written income plan matters and book a review', searchIntent: 'informational',
      angle: 'From saving to spending: the shift nobody plans for.', keyQuestions: ['What changes when paychecks stop?', 'What goes into an income plan?', 'How often should it be updated?'],
      clientContent: 'Fee-only planning firm in Boston; retirement income planning; tax-aware investing.', suggestedType: 'educational',
      outline: ['Why This Matters', 'The Basics', 'How It Works', 'Common Misunderstandings', 'What It Means for You', 'Key Takeaways'], cta: 'Book a free retirement income review', compliance: ['Education, not individual advice'] });
  }
  if (/Write a complete blog article/.test(text)) {
    const heads = [...text.matchAll(/^\d+\. ([^—\n]+?)(?: — |\n)/gm)].map((m) => m[1].trim()).slice(0, 6);
    return ['# Why a Written Income Plan Calms Retirement Decisions', '_Retirement changes the question from how much you saved to how much you can spend._', '',
      'When paychecks stop, decisions that were automatic become choices. A written plan turns those choices into a calm routine.', '',
      ...heads.flatMap((h, i) => ['## ' + h, i === 1 ? '- Know your monthly spending\n- List every income source\n- Decide the order of withdrawals' : i === 2 ? 'Most retirees spend 80% of their pre-retirement income [Source needed]. A plan shows what your own number is.' : 'Plain words about ' + h.toLowerCase() + ' for people close to retirement.', '']),
      '## Conclusion', 'A written plan will not remove every worry, but it makes the next decision clearer.', '',
      '## Call to Action', 'Talk it through with a Harbor Point planner.', 'Button: Book a Free Review', '',
      '## Sources', '- Demo research report — https://example.com/research'].join('\n');
  }
  if (/Return ONLY the text/.test(text)) return 'A clearer way to plan the years after work.';
  return '{}';
}

// Topic ideas (lib/topics.js): fixed ideas for the preview campaign. One carries a made-up figure (the app must drop it);
// asked again with ideas already shown, four different ones; Company News with no news in the campaign: none, and a note.
export function stubIdeas(text) {
  if (/THIS ARTICLE TYPE IS COMPANY NEWS/.test(text)) return { ideas: [{ headline: 'Harbor Point Opens a New Office', angle: 'A new office for clients.', why: 'Shows growth.', basis: 'news', evidence: 'opens a new office' }], note: '' };
  if (/ALREADY SUGGESTED/.test(text)) return { ideas: [
    { headline: 'When to Start Drawing Social Security', angle: 'The timing choice that shapes every other income decision.', why: 'Supports the pillar Spending with confidence.', basis: 'pillar', persona: 'Pre-retirees', facts: [] },
    { headline: 'Your First Year Without a Paycheck', angle: 'What changes month by month in the first year of retirement.', why: 'Speaks to the worry about running out of money.', basis: 'persona', persona: 'Pre-retirees', facts: [] },
    { headline: 'Selling Your Business and Funding Retirement', angle: 'How an exit plan and an income plan fit together.', why: 'Brings business owners into the campaign.', basis: 'persona', persona: 'Business owners', facts: [] },
    { headline: 'Taxes on Retirement Withdrawals, Explained', angle: 'The order of withdrawals and why it matters for taxes.', why: 'Supports the pillar Taxes in retirement.', basis: 'pillar', persona: '', facts: [] }] };
  return { ideas: [
    { headline: 'Why a Written Income Plan Calms Retirement Decisions', angle: 'From saving to spending: the shift nobody plans for, and how a written plan helps.', why: 'Carries the key message: a written income plan makes retirement decisions calmer.', basis: 'message', persona: 'Pre-retirees', facts: [] },
    { headline: 'What the Research Says About Retirement Income Worries', angle: 'What a new study found, and what it means for your own plan.', why: 'Uses the campaign’s verified research.', basis: 'fact', persona: '', facts: ['R1'] },
    { headline: 'Most Retirees Spend 80% of Their Old Income', angle: 'Why the 80% rule may not fit you.', why: 'A common rule of thumb.', basis: 'goal', persona: '', facts: [] },
    { headline: '5 Questions to Ask Before Your Last Paycheck', angle: 'A short checklist for the year before you retire.', why: 'Leads readers to book a free retirement income review.', basis: 'goal', persona: 'Pre-retirees', facts: [] },
    { headline: 'How Business Owners Can Plan Retirement Income', angle: 'Turning the value of a business into a steady paycheck.', why: 'Supports the pillar Spending with confidence for owners.', basis: 'persona', persona: 'Business owners', facts: [] },
    { headline: 'Withdrawal Order: The Tax Decision Nobody Explains', angle: 'Which accounts to draw from first, in plain words.', why: 'Supports the pillar Taxes in retirement.', basis: 'pillar', persona: '', facts: [] },
    { headline: 'Spending With Confidence in Your First Retirement Year', angle: 'Setting a monthly number you can trust.', why: 'Supports the pillar Spending with confidence.', basis: 'pillar', persona: 'Pre-retirees', facts: [] }], note: '' };
}
