import type { Paginated } from "@cosmetics/contracts";
// Quotes do not prevent spreadsheet formula execution; prefix text that could be interpreted as a formula.
export function csvContent(rows: (string | number | null)[][]): string {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((cell) => {
            let value = String(cell ?? "");
            if (
              typeof cell === "string" &&
              /^[\s]*[=+@\-]|^[\t\r\n]/.test(value)
            )
              value = "'" + value;
            return `"${value.replaceAll('"', '""')}"`;
          })
          .join(";"),
      )
      .join("\r\n")
  );
}
export function downloadCsv(
  filename: string,
  rows: (string | number | null)[][],
) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(
    new Blob([csvContent(rows)], { type: "text/csv;charset=utf-8" }),
  );
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function allPages<T>(
  fetchPage: (page: number) => Promise<Paginated<T>>,
): Promise<T[]> {
  const first = await fetchPage(1);
  const rows = [...first.items];
  for (let page = 2; page <= Math.ceil(first.total / first.pageSize); page++)
    rows.push(...(await fetchPage(page)).items);
  return rows;
}
