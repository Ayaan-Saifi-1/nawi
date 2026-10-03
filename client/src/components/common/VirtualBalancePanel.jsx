import React, { useMemo, useState } from 'react';
import { Activity, Info, Minus, Plus, RotateCcw, Ruler } from 'lucide-react';
import { createWeightDenominations, sumWeightBlocks } from './weightBlocks.js';
import './VirtualBalancePanel.css';

export default function VirtualBalancePanel({ onApply, unit = 'kg', maxCapacity, scaleInterval }) {
  const denominations = useMemo(
    () => createWeightDenominations(maxCapacity, scaleInterval),
    [maxCapacity, scaleInterval],
  );
  const [blockCounts, setBlockCounts] = useState({});
  const [error, setError] = useState('0');
  const [stable, setStable] = useState(true);
  const referenceLoad = useMemo(() => sumWeightBlocks(blockCounts), [blockCounts]);
  const hasSelectedBlocks = referenceLoad > 0;

  const indicatedValue = useMemo(() => {
    const offset = Number(error);
    return Number.isFinite(offset) ? Number((referenceLoad + offset).toPrecision(12)) : null;
  }, [referenceLoad, error]);

  const canApply = stable
    && hasSelectedBlocks
    && indicatedValue !== null
    && Number.isFinite(Number(error))
    && referenceLoad <= Number(maxCapacity);

  const adjustBlockCount = (weight, difference) => {
    const weightKey = String(weight);
    setBlockCounts((counts) => {
      const nextCount = Math.max(0, Math.min(20, (counts[weightKey] || 0) + difference));
      if (nextCount === 0) {
        const { [weightKey]: _removed, ...remaining } = counts;
        return remaining;
      }
      return { ...counts, [weightKey]: nextCount };
    });
  };

  const resetBlocks = () => setBlockCounts({});

  return (
    <section id="virtual-balance-panel" className="virtual-balance" data-testid="virtual-balance-panel" aria-labelledby="virtual-balance-title">
      <header className="virtual-balance-header">
        <div className="virtual-balance-heading">
          <span className="virtual-balance-icon"><Ruler size={19} aria-hidden="true" /></span>
          <div>
            <h5 id="virtual-balance-title">Virtual balance simulator</h5>
            <p>Practice a scale reading without connecting physical hardware.</p>
          </div>
        </div>
        <span className="virtual-balance-badge"><Activity size={13} aria-hidden="true" /> Demo tool</span>
      </header>

      <div className="virtual-balance-content">
        <div className="virtual-balance-notice" role="note">
          <Info size={17} aria-hidden="true" />
          <p>
            Add calibration-weight blocks to the pan. Their combined mass becomes the applied load; the simulated scale adds the configured error to show its indication. This is a visual simulator, not a physical scale connection.
          </p>
        </div>

        <div className="virtual-balance-fields">
          <div className="gov-form-group">
            <label className="gov-label" htmlFor="virtual-error">Simulated indication error <span>({unit})</span></label>
            <input
              id="virtual-error"
              className="gov-input"
              type="number"
              step="any"
              value={error}
              onChange={(event) => setError(event.target.value)}
              aria-describedby="virtual-error-help"
            />
            <small id="virtual-error-help">Added to the block total; negative values simulate under-reading.</small>
          </div>
          <div className="gov-form-group">
            <label className="gov-label" htmlFor="virtual-stability">Reading stability</label>
            <select
              id="virtual-stability"
              className="gov-select"
              value={stable ? 'stable' : 'unstable'}
              onChange={(event) => setStable(event.target.value === 'stable')}
            >
              <option value="stable">Stable</option>
              <option value="unstable">Unstable</option>
            </select>
            <small>Unstable readings cannot be copied.</small>
          </div>
        </div>

        <section className="virtual-balance-blocks" aria-labelledby="virtual-balance-blocks-title">
          <div className="virtual-balance-blocks-heading">
            <div>
              <h6 id="virtual-balance-blocks-title">Calibration weights</h6>
              <p>Tap + to place a block on the scale pan.</p>
            </div>
            <button type="button" className="virtual-balance-reset" onClick={resetBlocks} disabled={!hasSelectedBlocks}>
              <RotateCcw size={14} /> Clear
            </button>
          </div>
          {denominations.length ? (
            <div className="virtual-balance-weight-list">
              {denominations.map((weight) => {
                const count = blockCounts[String(weight)] || 0;
                return (
                  <div className={`virtual-weight-option ${count > 0 ? 'is-selected' : ''}`} key={weight}>
                    <button
                      type="button"
                      className="virtual-weight-button"
                      aria-label={`Add ${weight} ${unit} calibration weight`}
                      onClick={() => adjustBlockCount(weight, 1)}
                      disabled={referenceLoad + weight > Number(maxCapacity)}
                    >
                      <span className="virtual-weight-block" aria-hidden="true" />
                      <strong>{weight}</strong>
                      <small>{unit}</small>
                    </button>
                    {count > 0 && (
                      <div className="virtual-weight-quantity" aria-label={`${count} blocks of ${weight} ${unit}`}>
                        <button type="button" aria-label={`Remove one ${weight} ${unit} block`} onClick={() => adjustBlockCount(weight, -1)}>
                          <Minus size={12} />
                        </button>
                        <span>{count}</span>
                        <button type="button" aria-label={`Add one ${weight} ${unit} block`} onClick={() => adjustBlockCount(weight, 1)} disabled={referenceLoad + weight > Number(maxCapacity)}>
                          <Plus size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="virtual-balance-no-weights">Weight blocks are unavailable because the instrument capacity or verification interval is missing.</p>
          )}
        </section>

        <div className="virtual-balance-device-wrap">
          <div className="virtual-balance-pan" aria-label={`${Object.values(blockCounts).reduce((sum, count) => sum + count, 0)} weight blocks on scale`}>
            <span className="virtual-balance-pan-platform" />
            <span className="virtual-balance-pan-surface">
              {Object.entries(blockCounts).flatMap(([weight, count]) => Array.from({ length: count }, (_, index) => (
                <span key={`${weight}-${index}`} className="virtual-pan-weight">
                  <span>{weight}</span><small>{unit}</small>
                </span>
              )))}
              {!hasSelectedBlocks && <span className="virtual-pan-empty">Add weight blocks</span>}
            </span>
            <span className="virtual-balance-pan-platform" />
          </div>
          <div className="virtual-balance-device" aria-live="polite" aria-atomic="true">
            <div className="virtual-balance-device-top">
              <span><Ruler size={14} aria-hidden="true" /> VIRTUAL SCALE</span>
              <span className={stable ? 'device-status stable' : 'device-status unstable'}>
                {stable ? 'STABLE' : 'UNSTABLE'}
              </span>
            </div>
            <div className="virtual-balance-display">
              <span>{stable ? 'WEIGHT' : 'WAIT'}</span>
              <strong>{stable && indicatedValue !== null ? indicatedValue : '----'}</strong>
              <small>{unit}</small>
            </div>
            <div className="virtual-balance-device-bottom">
              <span className="device-indicator" />
              <span>SIMULATED · NOT CONNECTED TO HARDWARE</span>
            </div>
          </div>
          <p className="virtual-balance-reading-caption">
            {stable
              ? hasSelectedBlocks
                ? `${referenceLoad} ${unit} total block mass + ${error || '0'} ${unit} simulated error.`
                : 'Add one or more calibration weights to show an applied load.'
              : 'The unstable state is shown for demonstration. Unstable readings cannot be copied.'}
          </p>
        </div>

        <div className="virtual-balance-actions">
          <span>
            {hasSelectedBlocks
              ? `${Object.values(blockCounts).reduce((sum, count) => sum + count, 0)} block(s) · ${referenceLoad} ${unit} applied load`
              : 'Add calibration weights to continue.'}
          </span>
          <button
            type="button"
            className="gov-btn gov-btn-primary"
            data-testid="virtual-balance-apply"
            disabled={!canApply}
            onClick={() => onApply({ referenceLoad: Number(referenceLoad), indicatedValue })}
          >
            Use this reading
          </button>
        </div>
      </div>
    </section>
  );
}
