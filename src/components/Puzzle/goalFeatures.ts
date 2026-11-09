import { getSnapshot, type Repository, type SemanticState } from "../../engine";
import { chickenLookFromState, type ChickenLook, type ChickenPart, type ChickenTint } from "../Illustration/PixelChicken";

export type ChickenFeature = "body" | ChickenPart;

/** Reading order of the goal checklist: the chicken first, then accessories head to toe. */
const FEATURE_ORDER: ChickenFeature[] = ["body", "hat", "sunglasses", "crest", "scarf", "longLegs"];

/** What a feature looks like: absent ("none"), a colour, or the Figma default colours. */
export type FeatureValue = ChickenTint | "none";

export interface FeatureGoal {
  feature: ChickenFeature;
  target: FeatureValue;
  met: boolean;
}

function featureValue(look: ChickenLook, feature: ChickenFeature): FeatureValue {
  if (feature === "body") return look.chicken ? look.body : "none";
  return look.parts[feature] ?? "none";
}

/**
 * One checklist line per chicken feature the puzzle is about: every feature the target
 * shows plus every feature some commit in the starting repository changes. The list is
 * fixed for the whole run; only `met` follows the player's current `branch` snapshot.
 */
export function chickenFeatureGoals(
  initialRepository: Repository,
  targetSnapshot: SemanticState,
  repository: Repository,
  branch: string,
): FeatureGoal[] {
  const targetLook = chickenLookFromState(targetSnapshot);
  const touched = new Set<string>();
  for (const commit of Object.values(initialRepository.commits)) {
    for (const change of commit.changes) {
      if ("property" in change) touched.add(change.property);
    }
  }
  const tip = repository.branches[branch];
  const currentLook = tip ? chickenLookFromState(getSnapshot(repository, tip)) : null;
  return FEATURE_ORDER.filter((feature) => featureValue(targetLook, feature) !== "none" || touched.has(feature)).map(
    (feature) => {
      const target = featureValue(targetLook, feature);
      return { feature, target, met: currentLook !== null && featureValue(currentLook, feature) === target };
    },
  );
}
