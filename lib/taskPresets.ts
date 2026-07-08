// Shared task quick-start presets + default emoji picks. Used by the task
// creation form (dashboard/chores) and the onboarding setup wizard so the two
// never drift apart.

// 20 named quick-start presets (tap to fill name + icon).
export const TASK_PRESETS: { emoji: string; title: string }[] = [
  { emoji: '🦷', title: 'Brush teeth' },              { emoji: '📚', title: 'Homework / Study' },
  { emoji: '🎹', title: 'Music practice' },           { emoji: '😴', title: 'Get ready for bed' },
  { emoji: '🎒', title: 'Pack school bag' },          { emoji: '🧸', title: 'Clean room' },
  { emoji: '🛏️', title: 'Make the bed' },             { emoji: '🧺', title: 'Clothes in hamper' },
  { emoji: '🍽️', title: 'Wash dishes' },              { emoji: '🍴', title: 'Set / clear table' },
  { emoji: '🧽', title: 'Wipe the counters' },        { emoji: '🗑️', title: 'Take out the trash' },
  { emoji: '🧹', title: 'Vacuum / sweep floors' },    { emoji: '🪶', title: 'Dust the furniture' },
  { emoji: '👕', title: 'Fold / put away laundry' },  { emoji: '🛍️', title: 'Carry in groceries' },
  { emoji: '🌱', title: 'Mow the lawn' },             { emoji: '🍂', title: 'Rake / weed the garden' },
  { emoji: '🪴', title: 'Water the plants' },         { emoji: '🐕', title: 'Feed pet / walk dog' },
]

// 10 default quick-pick icons shown 5-per-row (search reveals the rest).
export const DEFAULT_TASK_EMOJIS = ['🦷', '📚', '🎹', '🎒', '🧸', '🛏️', '🍽️', '🗑️', '🧹', '🪴']
