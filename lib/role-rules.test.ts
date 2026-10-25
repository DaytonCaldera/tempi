import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "@/lib/constants";
import { cleanRoleName, covers, isCustomRole, missingPermissions, roleNameTaken, sanitizePermissions, withBuiltInDefaults } from "@/lib/role-rules";

// The admin document as seeded in the databases, before delete_stock and manage_roles existed
const storedAdmin = { manage_users: true, manage_departments: true, view_reports: true, edit_inventory: true };
const storedUser = { manage_users: false, manage_departments: false, view_reports: false, edit_inventory: false, move_stock: true, view_dashboard: true };

const manager = {
    [PERMISSIONS.MANAGE_USERS]: true, [PERMISSIONS.MANAGE_DEPTS]: true, [PERMISSIONS.EDIT_STOCK]: true,
    [PERMISSIONS.MOVE_STOCK]: true, [PERMISSIONS.VIEW_REPORTS]: true,
};

describe("withBuiltInDefaults", () => {
    it("gives admins every permission an organization can give, even ones their document predates", () => {
        const admin = withBuiltInDefaults(ROLES.ADMIN, storedAdmin);
        for (const p of ROLE_PERMISSIONS) expect(admin[p]).toBe(true);
    });

    it("lets the document take a permission away", () => {
        expect(withBuiltInDefaults(ROLES.ADMIN, { ...storedAdmin, delete_stock: false }).delete_stock).toBe(false);
    });

    it("gives runners no management permission", () => {
        const user = withBuiltInDefaults(ROLES.USER, storedUser);
        expect(user.move_stock).toBe(true);
        expect(user.delete_stock).toBeFalsy();
        expect(user.manage_roles).toBeFalsy();
    });
});

describe("covers", () => {
    const admin = withBuiltInDefaults(ROLES.ADMIN, storedAdmin);
    const runner = withBuiltInDefaults(ROLES.USER, storedUser);

    it("lets admins give any role", () => {
        expect(covers(admin, admin)).toBe(true);
        expect(covers(admin, runner)).toBe(true);
        expect(covers(admin, manager)).toBe(true);
    });

    it("keeps a manager from giving or taking away admin", () => {
        expect(covers(manager, admin)).toBe(false);
        expect(missingPermissions(admin, manager).sort()).toEqual([PERMISSIONS.DELETE_STOCK, PERMISSIONS.MANAGE_ROLES].sort());
    });

    it("lets a manager give runner and their own role", () => {
        expect(covers(manager, runner)).toBe(true);
        expect(covers(manager, manager)).toBe(true);
    });

    it("ignores permissions organizations don't give", () => {
        expect(covers(manager, { view_dashboard: true, view_all_clients: true })).toBe(true);
    });

    it("treats a missing role as no permissions", () => {
        expect(covers({}, undefined)).toBe(true);
        expect(covers(undefined, manager)).toBe(false);
    });
});

describe("sanitizePermissions", () => {
    it("keeps only the permissions organizations give, as booleans", () => {
        const clean = sanitizePermissions({ delete_stock: true, edit_inventory: "yes", view_all_clients: true });
        expect(Object.keys(clean).sort()).toEqual([...ROLE_PERMISSIONS].sort());
        expect(clean.delete_stock).toBe(true);
        expect(clean.edit_inventory).toBe(false);
        expect(clean).not.toHaveProperty("view_all_clients");
    });

    it("handles bodies that aren't objects", () => {
        expect(Object.values(sanitizePermissions(null)).every(v => v === false)).toBe(true);
    });
});

describe("role names and slugs", () => {
    it("cleans names and rejects empty or long ones", () => {
        expect(cleanRoleName("  Gerente   de  tienda ")).toBe("Gerente de tienda");
        expect(cleanRoleName("   ")).toBeNull();
        expect(cleanRoleName("x".repeat(41))).toBeNull();
        expect(cleanRoleName(42)).toBeNull();
    });

    it("finds repeated names ignoring case and accents, except the role being edited", () => {
        const roles = [{ _id: "a", name: "Gerente" }, { _id: "b", name: "Almacén" }];
        expect(roleNameTaken(roles, "gerente")).toBe(true);
        expect(roleNameTaken(roles, "ALMACEN")).toBe(true);
        expect(roleNameTaken(roles, "Gerente", "a")).toBe(false);
        expect(roleNameTaken(roles, "Cajero")).toBe(false);
    });

    it("tells custom roles from built-in ones", () => {
        expect(isCustomRole("custom_65f0c1d2e3a4b5c6d7e8f901")).toBe(true);
        expect(isCustomRole(ROLES.ADMIN)).toBe(false);
        expect(isCustomRole(undefined)).toBe(false);
    });
});
