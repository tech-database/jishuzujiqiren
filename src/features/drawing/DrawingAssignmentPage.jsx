import DrawingAssignmentCenter from "../../components/assignment/DrawingAssignmentCenter.jsx";

export default function DrawingAssignmentPage({ configReady, controller: c, nameIdRows }) {
  return (
    <DrawingAssignmentCenter
      claimForm={c.claimForm}
      nameIdRows={nameIdRows}
      claimState={c.claimState}
      claimQueryResult={c.claimQueryResult}
      claiming={c.claiming}
      completingDrawing={c.completingDrawing}
      queryingClaims={c.queryingClaims}
      configReady={configReady}
      updateClaimForm={c.updateClaimForm}
      removeMaterialCode={c.removeClaimMaterialCode}
      clearClaimForm={c.clearClaimForm}
      claimDrawing={c.claimDrawing}
      completeDrawing={c.completeDrawing}
      queryDrawingClaims={c.queryDrawingClaims}
    />
  );
}
