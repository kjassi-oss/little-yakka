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

// 9 default quick-pick icons + the 🔍 search cell share ONE row of 10.
// Star first by design. (Laundry Hamper was dropped to make room for the
// search cell — Fold Laundry covers laundry.)
export const DEFAULT_TASK_ICONS: { e: string; label: string }[] = [
  { e: '⭐', label: 'Star' },
  { e: '🛏️', label: 'Make Bed' },
  { e: '📚', label: 'Study' },
  { e: '🎵', label: 'Music' },
  { e: '✨', label: 'Clean Bedroom' },
  { e: '🗑️', label: 'Trash Out' },
  { e: '🍽️', label: 'Set Table' },
  { e: '👕', label: 'Fold Laundry' },
  { e: '🧹', label: 'Vacuum' },
]

// Reward emoji picker — top 10 shown on one row; the 🔍 search reveals the rest.
export const DEFAULT_REWARD_EMOJIS = ['🎁', '🍦', '🎮', '📱', '🎬', '🍿', '🍔', '🍭', '🍰', '🏆']

export const REWARD_EMOJI_OPTIONS: { e: string; kw: string }[] = [
  { e: '🎁', kw: 'gift present surprise' }, { e: '🍦', kw: 'ice cream icecream treat' },
  { e: '🎮', kw: 'games computer console video gaming' }, { e: '📱', kw: 'ipad phone tablet screen time' },
  { e: '🎬', kw: 'movie movies cinema film' }, { e: '🍿', kw: 'popcorn movie night' },
  { e: '🍔', kw: 'burger takeaway maccas dinner' }, { e: '🍭', kw: 'lolly lollipop candy sweet' },
  { e: '🍰', kw: 'cake dessert sweet' }, { e: '🏆', kw: 'trophy winner prize' },
  { e: '🍕', kw: 'pizza takeaway dinner' }, { e: '🍩', kw: 'donut doughnut treat' },
  { e: '🍪', kw: 'cookie biscuit treat' }, { e: '🎂', kw: 'birthday cake party' },
  { e: '🧁', kw: 'cupcake baking treat' }, { e: '🍫', kw: 'chocolate treat sweet' },
  { e: '📺', kw: 'tv television show cartoons' }, { e: '💻', kw: 'computer laptop screen' },
  { e: '🎧', kw: 'headphones music listen' }, { e: '🎵', kw: 'music song' },
  { e: '🎉', kw: 'party celebrate' }, { e: '🛍️', kw: 'shopping shops buy' },
  { e: '✈️', kw: 'plane holiday travel trip' }, { e: '🏖️', kw: 'beach holiday swim sand' },
  { e: '🎡', kw: 'ferris wheel fair carnival show' }, { e: '🎢', kw: 'rollercoaster theme park ride' },
  { e: '🎠', kw: 'carousel fair ride' }, { e: '🎯', kw: 'darts target games' },
  { e: '🏅', kw: 'medal winner sport' }, { e: '🥇', kw: 'gold first winner' },
  { e: '👑', kw: 'crown princess king queen' }, { e: '💎', kw: 'gem diamond jewel special' },
  { e: '🌟', kw: 'star special shine' }, { e: '🧸', kw: 'teddy toy plush' },
  { e: '🌈', kw: 'rainbow colourful' }, { e: '🌙', kw: 'stay up late bedtime night' },
  { e: '🚲', kw: 'bike ride bicycle' }, { e: '⚽', kw: 'soccer football sport' },
  { e: '🏀', kw: 'basketball sport' }, { e: '🏊', kw: 'swim swimming pool' },
  { e: '⛺', kw: 'camping tent sleepover backyard' }, { e: '🎨', kw: 'art craft paint drawing' },
  { e: '📚', kw: 'book books reading' }, { e: '🐶', kw: 'puppy dog pet play' },
  { e: '🎳', kw: 'bowling games outing' }, { e: '🃏', kw: 'cards game night' },
  { e: '🎲', kw: 'board game dice game night' }, { e: '🍉', kw: 'fruit watermelon snack' },
  { e: '🥤', kw: 'drink slurpee soft drink milkshake' }, { e: '🍨', kw: 'sundae ice cream dessert' },
]

// Full searchable icon set — keywords drive the 🔍 search box.
export const EMOJI_OPTIONS: { e: string; kw: string }[] = [
  { e: '⭐', kw: 'star reward good special' },
  { e: '✨', kw: 'clean bedroom tidy sparkle shine' },
  { e: '🛏️', kw: 'bed make sleep bedroom' }, { e: '🧹', kw: 'sweep broom clean tidy floor' },
  { e: '🍽️', kw: 'dishes plate dinner table eat clear' }, { e: '🧺', kw: 'laundry washing clothes' },
  { e: '📖', kw: 'reading book bedtime story read' }, { e: '📝', kw: 'homework write notes school' },
  { e: '🎵', kw: 'music practice song sing' }, { e: '🪈', kw: 'flute music practice instrument' },
  { e: '🎺', kw: 'trumpet music practice brass instrument' },
  { e: '📚', kw: 'books read study homework school' }, { e: '🐕', kw: 'dog pet walk feed' },
  { e: '🐈', kw: 'cat pet feed litter' }, { e: '🐟', kw: 'fish pet feed tank' },
  { e: '🌿', kw: 'plant garden water weeds' }, { e: '🗑️', kw: 'bin rubbish trash garbage empty' },
  { e: '♻️', kw: 'recycle recycling bins' }, { e: '🛁', kw: 'bath wash clean' },
  { e: '🧼', kw: 'soap wash hands clean' }, { e: '🪥', kw: 'toothbrush teeth brush' },
  { e: '🍳', kw: 'cook breakfast egg kitchen help' }, { e: '🚿', kw: 'shower wash clean' },
  { e: '🧽', kw: 'sponge wipe clean scrub' }, { e: '👕', kw: 'shirt clothes get dressed fold' },
  { e: '🧦', kw: 'socks clothes pairs' }, { e: '👟', kw: 'shoes tidy put away' },
  { e: '🎒', kw: 'bag school pack backpack' }, { e: '🏃', kw: 'run exercise sport active' },
  { e: '🌙', kw: 'night bedtime sleep evening' }, { e: '🎨', kw: 'art draw paint craft' },
  { e: '🪀', kw: 'toys play tidy pack away' }, { e: '🧸', kw: 'toys teddy tidy bedroom' },
  { e: '🧴', kw: 'lotion sunscreen cream' }, { e: '💊', kw: 'medicine vitamin tablet' },
  { e: '🥤', kw: 'drink water bottle' }, { e: '🍎', kw: 'fruit apple healthy snack eat' },
  { e: '🥕', kw: 'veg carrot vegetables eat' }, { e: '🍌', kw: 'banana fruit snack' },
  { e: '🥣', kw: 'cereal breakfast bowl' }, { e: '🧊', kw: 'fridge ice freezer' },
  { e: '🪟', kw: 'window clean wipe' }, { e: '🚪', kw: 'door close lock' },
  { e: '🛒', kw: 'shopping groceries store help' }, { e: '🧻', kw: 'toilet paper roll bathroom' },
  { e: '🚽', kw: 'toilet clean bathroom' }, { e: '🪣', kw: 'bucket mop clean water' },
  { e: '🧷', kw: 'tidy organise pin' }, { e: '✏️', kw: 'pencil write draw school' },
  { e: '🎹', kw: 'piano music practice keys' }, { e: '🎸', kw: 'guitar music practice strings' },
  { e: '🥁', kw: 'drums music practice percussion' }, { e: '🎷', kw: 'saxophone sax music practice' },
  { e: '🎻', kw: 'violin music practice strings' }, { e: '⚽', kw: 'soccer football sport play' },
  { e: '🏀', kw: 'basketball sport play' }, { e: '🚲', kw: 'bike ride cycle' },
  { e: '🧠', kw: 'study think learn brain' }, { e: '💧', kw: 'water plants drink' },
  { e: '🌳', kw: 'tree garden outside yard' }, { e: '🍂', kw: 'leaves rake garden yard' },
  { e: '☀️', kw: 'morning sun wake up' }, { e: '❤️', kw: 'love kind helpful' },
  { e: '🙏', kw: 'manners please thanks pray' }, { e: '😴', kw: 'sleep nap bedtime rest' },
  { e: '🪴', kw: 'plant pot water garden' }, { e: '🍪', kw: 'snack treat baking' },
  { e: '🐾', kw: 'pet animal feed' }, { e: '🚗', kw: 'car wash tidy' },
  { e: '🎯', kw: 'goal target focus' }, { e: '📦', kw: 'box pack tidy put away' },
]
