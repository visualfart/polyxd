import { Composition } from "remotion";
import { Film } from "./Film.tsx";
import { DURATION, FPS } from "./script.ts";
import "./fonts.ts";

export function Root() {
  return (
    <>
      <Composition id="Launch" component={Film} durationInFrames={DURATION * FPS} fps={FPS} width={1920} height={1080} defaultProps={{ square: false }} />
      <Composition id="LaunchSquare" component={Film} durationInFrames={DURATION * FPS} fps={FPS} width={1080} height={1080} defaultProps={{ square: true }} />
    </>
  );
}
