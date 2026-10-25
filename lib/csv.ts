import { NextResponse } from "next/server";

/**
 * Server only: file downloads (the superadmin's CSV registries and the admins' consumption report, lib/report-export.ts).
 */

/**
 * One CSV cell. Dates as ISO, quotes escaped, and text that starts like a formula (= + - @) is prefixed
 * with ' so a spreadsheet shows it instead of running it: names and emails are typed by users.
 */
export function csvCell(value: unknown): string {
    if (value === null || value === undefined) return "";
    let text = value instanceof Date ? value.toISOString() : String(value);
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A file download named `vitalliz-{name}-{today}.{extension}`. */
export function downloadResponse(name: string, extension: string, contentType: string, body: BodyInit) {
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, {
        headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="vitalliz-${name}-${date}.${extension}"`,
            "Cache-Control": "no-store",
        },
    });
}

/** A CSV file download named `vitalliz-{name}-{today}.csv`. */
export function csvResponse(name: string, header: string[], rows: unknown[][]) {
    // The BOM makes Excel read the file as UTF-8 (accents, ñ)
    const csv = "﻿" + [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
    return downloadResponse(name, "csv", "text/csv; charset=utf-8", csv);
}
