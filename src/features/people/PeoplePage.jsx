import PeopleMappingCenter from "../../components/people/PeopleMappingCenter.jsx";
import { mapToNameIdRows } from "../config/config.model.js";

export default function PeoplePage({ controller: c }) {
  return (
    <PeopleMappingCenter
      rows={c.nameIdRows}
      baselineRows={mapToNameIdRows(c.configBaseline.nameIdMap)}
      loading={c.configLoading}
      saving={c.saving}
      saveState={c.saveState}
      onRowsChange={(updater) => {
        c.setNameIdRows(updater);
        c.setSaveState(null);
      }}
      onSave={c.saveConfig}
      onReset={() => {
        c.setNameIdRows(mapToNameIdRows(c.configBaseline.nameIdMap));
        c.setSaveState(null);
      }}
    />
  );
}
