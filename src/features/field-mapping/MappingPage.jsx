import MappingStudio from "../../components/field-mapping/MappingStudio.jsx";

export default function MappingPage({ controller: c }) {
  return (
    <MappingStudio
      bitableFields={c.bitableFields}
      fieldMappings={c.fieldMappings}
      backendFieldMap={c.status?.fieldMap || {}}
      onFieldMappingsChange={c.setFieldMappings}
      onSave={c.saveConfig}
      onLoadFields={c.checkConnection}
      saving={c.saving}
      loading={c.checking || c.configLoading}
      configReady={c.configReady}
      saveState={c.saveState}
      checkState={c.checkState}
    />
  );
}
