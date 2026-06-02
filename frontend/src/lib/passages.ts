export interface RawPassage {
  content: string;
  wordCount: number;
  difficulty: "easy" | "medium" | "hard" | "code";
  source?: string;
}

export const ALL_PASSAGES: RawPassage[] = [
  // --- EASY (12 entries) ---
  { content: "The quick brown fox jumps over the lazy dog.", wordCount: 9, difficulty: "easy", source: "Traditional" },
  { content: "A warm cup of tea makes the rainy afternoon cozy.", wordCount: 10, difficulty: "easy" },
  { content: "Cats love to sleep under the warm sun for hours.", wordCount: 10, difficulty: "easy" },
  { content: "Reading books opens up new worlds inside our minds.", wordCount: 9, difficulty: "easy" },
  { content: "Birds sing sweet melodies early in the morning.", wordCount: 8, difficulty: "easy" },
  { content: "Walking along the quiet beach relaxes the tired soul.", wordCount: 9, difficulty: "easy" },
  { content: "Fresh green grass grows quickly after the spring rain.", wordCount: 9, difficulty: "easy" },
  { content: "An apple a day keeps the doctor away from you.", wordCount: 10, difficulty: "easy", source: "Proverb" },
  { content: "The bright stars align perfectly across the night sky.", wordCount: 9, difficulty: "easy" },
  { content: "Cooking healthy meals brings happiness to the family.", wordCount: 8, difficulty: "easy" },
  { content: "Laughter is truly the best medicine for a hard day.", wordCount: 10, difficulty: "easy", source: "Proverb" },
  { content: "Small steady steps always lead to great achievements.", wordCount: 8, difficulty: "easy" },

  // --- MEDIUM (13 entries) ---
  { content: "Sustained discipline over extended periods yields extraordinary performance breakthroughs.", wordCount: 10, difficulty: "medium" },
  { content: "Navigating deep complex architectural abstractions requires exceptional cognitive endurance.", wordCount: 10, difficulty: "medium" },
  { content: "The transition to asynchronous workflows introduces unexpected communication challenges.", wordCount: 9, difficulty: "medium" },
  { content: "Distributed systems inevitably encounter partition issues demanding consensus algorithms.", wordCount: 10, difficulty: "medium" },
  { content: "Maintaining optimal concentration involves minimizing ambient digital notifications systematically.", wordCount: 10, difficulty: "medium" },
  { content: "A balanced perspective accommodates divergent methodologies without compromising execution quality.", wordCount: 11, difficulty: "medium" },
  { content: "Engineering reliable database abstractions involves managing transaction isolation strategies properly.", wordCount: 10, difficulty: "medium" },
  { content: "Consistent iterative adjustments generate compounding advantages throughout development lifecycles.", wordCount: 10, difficulty: "medium" },
  { content: "Cryptographic protocols establish foundational security perimeters across vulnerable public channels.", wordCount: 11, difficulty: "medium" },
  { content: "Automated test suites validate structural integrity while accelerating continuous deployment speed.", wordCount: 11, difficulty: "medium" },
  { content: "Open source contributions expand technical capability while fostering collaborative developer networks.", wordCount: 11, difficulty: "medium" },
  { content: "Refactoring legacy code bases exposes hidden assumptions that require cautious evaluation.", wordCount: 11, difficulty: "medium" },
  { content: "Effective technical documentation bridges sophisticated mechanisms with intuitive human comprehension.", wordCount: 10, difficulty: "medium" },

  // --- HARD (12 entries) ---
  { content: "Consciousness remains an enigmatic paradigm, defying reductionist attempts to map intricate neurobiological phenomena entirely to physical components.", wordCount: 18, difficulty: "hard", source: "Philosophy" },
  { content: "Epistemological frameworks dictate how researchers interpret empirical evidence, transforming raw perceptual datasets into structured scientific doctrines.", wordCount: 16, difficulty: "hard", source: "Philosophy" },
  { content: "The subtle juxtaposition of neoclassical architecture with modern brutalism creates a jarring yet profoundly captivating urban aesthetic landscape.", wordCount: 19, difficulty: "hard", source: "Design" },
  { content: "Quantum entanglement demonstrates counterintuitive non-local correlations, explicitly challenging traditional localized assumptions regarding physical reality vectors.", wordCount: 17, difficulty: "hard", source: "Physics" },
  { content: "Macroeconomic volatility requires sophisticated algorithmic risk mitigations to preserve capital allocations amidst unpredictable hyperinflationary spirals.", wordCount: 16, difficulty: "hard", source: "Economics" },
  { content: "Socioeconomic stratification propagates institutional barriers that systematically restrict equitable upward mobility across historical generations.", wordCount: 15, difficulty: "hard", source: "Sociology" },
  { content: "Biomedical engineering facilitates unprecedented therapeutic interventions by synthesising biocompatible synthetic matrices with physiological substrates.", wordCount: 16, difficulty: "hard", source: "Science" },
  { content: "Philosophical existentialism encourages individuals to forge authentic meaning internally despite navigating an fundamentally indifferent cosmic expanse.", wordCount: 17, difficulty: "hard", source: "Philosophy" },
  { content: "Algorithmic game theory analyzes strategic interactions within sophisticated mechanisms, identifying stable Nash equilibrium conditions under asymmetric information constraints.", wordCount: 19, difficulty: "hard", source: "Mathematics" },
  { content: "The relentless pursuit of technological optimizations inadvertently introduces convoluted systemic vulnerabilities that require continuous monitoring.", wordCount: 16, difficulty: "hard", source: "Security" },
  { content: "Cognitive dissonance manifests when deeply rooted ideologies conflict with undeniable empirical realities, prompting defensive intellectual rationalizations.", wordCount: 17, difficulty: "hard", source: "Psychology" },
  { content: "Amortized complexity analysis evaluates operational overhead across long operation sequences, ensuring realistic guarantees beyond pessimistic worst-case bounds.", wordCount: 18, difficulty: "hard", source: "Computer Science" },

  // --- CODE (13 entries) ---
  { content: "export const db = drizzle(postgres(process.env.DATABASE_URL!, { prepare: false }));", wordCount: 11, difficulty: "code", source: "TypeScript" },
  { content: "const users = pgTable('users', { id: uuid('id').primaryKey().defaultRandom() });", wordCount: 12, difficulty: "code", source: "Drizzle" },
  { content: "useEffect(() => { const sub = supabase.auth.onAuthStateChange(() => {}); return () => sub.unsubscribe(); }, []);", wordCount: 15, difficulty: "code", source: "React" },
  { content: "public static void main(String[] args) { System.out.println(\"Hello World\"); }", wordCount: 11, difficulty: "code", source: "Java" },
  { content: "fn main() { let mut vec = Vec::new(); vec.push(42); match vec.get(0) { Some(x) => println!(\"{}\", x), None => {} } }", wordCount: 25, difficulty: "code", source: "Rust" },
  { content: "def get_context_data(self, **kwargs): context = super().get_context_data(**kwargs); return context", wordCount: 11, difficulty: "code", source: "Python" },
  { content: "SELECT difficulty, COUNT(*) FROM passages GROUP BY difficulty ORDER BY count DESC;", wordCount: 11, difficulty: "code", source: "SQL" },
  { content: "const balance = await connection.getBalance(new PublicKey(walletAddress));", wordCount: 9, difficulty: "code", source: "Solana" },
  { content: "docker run --name redis -p 6379:6379 -d redis:alpine redis-server --appendonly yes", wordCount: 12, difficulty: "code", source: "Docker" },
  { content: "for (let i = 0; i < arr.length; i++) { for (let j = i + 1; j < arr.length; j++) {} }", wordCount: 23, difficulty: "code", source: "JavaScript" },
  { content: "type Readonly<T> = { readonly [P in keyof T]: T[P]; };", wordCount: 11, difficulty: "code", source: "TypeScript" },
  { content: "pipeline { agent any stages { stage('Build') { steps { sh 'npm run build' } } } }", wordCount: 16, difficulty: "code", source: "Jenkins" }
];

/**
 * Returns a random passage matching the given difficulty level.
 * Optionally avoids repeating a specific passage via currentId.
 */
export function getRandomPassage(
  difficulty: "easy" | "medium" | "hard" | "code",
  currentId?: string
): { id: string; content: string; wordCount: number; difficulty: string; source?: string } {
  // Filter passages by matching difficulty
  const filtered = ALL_PASSAGES.filter((p) => p.difficulty === difficulty);

  if (filtered.length === 0) {
    // Fail-safe default fallback in case array filters empty
    return {
      id: "default-id",
      content: "The quick brown fox jumps over the lazy dog.",
      wordCount: 9,
      difficulty: "easy",
      source: "System",
    };
  }

  // If a currentId is specified, try to filter it out to avoid duplication
  let choices = filtered;
  if (currentId && filtered.length > 1) {
    // Generating dynamic synthetic IDs since raw items use structural content values
    choices = filtered.filter((p) => p.content !== currentId && encodeURIComponent(p.content).slice(0, 8) !== currentId);
  }

  const randomIndex = Math.floor(Math.random() * choices.length);
  const selected = choices[randomIndex];

  // Return formatted object matching expectations on your page view state layout
  return {
    // Generate a quick stable id string out of the text contents for key assignments
    id: encodeURIComponent(selected.content).slice(0, 8),
    content: selected.content,
    wordCount: selected.wordCount,
    difficulty: selected.difficulty,
    source: selected.source,
  };
}

// Add this helper object export to group passages structurally by difficulty key
export const PASSAGES_BY_DIFFICULTY = {
  easy: ALL_PASSAGES.filter(p => p.difficulty === "easy"),
  medium: ALL_PASSAGES.filter(p => p.difficulty === "medium"),
  hard: ALL_PASSAGES.filter(p => p.difficulty === "hard"),
  code: ALL_PASSAGES.filter(p => p.difficulty === "code"),
};