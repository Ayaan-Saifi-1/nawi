import { Observation } from '../models/Observation.js';
import { TestSession } from '../models/TestSession.js';
import { resolveRuleConfig } from './ruleResolver.service.js';
import { evaluateObservation } from './complianceEngine.service.js';
import { sha256 } from '../utils/hash.js';

/**
 * Compare a draft against the active rules over eligible historical A4 observations.
 * This is a regression comparison, not validation that either rule is legally correct.
 */
export async function compareRuleConfigToHistory(candidate) {
  const sessions = await TestSession.find({
    accuracyClass: candidate.accuracyClass,
    testDate: { $gte: candidate.effectiveDate },
    overallResult: { $in: ['pass', 'fail'] },
  }).select('_id accuracyClass maxCapacity scaleInterval verificationStage testDate');

  const sessionById = new Map(sessions.map((session) => [session._id.toString(), session]));
  const observations = await Observation.find({
    testSessionId: { $in: sessions.map((session) => session._id) },
    evaluationMethod: { $in: ['mpe_band', 'structured'] },
    deletedAt: null,
  }).select('_id testSessionId annexRef evaluationMethod referenceLoad indicatedValue zeroCorrection checklistPassed readings outcome');

  const changes = [];
  let compared = 0;
  let unchanged = 0;
  let changed = 0;
  let uncomparable = 0;

  for (const observation of observations) {
    const session = sessionById.get(observation.testSessionId.toString());
    try {
      const instrument = { maxCapacity: session.maxCapacity, e: session.scaleInterval };
      const proposed = evaluateObservation(observation, instrument, candidate, session.verificationStage);
      let previousOutcome = observation.outcome;
      try {
        const previousRule = await resolveRuleConfig(session.accuracyClass, session.testDate);
        previousOutcome = evaluateObservation(observation, instrument, previousRule, session.verificationStage).outcome;
      } catch (error) {
        if (error.code !== 'NO_RULE_CONFIG_FOUND') throw error;
      }
      if (!['pass', 'fail'].includes(previousOutcome)) {
        throw new Error('No prior active rule or stored outcome is available for comparison');
      }
      compared += 1;
      if (previousOutcome === proposed.outcome) {
        unchanged += 1;
      } else {
        changed += 1;
        changes.push({
          observationId: observation._id,
          sessionId: session._id,
          previousOutcome,
          proposedOutcome: proposed.outcome,
        });
      }
    } catch (error) {
      uncomparable += 1;
      changes.push({
        observationId: observation._id,
        sessionId: session?._id,
        error: error.message,
      });
    }
  }

  const summary = {
    candidateRuleId: candidate._id,
    effectiveDate: candidate.effectiveDate,
    accuracyClass: candidate.accuracyClass,
    compared,
    unchanged,
    changed,
    uncomparable,
    changes,
  };

  return {
    ...summary,
    resultHash: sha256(JSON.stringify(summary)),
  };
}
