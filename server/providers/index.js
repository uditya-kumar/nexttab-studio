// Picks the active social API provider. To switch providers, add a folder next to
// zernio/ that exports the same contract and change this import.
import zernio from "./zernio/index.js";

export const provider = zernio;
