// A stand-in for the dashboard's /api/claude in tests: answers each Blog Builder prompt with fixed, fact-free words, so the
// flow can be rendered with no network. Never used by the app itself.
export function stubAnswer(body) {
  const msgs = (body && body.messages) || []; const text = msgs.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
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
