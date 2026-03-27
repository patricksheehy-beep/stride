/**
 * Scoring Web Worker.
 * Runs RouteScorer.scoreAndRank off the main thread to keep UI responsive
 * during Turf.js geometric calculations.
 *
 * Protocol:
 *   postMessage({ candidates, startPoint, weights }) =>
 *   postMessage(rankedResults) | postMessage({ error: string })
 *
 * ESM module worker -- Vite handles bundling with { type: 'module' }.
 */
import { RouteScorer } from './scorer.js';

self.onmessage = function (e) {
  try {
    const { candidates, startPoint, weights } = e.data;

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      self.postMessage({ error: 'Invalid or empty candidates array' });
      return;
    }

    const scorer = new RouteScorer(weights);
    const rankedResults = scorer.scoreAndRank(candidates, startPoint);

    self.postMessage(rankedResults);
  } catch (err) {
    self.postMessage({ error: err.message || 'Unknown worker error' });
  }
};
