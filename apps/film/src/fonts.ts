import { loadFont as loadBricolage } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";

// Display in Bricolage Grotesque 800, captions in Geist. Remotion waits for both before rendering a frame.
loadBricolage("normal", { weights: ["800"], subsets: ["latin"] });
loadGeist("normal", { weights: ["400", "500"], subsets: ["latin"] });
