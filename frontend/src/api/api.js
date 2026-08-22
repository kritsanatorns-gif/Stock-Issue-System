import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken')
    const expiresAt = Number(localStorage.getItem('authExpiresAt') ?? 0)

    if (token && expiresAt && expiresAt <= Date.now()) {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('authExpiresAt')

      return Promise.reject(new Error('Session expired.'))
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error),
)

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
)

export async function login(credentials) {
  const response = await api.post('/auth/login', {
    employeeCode: credentials.employeeCode ?? credentials.employeeId,
    password: credentials.password,
  })

  return response.data
}

export async function getEmployees() {
  const response = await api.get('/employee')

  return response.data
}

export async function createEmployee(employee) {
  const response = await api.post('/employee', employee)

  return response.data
}

export async function updateEmployee(employeeId, employee) {
  const response = await api.put(`/employee/${employeeId}`, employee)

  return response.data
}

export async function getEmployeePermissions() {
  const response = await api.get('/employee/permissions')

  return response.data
}

export async function getEmployeeStatuses() {
  const response = await api.get('/employee/statuses')

  return response.data
}

export async function getEmployeeMenus() {
  const response = await api.get('/employee/menus')

  return response.data
}

export async function getDepartments() {
  const response = await api.get('/departments')

  return response.data
}

export async function getHrEmployee(employeeCode, department = '') {
  const response = await api.get(`/hr-employees/${encodeURIComponent(employeeCode)}`, {
    params: department ? { department } : {},
  })

  return response.data
}

export async function getHrEmployees(department) {
  const response = await api.get('/hr-employees', { params: { department } })

  return response.data
}

export async function getCategories() {
  const response = await api.get('/categories')

  return response.data
}

export async function createCategory(category) {
  const response = await api.post('/categories', category)

  return response.data
}

export async function updateCategory(categoryId, category) {
  const response = await api.put(`/categories/${categoryId}`, category)

  return response.data
}

export async function createDepartment(department) {
  const response = await api.post('/departments', department)

  return response.data
}

export async function updateDepartment(departmentId, department) {
  const response = await api.put(`/departments/${departmentId}`, department)

  return response.data
}

export async function getProducts(params = {}) {
  const response = await api.get('/products', { params })

  return response.data
}

export async function createProduct(product) {
  const response = await api.post('/products', product)

  return response.data
}

export async function importProducts(payload) {
  const response = await api.post('/products/import', payload)

  return response.data
}

export async function updateProduct(productId, product) {
  const response = await api.put(`/products/${encodeURIComponent(productId)}`, product)

  return response.data
}

export async function getProductCostLots(productId) {
  const response = await api.get(`/products/${encodeURIComponent(productId)}/cost-lots`)

  return response.data
}

export async function getProductMovements(productId) {
  const response = await api.get(`/products/${encodeURIComponent(productId)}/movements`)

  return response.data
}

export async function uploadProductImage(file) {
  const formData = new FormData()

  formData.append('file', file)

  const response = await api.post('/uploads/products', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.data
}

export async function getProductFavorites(params = {}) {
  const response = await api.get('/product-favorites', { params })

  return response.data
}

export async function saveProductFavorite(favorite) {
  const response = await api.put('/product-favorites', favorite)

  return response.data
}

export async function getStockIssues(params = {}) {
  const response = await api.get('/stock-issues', { params })

  return response.data
}

export async function createStockIssue(stockIssue) {
  const response = await api.post('/stock-issues', stockIssue)

  return response.data
}

export async function getRequisitions(params = {}) {
  const response = await api.get('/requisitions', { params })

  return response.data
}

export async function createRequisition(requisition) {
  const response = await api.post('/requisitions', requisition)

  return response.data
}

export async function approveRequisition(headerId, payload) {
  const response = await api.post(`/requisitions/${headerId}/approve`, payload)

  return response.data
}

export async function rejectRequisition(headerId, payload) {
  const response = await api.post(`/requisitions/${headerId}/reject`, payload)

  return response.data
}

export async function keepRequisitionBacklog(headerId, payload) {
  const response = await api.post(`/requisitions/${headerId}/backlog`, payload)

  return response.data
}

export async function denyRequisition(headerId, payload) {
  const response = await api.post(`/requisitions/${headerId}/deny`, payload)

  return response.data
}

export async function cancelStockIssue(headerId, payload) {
  const response = await api.post(`/stock-issues/${headerId}/cancel`, payload)

  return response.data
}

export async function createStockReceive(stockReceive) {
  const response = await api.post('/stock-receives', stockReceive)

  return response.data
}

export async function cancelStockReceive(headerId, payload) {
  const response = await api.post(`/stock-receives/${headerId}/cancel`, payload)

  return response.data
}

export async function getStockReceives(params = {}) {
  const response = await api.get('/stock-receives', { params })

  return response.data
}

export async function getStockAdjustments(params = {}) {
  const response = await api.get('/stock-adjustments', { params })

  return response.data
}

export async function createStockAdjustment(stockAdjustment) {
  const response = await api.post('/stock-adjustments', stockAdjustment)

  return response.data
}

export async function getDashboardSummary() {
  const response = await api.get('/dashboard/summary')

  return response.data
}

export async function getReport(params = {}) {
  const response = await api.get('/reports', { params })

  return response.data
}

export async function getSuppliers() {
  const response = await api.get('/suppliers')

  return response.data
}

export async function createSupplier(supplier) {
  const response = await api.post('/suppliers', supplier)

  return response.data
}

export async function updateSupplierStatus(supplierId, supplierStatus) {
  const response = await api.put(`/suppliers/${supplierId}/status`, { supplierStatus })

  return response.data
}

export async function updateSupplier(supplierId, supplierName) {
  const response = await api.put(`/suppliers/${supplierId}`, { supplierName })

  return response.data
}

export async function getPurchasesBySupplier(params = {}) {
  const response = await api.get('/reports/purchases-by-supplier', { params })

  return response.data
}

export async function getPurchaseTrend(params = {}) {
  const response = await api.get('/reports/purchase-trend', { params })

  return response.data
}

export async function getSupplierPurchaseItems(supplierId, params = {}) {
  const response = await api.get(`/reports/purchases-by-supplier/${supplierId}/items`, { params })

  return response.data
}
