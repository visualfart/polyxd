/**
 * The mix: one music track (assets/music.wav, a single import, swap the file to swap the track)
 * and every cue in script.ts's CUES placed at its second. The music file peaks at −12 dBFS and the
 * cues at −18 dBFS, so the levels live in the files and `gain` is only a nudge per cue.
 */
import { Audio, Sequence, staticFile } from "remotion";
import { CUES, DURATION } from "./script.ts";
import { s } from "./ui.tsx";

const MUSIC = staticFile("music.wav");

export function Mix() {
  return (
    <>
      <Audio src={MUSIC} volume={1} />
      {CUES.map((c, i) => (
        <Sequence key={i} from={s(c.at)} durationInFrames={Math.max(1, s(DURATION - c.at))} name={`sfx ${c.sfx}`}>
          <Audio src={staticFile(`sfx/${c.sfx}.wav`)} volume={c.gain ?? 1} />
        </Sequence>
      ))}
    </>
  );
}
