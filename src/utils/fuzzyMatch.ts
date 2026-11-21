import { MatchingCandidate, Product } from "../types";

// Known pharmacy abbreviations and phonetic aliases
const PHARMACY_SYNONYMS: Record<string, string[]> = {
  sufra: ["surfe", "sofra", "soframycin", "surfetulles"],
  tule: ["tulle", "tulles"],
  tull: ["tulles", "tulle"],
  stripe: ["syringe", "strip", "strips"],
  strips: ["strip"],
  syring: ["syringe"],
  syr: ["syringe"],
  bbraun: ["b braun", "braun"],
  bbraun1cc: ["b braun 1cc"],
  gauge: ["gauge", "g", "no"],
  branula: ["branula", "veinofix", "cannula"],
  facemask: ["face mask", "facemask"],
  weight: ["weight machine", "scale"],
  glucometer: ["gluco meter", "glucometer"],
  temp: ["thermometer"],
};

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTokens(str: string): string[] {
  return normalizeString(str).split(" ").filter((t) => t.length > 0);
}

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function similarityRatio(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, (maxLen - dist) / maxLen);
}

export function findMatchingProducts(query: string, products: Product[], limit: number = 8): MatchingCandidate[] {
  if (!query || !query.trim()) return [];

  const rawQuery = query.trim();
  const normalizedQuery = normalizeString(rawQuery);
  const queryTokens = getTokens(rawQuery);

  if (queryTokens.length === 0) return [];

  const scoredList: MatchingCandidate[] = [];

  for (const product of products) {
    const rawProdName = product.name;
    const normalizedProdName = normalizeString(rawProdName);
    const prodTokens = getTokens(rawProdName);

    let score = 0;
    let matchReason = "";

    // 1. Exact Match
    if (normalizedQuery === normalizedProdName) {
      score = 100;
      matchReason = "Exact Match";
    }
    // 2. Starts with query
    else if (normalizedProdName.startsWith(normalizedQuery)) {
      score = 95;
      matchReason = "Prefix Match";
    }
    // 3. Contains full query
    else if (normalizedProdName.includes(normalizedQuery)) {
      score = 90;
      matchReason = "Full Phrase Match";
    } else {
      // 4. Token-by-token matching & alias expansion
      let matchedTokenCount = 0;
      let tokenScoreSum = 0;

      for (const qToken of queryTokens) {
        let bestTokenScore = 0;

        // Check synonyms/aliases
        const aliases = [qToken, ...(PHARMACY_SYNONYMS[qToken] || [])];

        for (const pToken of prodTokens) {
          for (const alias of aliases) {
            if (pToken === alias) {
              bestTokenScore = Math.max(bestTokenScore, 1.0);
            } else if (pToken.startsWith(alias) || alias.startsWith(pToken)) {
              bestTokenScore = Math.max(bestTokenScore, 0.85);
            } else {
              const sim = similarityRatio(alias, pToken);
              if (sim > 0.65) {
                bestTokenScore = Math.max(bestTokenScore, sim * 0.8);
              }
            }
          }
        }

        if (bestTokenScore >= 0.5) {
          matchedTokenCount++;
          tokenScoreSum += bestTokenScore;
        }
      }

      const tokenCoverage = matchedTokenCount / queryTokens.length;
      if (tokenCoverage >= 0.5) {
        const avgTokenScore = tokenScoreSum / queryTokens.length;
        score = Math.round(avgTokenScore * 80);
        matchReason = tokenCoverage === 1 ? "All Keywords Matched" : "Partial Keyword Match";
      } else {
        // Overall Levenshtein similarity fallback
        const wholeSim = similarityRatio(normalizedQuery, normalizedProdName);
        if (wholeSim > 0.45) {
          score = Math.round(wholeSim * 70);
          matchReason = "Similar Spelling";
        }
      }
    }

    // Boost if product code matches query
    if (product.productCode && normalizeString(product.productCode).includes(normalizedQuery)) {
      score = Math.max(score, 92);
      matchReason = "Product Code Match";
    }

    if (score >= 35) {
      scoredList.push({
        product,
        score,
        matchReason,
      });
    }
  }

  // Sort descending by score, then alphabetically
  scoredList.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.product.name.localeCompare(b.product.name);
  });

  return scoredList.slice(0, limit);
}
