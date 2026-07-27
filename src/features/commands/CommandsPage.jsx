import CommandCenter from "../../components/commands/CommandCenter.jsx";
import { feishuCommands } from "./commandCatalog.js";

export default function CommandsPage({ onRefresh }) {
  return <CommandCenter commands={feishuCommands} onRefresh={onRefresh} />;
}
