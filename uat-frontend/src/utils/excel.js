let xlsxModulePromise;

export async function getXLSX() {
	if (!xlsxModulePromise) {
		xlsxModulePromise = import("xlsx");
	}
	return xlsxModulePromise;
}

export function normalizeExcelHeader(value) {
	return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function formatExportDateTime(value) {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value);
	return date.toLocaleString();
}

function appendSheet(XLSX, workbook, name, rows) {
	const sheetRows = rows.length > 0 ? rows : [{ Info: "No data" }];
	const sheet = XLSX.utils.json_to_sheet(sheetRows);
	XLSX.utils.book_append_sheet(workbook, sheet, name);
}

export async function downloadWorkbook(filename, sheets) {
	const XLSX = await getXLSX();
	const workbook = XLSX.utils.book_new();
	sheets.forEach(sheet => appendSheet(XLSX, workbook, sheet.name, sheet.rows));
	XLSX.writeFileXLSX(workbook, filename);
}
