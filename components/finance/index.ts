/**
 * @module    components/finance
 * @author    Riccardo Angeli
 * @copyright Riccardo Angeli 2012-2026
 * @license   MIT / Commercial (dual license)
 *
 * A.r.i.a.n.n.A. Finance Components — barrel export.
 *
 * Import individual components for tree-shaking:
 *   import { CandlestickChart } from '.../components/finance/CandlestickChart.ts';
 *
 * Or import the full bundle:
 *   import { FinanceComponents } from '.../components/finance/index.ts';
 */

export { CandlestickChart }            from './CandlestickChart.ts';
export type { CandlestickChartOptions } from './CandlestickChart.ts';

export { LineChart }                   from './LineChart.ts';
export type { LineChartSeries }         from './LineChart.ts';

export { DepthChart }                  from './DepthChart.ts';

export { HeatmapChart }                from './HeatmapChart.ts';

export { PortfolioDonut }              from './PortfolioDonut.ts';

export { PnLChart }                    from './PnLChart.ts';

export { RiskGauge }                   from './RiskGauge.ts';

export { OrderBook }                   from './OrderBook.ts';

export { Screener }                    from './Screener.ts';
export type { ScreenerRow }            from './Screener.ts';

export { Sparkline }                   from './Sparkline.ts';

export { AlertBadge }                  from './AlertBadge.ts';
export type { AlertLevel }             from './AlertBadge.ts';

// ── Convenience bundle ────────────────────────────────────────────────────────

import { CandlestickChart }   from './CandlestickChart.ts';
import { LineChart }           from './LineChart.ts';
import { DepthChart }          from './DepthChart.ts';
import { HeatmapChart }        from './HeatmapChart.ts';
import { PortfolioDonut }      from './PortfolioDonut.ts';
import { PnLChart }            from './PnLChart.ts';
import { RiskGauge }           from './RiskGauge.ts';
import { OrderBook }           from './OrderBook.ts';
import { Screener }            from './Screener.ts';
import { Sparkline }           from './Sparkline.ts';
import { AlertBadge }          from './AlertBadge.ts';

export const FinanceComponents = {
    CandlestickChart, LineChart, DepthChart, HeatmapChart,
    PortfolioDonut, PnLChart, RiskGauge,
    OrderBook, Screener, Sparkline, AlertBadge,
};

export default FinanceComponents;
