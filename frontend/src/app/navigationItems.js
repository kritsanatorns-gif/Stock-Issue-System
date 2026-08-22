import {
  BarChart3,
  Building2,
  ClipboardCheck,
  History,
  LayoutDashboard,
  PackagePlus,
  PackageSearch,
  ScanBarcode,
  SlidersHorizontal,
  Store,
  Users,
} from 'lucide-react'

export const navigationItems = [
  { menuCode: 'DASHBOARD', menuId: 1, label: 'หน้าหลัก', path: '/dashboard', icon: LayoutDashboard },
  { menuCode: 'APPROVALS', menuId: 10, label: 'รายการขอเบิก', path: '/approvals', icon: ClipboardCheck },
  { menuCode: 'STOCK_OUT', menuId: 2, label: 'เบิกสินค้า', path: '/stock-issue', icon: ScanBarcode },
  { menuCode: 'STOCK_IN', menuId: 3, label: 'นำของเข้า', path: '/stock-in', icon: PackagePlus },
  { menuCode: 'STOCK_ADJUST', menuId: 9, label: 'ปรับสต๊อก', path: '/stock-adjust', icon: SlidersHorizontal },
  { menuCode: 'PRODUCTS', menuId: 4, label: 'สินค้า', path: '/products', icon: PackageSearch },
  { menuCode: 'HISTORY', menuId: 5, label: 'ประวัติ', path: '/history', icon: History },
  { menuCode: 'SUPPLIERS', menuId: 11, label: 'ผู้ขาย', path: '/suppliers', icon: Store },
  { menuCode: 'REPORTS', menuId: 6, label: 'รายงาน', path: '/reports', icon: BarChart3 },
  { menuCode: 'USERS', menuId: 7, label: 'ผู้ใช้งาน', path: '/users', icon: Users },
  { menuCode: 'DEPARTMENTS', menuId: 8, label: 'แผนก', path: '/departments', icon: Building2 },
]

export function getEmployeeMenuIds(employee) {
  const menuIds = employee?.menuIds ?? employee?.MenuIds ?? []

  if (!Array.isArray(menuIds)) {
    return []
  }

  return menuIds
    .map((menuId) => Number(menuId))
    .filter((menuId) => Number.isInteger(menuId))
}

export function isAdminEmployee(employee) {
  const role = String(employee?.role ?? employee?.Role ?? '').toLowerCase()

  return role.includes('administrator') || role.includes('admin') || role.includes('ผู้ดูแล')
}

export function getAllowedNavigationItems(employee) {
  const allowedMenuIds = getEmployeeMenuIds(employee)
  return navigationItems.filter((item) => allowedMenuIds.includes(item.menuId))
}

export function canAccessMenu(employee, menuCode) {
  const navigationItem = navigationItems.find((item) => item.menuCode === menuCode)

  if (!navigationItem) {
    return false
  }

  return getAllowedNavigationItems(employee).some((item) => item.menuId === navigationItem.menuId)
}
