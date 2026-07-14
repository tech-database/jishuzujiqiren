export function normalizeCommands(commands = []) {
  return commands.map((item, index) => {
    const normalized = {
      id: `${item.title || "command"}-${index}`,
      title: item.title || "未知口令",
      command: item.command || "",
      example: item.example || "",
      result: item.result || "",
    };

    return {
      ...normalized,
      searchText: [
        normalized.title,
        normalized.command,
        normalized.example,
        normalized.result,
      ]
        .join(" ")
        .toLowerCase(),
    };
  });
}

export function filterCommands(commands = [], query = "") {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return commands;
  return commands.filter((item) => item.searchText.includes(keyword));
}

export function getCommandCopyText(command) {
  if (!command) return "";
  return command.example || command.command || command.title || "";
}
