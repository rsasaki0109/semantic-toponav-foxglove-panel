import { ExtensionContext } from "@foxglove/extension";

import { initConflictsPanel } from "./ConflictsPanel";
import { initResolvePanel } from "./ResolvePanel";
import { initSemanticTopoNavPanel } from "./SemanticTopoNavPanel";

export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({
    name: "Semantic TopoNav Panel",
    initPanel: initSemanticTopoNavPanel,
  });
  extensionContext.registerPanel({
    name: "Semantic TopoNav Conflicts",
    initPanel: initConflictsPanel,
  });
  extensionContext.registerPanel({
    name: "Semantic TopoNav Resolve",
    initPanel: initResolvePanel,
  });
}
