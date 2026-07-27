import ConnectionManagementCenter from "../../components/connection/ConnectionManagementCenter.jsx";
import { TableSelector } from "../../shared/components/TableSelector.jsx";

export default function ConfigPage({
  controller: c,
  formatDisplayTime,
  setTargetTable,
  targetTable,
}) {
  return (
    <ConnectionManagementCenter
      configReady={c.configReady}
      healthStatus={c.healthStatus}
      healthLoading={c.healthLoading}
      bitableFields={c.bitableFields}
      targetTable={targetTable}
      setTargetTable={setTargetTable}
      TableSelector={TableSelector}
      config={c.config}
      configBaseline={c.configBaseline}
      updateConfig={c.updateConfig}
      resetConfig={c.resetConfigChanges}
      copyConfigValue={c.copyConfigValue}
      copiedField={c.copiedField}
      checkState={c.checkState}
      saveState={c.saveState}
      saving={c.saving}
      savingConfig={c.savingConfig}
      checking={c.checking}
      refreshingConfig={c.refreshingConfig}
      saveConfig={c.saveConfig}
      checkConnection={c.checkConnection}
      forceRefreshConfig={c.forceRefreshConfig}
      formatDisplayTime={formatDisplayTime}
    />
  );
}
