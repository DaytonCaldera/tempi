/**
 * Define a constant for user roles that can be used across the app
 * These are basic and general roles, more roles can be used in the database and assigned to users,
 * but these constants help ensure we have a single source of truth for role names, which helps prevent typos and makes it easier to manage roles in the future.
 */
export const ROLES = {
    SUPERADMIN: "superadmin",
    ADMIN: "admin",
    USER: "user",
    PENDING_USER: "pending_user",
    NEW_USER: "new_user",
}

/**
 * Define a constant for permissions that can be used across the app
 * This is used to ensure we have a single source of truth for permission names, which helps prevent typos and makes it easier to manage permissions in the future.
 * These permissions can be assigned to roles in the database and checked in the application logic to control access to different features and sections of the app.
 */
export const PERMISSIONS = {
    MANAGE_USERS: "manage_users",
    MANAGE_DEPTS: "manage_departments",
    VIEW_STOCK: "view_stock",
    EDIT_STOCK: "edit_inventory",
    VIEW_REPORTS: "view_reports",
    MOVE_STOCK: "move_stock",
    VIEW_ALL_CLIENTS: "view_all_clients", // Only for God Mode
}

/**
 * Placeholder clientId that older sign-ups stored before the user belonged to any organization.
 * It is not a real organization and must never be used to resolve a user's role.
 */
export const PLACEHOLDER_CLIENT_ID = "sup22";

export const isPlaceholderOrg = (org: { clientId?: { toString(): string } | null } | null | undefined) =>
    !org?.clientId || org.clientId.toString() === PLACEHOLDER_CLIENT_ID;

/** The superadmin's email from SUPERADMIN_EMAIL, lowercased. Without it nobody is superadmin (fails closed). */
export const getSuperAdminEmail = (): string | null => {
    return process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() || null;
}

/** Details shown on the privacy policy and terms pages (app/(main)/privacy, app/(main)/terms). */
export const LEGAL = {
    contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@vitalliz.com",
    // Bump when the text in the "legal" messages changes
    effectiveDate: "2026-10-23",
};

/** Permission needed to see each sidebar section (see components/dashboard/menuItems.json) */
export const sectionPermissions: Record<string, string> = {
    admin: PERMISSIONS.MANAGE_USERS,
    inventory: PERMISSIONS.VIEW_STOCK,
    reports: PERMISSIONS.VIEW_REPORTS
};

/**
 * Reasons written to stock_movements.reason. They are stored data (the reports filter on INITIAL_SYNC),
 * so the values stay as they are; the UI shows them through the "movementReasons" messages.
 * INITIAL_STOCK is the IN recorded when an item is created with a quantity, so reports can work
 * backwards from the current quantity to any past date.
 */
export const MOVEMENT_REASONS = {
    ADMIN_QUICK_ADJUSTMENT: "Ajuste rápido Admin",
    RUNNER_CONSUMPTION: "Consumo Runner",
    RESTOCK: "Reabastecimiento",
    MANUAL_ADJUSTMENT: "Ajuste manual",
    INITIAL_SYNC: "Sincronización inicial del sistema",
    INITIAL_STOCK: "Inventario inicial",
    // Written by scripts/repair-stock-movements.js for quantity changes that were never logged
    RECONCILIATION: "Conciliación de inventario",
    // Quantity set by a file import (lib/stock-import.ts) on a product that already existed
    IMPORT: "Importación de inventario",
    // Both halves of a transfer between departments (app/api/admin/inventory/[id]/transfer); movement.transfer
    // names the other department
    TRANSFER: "Transferencia entre departamentos",
    // Reverses an earlier movement (the runner Undo); reports subtract it from the column it reverses
    CORRECTION: "Corrección",
} as const;

/** Units a stock item can be counted in. Stored as-is in department_stock.unit; labels are in the "units" messages. */
/** Movements written by maintenance (sync, repair scripts), not by people: they don't count as activity. */
export const SYSTEM_REASONS = [MOVEMENT_REASONS.INITIAL_SYNC, MOVEMENT_REASONS.RECONCILIATION];

export const STOCK_UNITS =["unidades", "kg", "cajas", "litros"] as const;

/** Minimum length of the reason the superadmin types for a support tool, so every audit entry says something useful. */
export const SUPPORT_REASON_MIN_LENGTH = 10;

/** Name of the plan new organizations start on ("plans" collection). Only a fallback: it is found by key "free" */
export const DEFAULT_PLAN_NAME = "Plan Gratuito";

/** Catalog plans, cheapest first. scripts/seed-plans.js creates them; their limits are edited from /superadmin/plans */
export const PLAN_KEYS = ["free", "pro", "business"] as const;

/** Features a plan can include (plans.features). Checked with hasPlanFeature / planFeatureError (lib/plans.ts) */
export const PLAN_FEATURES = {
    // Runners only see the departments they are assigned to. Without it, they see all of them
    DEPARTMENT_ASSIGNMENT: "department_assignment",
    EXPORT_CSV: "export_csv",
    PRIORITY_SUPPORT: "priority_support",
} as const;

export type PlanFeature = typeof PLAN_FEATURES[keyof typeof PLAN_FEATURES];

/** Days a past_due subscription keeps its plan while the payment is retried */
export const BILLING_GRACE_DAYS = 7;
