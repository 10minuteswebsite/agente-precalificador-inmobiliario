import manifest from "../../module-manifest.json" with { type: "json" };
import { createRouterIntegrationV1, ROUTER_INTEGRATION_V1 } from "../application/router-integration-v1.js";

/** Stable provider-neutral entrypoint for the prequalifier module. */
export function createPrequalifierModule({ generator } = {}) {
  return Object.freeze({
    manifest,
    integration: ROUTER_INTEGRATION_V1,
    qualifyTurn: createRouterIntegrationV1({ generator }),
  });
}

export { manifest, ROUTER_INTEGRATION_V1 };
