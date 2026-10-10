import { useRef, useState } from "react";
import type { InteractiveRebaseTodoEntry, RebaseTodoItem } from "../../engine";
import { Button } from "../Button/Button";
import { Dialog } from "../Puzzle/Dialog";

interface PendingRebase {
  onto: string;
  todo: InteractiveRebaseTodoEntry[];
}

interface InteractiveRebaseDialogProps {
  /** The rebase waiting for its todo list; null closes the dialog. */
  pending: PendingRebase | null;
  branch: string;
  onConfirm: (todo: RebaseTodoItem[]) => void;
  onCancel: () => void;
}

type Action = RebaseTodoItem["action"];

/**
 * Replaces Git's todo editor. Commits stay in order; each one after the first
 * can be kept (pick) or folded into the commit above it (squash).
 */
export function InteractiveRebaseDialog({ pending, branch, onConfirm, onCancel }: InteractiveRebaseDialogProps) {
  // Keep the last rebase on screen while the dialog animates out.
  const shown = useRef(pending);
  if (pending) shown.current = pending;
  const rebase = shown.current;

  return (
    <Dialog size="wide" open={pending !== null} title="Interactive rebase" onClose={onCancel}>
      {rebase && (
        <TodoEditor
          key={rebase.todo.map((item) => item.commit).join()}
          rebase={rebase}
          branch={branch}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </Dialog>
  );
}

function TodoEditor({
  rebase,
  branch,
  onConfirm,
  onCancel,
}: {
  rebase: PendingRebase;
  branch: string;
  onConfirm: (todo: RebaseTodoItem[]) => void;
  onCancel: () => void;
}) {
  const [actions, setActions] = useState<Action[]>(() => rebase.todo.map((item) => item.action));

  function choose(index: number, action: Action) {
    setActions((current) => current.map((value, itemIndex) => (itemIndex === index ? action : value)));
  }

  function confirm() {
    onConfirm(
      rebase.todo.map((item, index) => ({
        action: actions[index],
        commit: item.commit,
      })),
    );
  }

  return (
    <>
      <p className="-mt-2 text-sm text-grey-300">
        Replaying <span className="font-secondary text-lime-400">{branch}</span> onto{" "}
        <span className="font-secondary text-lime-400">{rebase.onto}</span>, oldest commit first. Squash folds a commit
        into the one above it.
      </p>

      <ol className="flex flex-col gap-2">
        {rebase.todo.map((item, index) => (
          <li key={item.commit} className="flex items-center gap-3 rounded bg-green-900 p-2 pl-3">
            <div className="min-w-0 flex-1">
              <p className="font-secondary text-xs text-lime-400">{item.commit}</p>
              <p className="truncate text-sm text-grey-50">{item.message}</p>
            </div>
            <ActionToggle
              commit={item.commit}
              value={actions[index]}
              locked={index === 0}
              onChange={(action) => choose(index, action)}
            />
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2">
        <Button onClick={confirm}>Start rebase</Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </>
  );
}

const ACTIONS: Action[] = ["pick", "squash"];

/** Two-option switch; the first commit has nothing above it to squash into, so it stays on pick. */
function ActionToggle({
  commit,
  value,
  locked,
  onChange,
}: {
  commit: string;
  value: Action;
  locked: boolean;
  onChange: (action: Action) => void;
}) {
  return (
    <div role="radiogroup" aria-label={`Action for ${commit}`} className="flex shrink-0 rounded border border-lime-400">
      {ACTIONS.map((action) => {
        const selected = value === action;
        const disabled = locked && action !== value;
        return (
          <button
            key={action}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            title={disabled ? "The first commit has nothing above it to squash into" : undefined}
            onClick={() => onChange(action)}
            className={`flex min-h-11 w-[68px] items-center justify-center font-secondary text-xs transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
              selected
                ? "bg-lime-400 text-green-950"
                : "bg-green-950 text-lime-400 hover:bg-lime-400/10 active:bg-lime-400/20"
            }`}
          >
            {action}
          </button>
        );
      })}
    </div>
  );
}
