import { ExtensionContext } from "@foxglove/extension";

import { initSemanticTopoNavPanel } from "./SemanticTopoNavPanel";

export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({
    name: "Semantic TopoNav Panel",
    initPanel: initSemanticTopoNavPanel,
  });
}
