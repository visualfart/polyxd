import { loadFont as loadBricolage } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";
import { loadFont as loadPlex } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadNunito } from "@remotion/google-fonts/Nunito";
import { loadFont as loadPatrick } from "@remotion/google-fonts/PatrickHand";
import { loadFont as loadSourceSans } from "@remotion/google-fonts/SourceSans3";

// The film's own type: display in Bricolage Grotesque 800, captions in Geist, code in Geist Mono,
// the handwritten label in Caveat. Then the faces the packs name, so the real renders set in their
// own fonts: Roboto (Material 3), IBM Plex Sans (Carbon), Inter (Polaris, Chakra), Source Sans 3
// (Spectrum's fallback), Nunito and Patrick Hand (Sketch). Remotion waits for all of them.
loadBricolage("normal", { weights: ["700", "800"], subsets: ["latin"] });
loadGeist("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
loadGeistMono("normal", { weights: ["400", "500"], subsets: ["latin"] });
loadCaveat("normal", { weights: ["700"], subsets: ["latin"] });
loadRoboto("normal", { weights: ["400", "500"], subsets: ["latin"] });
loadPlex("normal", { weights: ["400", "600"], subsets: ["latin"] });
loadInter("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
loadNunito("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });
loadPatrick("normal", { weights: ["400"], subsets: ["latin"] });
loadSourceSans("normal", { weights: ["400", "600"], subsets: ["latin"] });
