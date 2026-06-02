/**
 * Role-based visibility utilities
 * Use these to control what information users can see based on their role
 */

import { AuthUser } from "@/context/AuthContext";

/**
 * Check if user can view financial information
 * Only leaders should see revenue, fees, salaries, and accounting data
 */
export function canViewFinancial(user: AuthUser): boolean {
  return user.is_leader;
}

/**
 * Check if user can view accounting/billing information
 * Only leaders should see billing, payments, and accounting
 */
export function canViewAccounting(user: AuthUser): boolean {
  return user.is_leader;
}

/**
 * Check if user can manage services
 * Only leaders should manage service catalog
 */
export function canManageServices(user: AuthUser): boolean {
  return user.is_leader;
}

/**
 * Check if user can view all tasks
 * Leaders see all, managers see team + own, others see only own
 */
export function canViewAllTasks(user: AuthUser): boolean {
  return user.is_leader;
}

/**
 * Check if user can manage teams
 * Only leaders and managers can manage teams
 */
export function canManageTeams(user: AuthUser): boolean {
  return user.is_leader || user.is_manager;
}

/**
 * Check if user is sales/commercial role
 */
export function isCommercial(user: AuthUser): boolean {
  return user.role === "commercial";
}

/**
 * Get field visibility based on user role
 * Returns object indicating which fields should be visible
 */
export function getFieldVisibility(user: AuthUser) {
  return {
    financialFields: canViewFinancial(user),
    accountingFields: canViewAccounting(user),
    services: canManageServices(user),
    teamManagement: canManageTeams(user),
    allTasks: canViewAllTasks(user),
    allClients: user.is_leader,
  };
}
