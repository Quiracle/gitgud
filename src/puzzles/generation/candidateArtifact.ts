import { CHICKEN_V2_SEMANTIC_POLICY } from "../chickenTheme";
import { validatePuzzleCandidate } from "../validateCandidate";
import type { PuzzleCandidate, PuzzleDifficulty } from "../types";
import { fingerprintDecisionCore } from "./decisionCore";
import { fingerprintMechanics } from "./novelty";
import { findCopyOnlySolution, proofHasSequentialCopies, solutionCommandPattern } from "./proceduralQuality";
import type { ProposalVerdict } from "./proceduralCertification";

export interface CandidateCertificate {
  sourceFingerprint: string;
  mechanicsDigest: string;
  evaluatorVersion: 1;
  minimumCommands: number;
  excludedThroughDepth: number;
  proofCommands: number;
  copyOnlyExcludedThroughDepth: number;
}

export interface CandidateNovelty {
  mechanicsHash: string;
  decisionCoreHash: string;
  commandPattern: string;
}

export interface ProceduralCandidateArtifact {
  formatVersion: 1;
  id: string;
  candidate: PuzzleCandidate;
  certificate: CandidateCertificate;
  novelty: CandidateNovelty;
}

export interface CandidateArtifactVerification {
  sourceFingerprint: string;
}

const MINIMUM_COMMANDS: Record<PuzzleDifficulty, number> = { easy: 2, medium: 4, hard: 6 };
const MAXIMUM_PROOF_COMMANDS: Record<PuzzleDifficulty, number> = { easy: 2, medium: 4, hard: 10 };
const FINGERPRINT = /^[a-f0-9]{64}$/;

/**
 * Create a private serialized result from a trusted offline certification run.
 * The artifact digest binds mechanics and proof; it cannot establish that an
 * exhaustive search actually ran. Never accept model or browser supplied artifacts.
 */
export async function createCandidateArtifact(
  verdict: ProposalVerdict,
  options: { sourceFingerprint: string; excludedThroughDepth: number },
): Promise<ProceduralCandidateArtifact> {
  if (!verdict || verdict.status !== "certified") throw new Error("Candidate artifact requires a certified proposal verdict.");
  validateCertificateInputs(options.sourceFingerprint, options.excludedThroughDepth);
  const candidate = structuredClone(verdict.candidate);
  const validated = validateCandidate(candidate);
  const minimumCommands = MINIMUM_COMMANDS[candidate.difficulty];
  if (options.excludedThroughDepth < minimumCommands - 1 || options.excludedThroughDepth >= candidate.solutionCommands.length) throw new Error("Candidate artifact requires consistent complete shortcut exclusion.");
  if (validated.value.puzzle.parCommands !== candidate.solutionCommands.length || candidate.solutionCommands.length < minimumCommands ||
      candidate.solutionCommands.length > MAXIMUM_PROOF_COMMANDS[candidate.difficulty]) {
    throw new Error("Candidate proof does not match the certified difficulty threshold.");
  }
  verifyStrategicAndCopyPolicy(candidate, candidate.solutionCommands.length, true);
  const mechanicsDigest = await sha256(canonicalJson(mechanicsProjection(candidate)));
  const novelty = await makeNovelty(candidate);
  return {
    formatVersion: 1,
    id: mechanicsDigest,
    candidate,
    certificate: {
      sourceFingerprint: options.sourceFingerprint,
      mechanicsDigest,
      evaluatorVersion: 1,
      minimumCommands,
      excludedThroughDepth: options.excludedThroughDepth,
      proofCommands: candidate.solutionCommands.length,
      copyOnlyExcludedThroughDepth: candidate.difficulty === "easy" ? 0 : candidate.solutionCommands.length,
    },
    novelty,
  };
}

/**
 * Recheck a private artifact before use. Its digest detects alteration, while
 * sourceFingerprint ties it to the verifier's trusted source version. Neither
 * check proves that the claimed exhaustive offline search really occurred.
 */
export async function verifyCandidateArtifact(
  value: unknown,
  trusted: CandidateArtifactVerification,
): Promise<ProceduralCandidateArtifact> {
  validateCertificateInputs(trusted?.sourceFingerprint, 0);
  if (!isRecord(value) || value.formatVersion !== 1 || typeof value.id !== "string" ||
      !isRecord(value.candidate) || !isRecord(value.certificate) || !isRecord(value.novelty)) {
    throw new Error("Malformed candidate artifact.");
  }
  const artifact = value as unknown as ProceduralCandidateArtifact;
  const { candidate, certificate } = artifact;
  validateCertificateInputs(certificate.sourceFingerprint, certificate.excludedThroughDepth);
  if (certificate.sourceFingerprint !== trusted.sourceFingerprint) throw new Error("Candidate artifact source fingerprint is not trusted.");
  if (certificate.evaluatorVersion !== 1 || !Number.isInteger(certificate.minimumCommands) ||
      !Number.isInteger(certificate.proofCommands)) throw new Error("Malformed candidate certificate metadata.");
  const validated = validateCandidate(candidate);
  const minimumCommands = MINIMUM_COMMANDS[candidate.difficulty];
  if (certificate.minimumCommands !== minimumCommands || certificate.excludedThroughDepth < minimumCommands - 1 || certificate.excludedThroughDepth >= candidate.solutionCommands.length ||
      certificate.proofCommands !== candidate.solutionCommands.length || candidate.solutionCommands.length < minimumCommands ||
      candidate.solutionCommands.length > MAXIMUM_PROOF_COMMANDS[candidate.difficulty] ||
      validated.value.puzzle.parCommands !== candidate.solutionCommands.length) {
    throw new Error("Candidate artifact certificate does not match its proof or difficulty.");
  }
  if (certificate.copyOnlyExcludedThroughDepth !== (candidate.difficulty === "easy" ? 0 : candidate.solutionCommands.length)) throw new Error("Missing offline copy-only exclusion.");
  // The private artifact's trusted offline certificate supplies search evidence;
  // runtime verifies binding and replays proofs without repeating graph search.
  verifyStrategicAndCopyPolicy(candidate, candidate.solutionCommands.length, false);
  const mechanicsDigest = await sha256(canonicalJson(mechanicsProjection(candidate)));
  if (artifact.id !== mechanicsDigest || certificate.mechanicsDigest !== mechanicsDigest) throw new Error("Candidate artifact mechanics digest mismatch.");
  const novelty = await makeNovelty(candidate);
  if (!isRecord(artifact.novelty) || artifact.novelty.mechanicsHash !== novelty.mechanicsHash ||
      artifact.novelty.decisionCoreHash !== novelty.decisionCoreHash || artifact.novelty.commandPattern !== novelty.commandPattern) {
    throw new Error("Candidate artifact novelty metadata mismatch.");
  }
  return artifact;
}

/** Canonical JSON used by the artifact digest; arrays retain semantic order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortRecursively(value));
}

async function makeNovelty(candidate: PuzzleCandidate): Promise<CandidateNovelty> {
  const mechanics = fingerprintMechanics(candidate.initialRepository, candidate.target).canonical;
  const core = fingerprintDecisionCore(candidate);
  return {
    mechanicsHash: await sha256(mechanics),
    decisionCoreHash: await sha256(core),
    commandPattern: solutionCommandPattern(candidate),
  };
}

function mechanicsProjection(candidate: PuzzleCandidate) {
  const commits = Object.fromEntries(Object.entries(candidate.initialRepository.commits).map(([id, commit]) => {
    const { message: _excludedMessage, ...mechanics } = commit;
    return [id, mechanics];
  }));
  return {
    schemaVersion: candidate.schemaVersion,
    themeId: candidate.themeId,
    difficulty: candidate.difficulty,
    initialRepository: { ...candidate.initialRepository, commits },
    target: candidate.target,
    allowedCommands: candidate.allowedCommands,
    solutionCommands: candidate.solutionCommands,
  };
}

function validateCandidate(candidate: PuzzleCandidate) {
  if (!candidate || candidate.kind !== "daily" || !candidate.solutionCommands || !Array.isArray(candidate.solutionCommands)) {
    throw new Error("Artifact candidate must be a daily puzzle with a private proof.");
  }
  const result = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
  if (!result.ok) throw new Error(`Candidate failed normal puzzle validation: ${result.issues.map(issue => issue.code).join(", ")}`);
  return result;
}

function verifyStrategicAndCopyPolicy(candidate: PuzzleCandidate, minimumCommands: number, search: boolean) {
  if (candidate.difficulty === "easy") return;
  if (!solutionCommandPattern(candidate).split(" → ").some(type => ["merge", "rebase", "interactive-rebase", "squash"].includes(type))) throw new Error("Medium and hard candidates need an integration or rebase proof.");
  if (proofHasSequentialCopies(candidate)) throw new Error("Candidate proof repeats predecessor cherry-picks.");
  const copyOnly = search ? findCopyOnlySolution(candidate, minimumCommands) : undefined;
  if (copyOnly && copyOnly.length <= minimumCommands) throw new Error("Candidate has an equally short copy-only solution.");
}

function validateCertificateInputs(sourceFingerprint: unknown, excludedThroughDepth: unknown): asserts sourceFingerprint is string {
  if (typeof sourceFingerprint !== "string" || !FINGERPRINT.test(sourceFingerprint)) throw new Error("Invalid candidate source fingerprint.");
  if (!Number.isInteger(excludedThroughDepth) || (excludedThroughDepth as number) < 0) throw new Error("Invalid certified search depth.");
}

function sortRecursively(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortRecursively);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortRecursively((value as Record<string, unknown>)[key])]));
  }
  return value;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
