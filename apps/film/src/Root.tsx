import { Composition } from "remotion";
import { Film } from "./Film.tsx";
import { DURATION, FPS } from "./script.ts";
import { A, B, C, FilmA, FilmB, FilmC } from "./cuts/films.tsx";
import "./fonts.ts";

export function Root() {
  return (
    <>
      <Composition id="Launch" component={Film} durationInFrames={DURATION * FPS} fps={FPS} width={1920} height={1080} defaultProps={{ square: false }} />
      <Composition id="A-TheAsk" component={FilmA} durationInFrames={A.duration * FPS} fps={FPS} width={1920} height={1080} />
      <Composition id="B-ShowDontTell" component={FilmB} durationInFrames={B.duration * FPS} fps={FPS} width={1920} height={1080} />
      <Composition id="C-HowItWorks" component={FilmC} durationInFrames={C.duration * FPS} fps={FPS} width={1920} height={1080} />
      <Composition id="LaunchSquare" component={Film} durationInFrames={DURATION * FPS} fps={FPS} width={1080} height={1080} defaultProps={{ square: true }} />
    </>
  );
}
