import { NextResponse } from "next/server";

/**
 * Server only: CSV downloads (the superadmin's registries and the admins' consumption report).
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

/** A CSV file download named `vitalliz-{name}-{today}.csv`. */
export function csvResponse(name: string, header: string[], rows: unknown[][]) {
    const date = new Date().toISOString().slice(0, 10);
    // The BOM makes Excel read the file as UTF-8 (accents, ñ)
    const csv = "﻿" + [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
    return new NextResponse(csv, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="vitalliz-${name}-${date}.csv"`,
            "Cache-Control": "no-store",
        },
    });
}
