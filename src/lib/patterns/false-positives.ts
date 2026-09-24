/**
 * False-positive vocabulary shared by every detector.
 *
 * The notes below are lifted from the upstream Alberta TRACE / hackathon
 * repo's own caveat lists (CRA loop scorer commentary, donee-name-quality
 * report, KNOWN-DATA-ISSUES) and from the F-/C-/A- data-quality catalogue.
 * Each pattern lists the subset that applies to it in the registry
 * (`falsePositiveNotes`); `benignNoteFor()` in strength.ts picks the single
 * most applicable note for a given match, or null when none applies.
 *
 * Name regexes are deliberately broad: they exist to LOWER confidence and
 * attach a caveat, never to suppress a match.
 */

export const FP = {
  COMMUNITY_FOUNDATION:
    "Community foundations pool and re-grant local donations by design; money flowing in and back out through them is their normal operating model, not a circular scheme.",
  DENOMINATIONAL_HIERARCHY:
    "Denominational hierarchies (dioceses, synods, conferences, councils, presbyteries) routinely move funds between the parent body and congregations; structural relatedness here is expected.",
  FEDERATED_CHARITY:
    "Federated charities (United Way / Centraide, Jewish federations, national bodies with provincial or local chapters) are legally distinct entities that are related by charter — relatedness is disclosed, not hidden.",
  DAF_PLATFORM:
    "Donor-advised-fund platforms and gift-fund sponsors (e.g. Canada Gives, Aqueduct, Charitable Impact, Benefaction, Strategic Charitable Giving, Private Giving Foundation) are pass-through intermediaries; loops and high degree through them reflect donor instructions.",
  PUBLISHER_AGGREGATED:
    "Publisher-aggregated rows (batch reports, 'various recipients', undisclosed-individual pools) are reporting artefacts, not entities; a match built on them describes the publisher's practice rather than a recipient.",
  PLACEHOLDER_BN:
    "The recipient business number is missing or a placeholder ('0', all-zeros, '-', 'n/a'): rows were grouped by legal name only, so distinct entities with the same name may be merged (KNOWN-DATA-ISSUES F-6/F-7).",
  NAME_ONLY_IDENTITY:
    "Identity rests on the legal name alone (no business number); spelling variants can split one entity into several or merge homonyms (KNOWN-DATA-ISSUES F-6, C-3).",
  DUPLICATE_ROWS:
    "The agreement chain contains duplicate (ref_number, amendment_number) rows (KNOWN-DATA-ISSUES F-2); counts and first/last values may be inflated by publisher duplicates.",
  NEGATIVE_VALUES:
    "The chain contains negative agreement values used as termination/reversal markers (KNOWN-DATA-ISSUES F-4); growth ratios and totals near such rows are unreliable.",
  REF_COLLISION:
    "The ref_number is shared by unrelated recipients (KNOWN-DATA-ISSUES F-1); the chain was split by recipient identity but residual cross-contamination is possible when the name is spelled inconsistently.",
  SINGLE_RECIPIENT_PROGRAM:
    "Programs with a single named recipient by statute or design (transfer payments to one crown corporation, foundation, or province) are 100% concentrated by construction.",
  STATUTORY_TRANSFER:
    "Large statutory or formula-driven transfers (health, equalisation, infrastructure envelopes) dominate departmental totals and inflate concentration measures without any procurement decision.",
  LEGITIMATE_DUAL_FUNDING:
    "Receiving both federal and Alberta funding is common for universities, health authorities, municipalities and large NGOs whose programs are distinct by design; overlap is a verification prompt, not evidence of duplication.",
  PROGRAM_SUNSET:
    "Recipients funded under a program that ended or was renamed will go silent in this corpus without ceasing to exist; check the program's end date before reading silence as closure.",
  ONE_OFF_CAPITAL:
    "A single large capital or research award is expected to be followed by silence; one-off funding is not a zombie signal on its own.",
  UNIT_ERROR:
    "T3010 money fields are unbounded and unit errors (dollars vs thousands) occur (KNOWN-DATA-ISSUES C-2); a gift amount that dwarfs the donor's revenue may be a reporting error.",
  UNREGISTERED_DONEE:
    "The donee BN is well-formed but absent from the charity register (KNOWN-DATA-ISSUES C-11): qualified donees include municipalities, universities and First Nations councils that are not charities.",
  KEYWORD_PROXY:
    "Program-purpose keyword matching is a proxy: programs can serve a priority without naming it, and stated commitments are budget-cycle estimates, so the gap measure is indicative only.",
  DESCRIPTION_REWRITE:
    "Departments periodically rewrite agreement descriptions to a house style or translate them; low keyword overlap can reflect editorial change rather than a change of purpose.",
} as const;

export type FalsePositiveKey = keyof typeof FP;

/** Name patterns that map an entity name to a benign note. Order matters: first hit wins. */
export const NAME_RULES: Array<{ key: FalsePositiveKey; re: RegExp }> = [
  {
    key: "PUBLISHER_AGGREGATED",
    re: /\b(batch report|rapport en lots|various recipients|multiple recipients|divers b[ée]n[ée]ficiaires|undisclosed|sundry|individuals?\b|particuliers)/i,
  },
  {
    key: "DAF_PLATFORM",
    re: /\b(donor[- ]advised|gift funds?|giving fund|charitable gift program|canada gives|aqueduct foundation|charitable impact|benefaction|strategic charitable giving|private giving foundation|abundance canada|link charity|mackenzie charitable|charitable giving foundation)\b/i,
  },
  {
    key: "COMMUNITY_FOUNDATION",
    re: /\b(community foundation|fondation communautaire|foundation of greater|vancouver foundation|calgary foundation|edmonton community|winnipeg foundation|toronto foundation|hamilton community|victoria foundation)\b/i,
  },
  {
    key: "FEDERATED_CHARITY",
    re: /\b(united way|centraide|jewish federation|federation cja|united jewish appeal|\buja\b|combined jewish|federated|umbrella|national office|chapter|branch|division|section|local #?\d+|district)\b/i,
  },
  {
    key: "DENOMINATIONAL_HIERARCHY",
    re: /\b(diocese|dioc[èe]se|archdiocese|archidioc[èe]se|synod|synode|conference|conf[ée]rence|presbytery|presbyt[èe]re|council of churches|bishop|[ée]v[êe]que|parish|paroisse|congregation|salvation army|arm[ée]e du salut|mennonite|catholic|anglican|united church|pentecostal|baptist|lutheran|orthodox)\b/i,
  },
  {
    key: "STATUTORY_TRANSFER",
    re: /\b(government of|gouvernement d[ue]|province of|minist(?:ry|ère) of|crown corporation|canada (?:health|social) transfer|equalization|p[ée]r[ée]quation)\b/i,
  },
];

export function nameFalsePositive(name: string | null | undefined): FalsePositiveKey | null {
  if (!name) return null;
  for (const rule of NAME_RULES) if (rule.re.test(name)) return rule.key;
  return null;
}
