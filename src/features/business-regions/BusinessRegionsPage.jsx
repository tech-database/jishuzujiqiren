import BusinessRegionsCenter from "../../components/business-regions/BusinessRegionsCenter.jsx";
import { mapToBusinessRegionRows } from "../config/config.model.js";

export default function BusinessRegionsPage({ controller: c }) {
  return (
    <BusinessRegionsCenter
      rows={c.businessRegionRows}
      baselineRows={mapToBusinessRegionRows(c.configBaseline.businessRegionMap)}
      loading={c.configLoading}
      saving={c.saving}
      saveState={c.saveState}
      onRowsChange={(updater) => {
        c.setBusinessRegionRows(updater);
        c.setSaveState(null);
      }}
      onSave={c.saveConfig}
      onReset={() => {
        c.setBusinessRegionRows(mapToBusinessRegionRows(c.configBaseline.businessRegionMap));
        c.setSaveState(null);
      }}
    />
  );
}
