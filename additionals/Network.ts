/**
 * @module    AriannANetwork
 * @author    Riccardo Angeli
 * @version   0.1.0
 * @copyright Riccardo Angeli 2024 All Rights Reserved
 * @license   AGPL-3.0 / Commercial
 *
 * HTTP, WebSocket, SSE, GraphQL helpers
 *
 * Includes: Fetch wrapper, WebSocket, SSE, GraphQL client, REST builder, Retry/timeout
 * Weight:   ~14KB gzipped
 * Deps:     none
 *
 * @example
 *   import AriannA from "../core/index.ts";
 *   import { Network } from "./Network.ts";
 *
 *   Core.use(Network);
 *
 * Usage:
 *   // After Core.use(Network), all classes are available globally
 *   // and integrate with Real, State, Observable automatically
 */

import { Core, Observable, State } from "../core/index.ts";

// ── Network Plugin ─────────────────────────────────────────────────────────────

export const Network = {
  name   : "AriannANetwork",
  version: "0.1.0",

  install(core: typeof Core, opts?: unknown): void {
    // Register Network on Core
    Object.defineProperty(window, "AriannANetwork", {
      value       : AriannANetworkAPI,
      writable    : false,
      enumerable  : false,
      configurable: false,
    });
  },
};

// ── Network API ────────────────────────────────────────────────────────────────

const AriannANetworkAPI = {

  // TODO: implement Fetch wrapper, WebSocket, SSE ...

};

export default Network;
