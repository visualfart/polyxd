/**
 * The launch film, scene by scene, on SCRIPT.md's timecodes. Times are seconds on the composition's
 * clock; each scene is a Sequence and works in its own seconds from 0. The wide (1920×1080) and
 * square (1080×1080) cuts are the same scenes re-framed through `useLayout()`. The sound is one
 * layer over everything, from script.ts's cues.
 */
import { AbsoluteFill, Sequence } from "remotion";
import { PAPER } from "./brand.tsx";
import { Mix } from "./audio.tsx";
import { T } from "./script.ts";
import { LayoutProvider, s } from "./ui.tsx";
import { Hook, Reversal, TheLine } from "./scenes/open.tsx";
import { Arrives, Meaning } from "./scenes/halden.tsx";
import { Agents, Checked } from "./scenes/checked.tsx";
import { Authored, Close, Turn, Yours } from "./scenes/rest.tsx";

const SCENES: [string, React.FC, number, number][] = [
  ["Hook", Hook, T.hook, T.line],
  ["The line", TheLine, T.line, T.reversal],
  ["The reversal", Reversal, T.reversal, T.arrives],
  ["The screen arrives", Arrives, T.arrives, T.meaning],
  ["Meaning, not pixels", Meaning, T.meaning, T.checked],
  ["Checked", Checked, T.checked, T.agents],
  ["People and agents", Agents, T.agents, T.turn],
  ["The turn", Turn, T.turn, T.authored],
  ["Generated or authored", Authored, T.authored, T.yours],
  ["Yours", Yours, T.yours, T.close],
  ["Close", Close, T.close, T.end],
];

export function Film({ square }: { square: boolean }) {
  const layout = square ? { w: 1080, h: 1080, square: true } : { w: 1920, h: 1080, square: false };
  return (
    <LayoutProvider value={layout}>
      <AbsoluteFill style={{ backgroundColor: PAPER }}>
        {SCENES.map(([name, C, from, to]) => (
          <Sequence key={name} from={s(from)} durationInFrames={s(to) - s(from)} name={name}>
            <C />
          </Sequence>
        ))}
        <Mix />
      </AbsoluteFill>
    </LayoutProvider>
  );
}
