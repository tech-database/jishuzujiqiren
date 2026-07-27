import OrderConfirmationCenter from "../../components/orders/OrderConfirmationCenter.jsx";
import { TableSelector } from "../../shared/components/TableSelector.jsx";

export default function OrderConfirmationPage({ configReady, setTargetTable, targetTable }) {
  return (
    <OrderConfirmationCenter
      configReady={configReady}
      targetTable={targetTable}
      setTargetTable={setTargetTable}
      TableSelector={TableSelector}
    />
  );
}
