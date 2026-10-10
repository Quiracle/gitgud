import { motion } from "motion/react";
import { spring } from "../../lib/motion";
import type { LessonIntro as LessonIntroData } from "../../puzzles/learnBasics/types";
import { Icon } from "../Icon/Icon";

interface LessonIntroProps {
  commands: string[];
  intro: LessonIntroData;
}

/** Body of the lesson explainer popup: the command, how it works, and the task. */
export function LessonIntro({ commands, intro }: LessonIntroProps) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap gap-1">
        {commands.map((command) => (
          <code key={command} className="rounded bg-green-900 px-2 py-1 font-secondary text-xs text-lime-400">
            {command}
          </code>
        ))}
      </div>
      <p className="text-grey-50">{intro.what}</p>
      <div className="flex flex-col gap-2">
        <h3 className="text-xs leading-[15px] text-grey-400">How it works</h3>
        <ol className="flex flex-col gap-2 text-grey-300">
          {intro.how.map((step, index) => (
            <motion.li
              key={step}
              className="flex gap-2"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring.soft, delay: 0.12 + index * 0.06 }}
            >
              <span className="text-lime-400">{index + 1}.</span>
              <span>{step}</span>
            </motion.li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col gap-1 rounded border border-lime-400/40 bg-lime-400/5 p-3">
        <span className="flex items-center gap-1 text-xs leading-[15px] text-lime-400">
          <Icon name="flag_2" size={16} />
          Your task
        </span>
        <p className="text-grey-50">{intro.task}</p>
      </div>
    </div>
  );
}
