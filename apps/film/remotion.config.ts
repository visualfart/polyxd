import { Config } from "@remotion/cli/config";

// The captured clips and stills live in assets/, served to the compositions as static files.
Config.setPublicDir("./assets");
Config.setOverwriteOutput(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
